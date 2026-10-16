import crypto from 'node:crypto';
import {
  AnalysisResponse,
  ScamVerdict,
  RiskLevel,
  ClaimVerdict,
  ReasonItem,
  ProviderStatus,
  AnalysisType,
  VerificationSource,
} from '../validation/schemas';
import {
  ILLMProvider,
  IEvidenceProvider,
  IReputationProvider,
  IVisionOcrProvider,
  VisionOcrResult,
  ReputationResult,
} from '../providers/interfaces';
import {
  MockLLMProvider,
  MockEvidenceProvider,
  MockReputationProvider,
} from '../providers/mockAdapter';
import { BedrockLLMProvider } from '../providers/bedrockAdapter';
import { CompositeEvidenceProvider } from '../providers/evidenceProvider';
import { CompositeReputationProvider } from '../providers/reputationProvider';
import { CompositeVisionProvider } from '../providers/visionProvider';
import {
  validateAndNormalizeUrl,
  evaluateDeterministicUrlSignals,
  extractApexDomain,
} from '../security/urlSecurity';
import {
  validateImageBuffer,
  checkSensitiveImageCues,
} from '../security/imageSecurity';
import { ApiError } from '../errors/apiError';
import { evaluateDeterministicRules } from './deterministicRules';
import {
  identifyAnalysisTypeAndClaim,
  extractClaimKeywords,
} from './claimExtractor';
import {
  filterAndScoreEvidence,
  evaluateClaimFromEvidence,
} from './evidenceEvaluator';

export interface OrchestratorOptions {
  llmProvider?: ILLMProvider;
  evidenceProvider?: IEvidenceProvider;
  reputationProvider?: IReputationProvider;
  visionProvider?: IVisionOcrProvider;
}

export class AnalysisOrchestrator {
  private llm: ILLMProvider;
  private evidence: IEvidenceProvider;
  private reputation: IReputationProvider;
  private vision: IVisionOcrProvider;

  constructor(options: OrchestratorOptions = {}) {
    if (options.llmProvider) {
      this.llm = options.llmProvider;
    } else {
      const bedrock = new BedrockLLMProvider();
      // If Bedrock credentials are provided in the environment, use Bedrock; otherwise use MockLLMProvider for offline reliability
      this.llm = bedrock.isConfigured() ? bedrock : new MockLLMProvider();
    }
    this.evidence = options.evidenceProvider ?? new CompositeEvidenceProvider();
    this.reputation = options.reputationProvider ?? new CompositeReputationProvider();
    this.vision = options.visionProvider ?? new CompositeVisionProvider();
  }

  async analyzeText(text: string, languageHint: string = 'auto'): Promise<AnalysisResponse> {
    const analysisId = `an_${crypto.randomBytes(8).toString('hex')}`;
    const checksPerformed: string[] = ['claim_extractor', 'deterministic_rules', this.llm.name];
    const providerStatus: Record<string, ProviderStatus> = {};

    // 1. Identify Analysis Type & Extract Factual Claims
    const claimAnalysis = identifyAnalysisTypeAndClaim(text);

    // 2. Evaluate India-relevant deterministic scam rules
    const ruleResult = evaluateDeterministicRules(text);

    // 3. Attempt evidence lookup if factual claim or high-profile entity exists
    let evidenceList: AnalysisResponse['evidence'] = [];
    let claimEvaluation = evaluateClaimFromEvidence(
      claimAnalysis.extractedClaim,
      [],
      claimAnalysis.hasFactualAssertion
    );

    try {
      const queryToSearch = claimAnalysis.searchQuery || text.slice(0, 100);
      const evResult = await this.evidence.searchEvidence(queryToSearch);
      providerStatus.evidence = evResult.status;
      checksPerformed.push(this.evidence.name);

      if (evResult.evidence.length > 0) {
        claimEvaluation = evaluateClaimFromEvidence(
          claimAnalysis.extractedClaim,
          evResult.evidence,
          claimAnalysis.hasFactualAssertion
        );
        evidenceList = claimEvaluation.relevantEvidence;
      }
    } catch {
      providerStatus.evidence = 'unavailable';
    }

    providerStatus.url_reputation = 'not_applicable';

    // 4. Invoke LLM provider (Bedrock or Mock)
    let llmResult;
    try {
      llmResult = await this.llm.analyzeText(text, languageHint);
      providerStatus.llm = llmResult.status;
    } catch {
      providerStatus.llm = 'failed';
      llmResult = {
        verdict: 'unverified' as ScamVerdict,
        risk_level: 'unknown' as RiskLevel,
        claim_verdict: 'unverified' as ClaimVerdict,
        analysis_type: claimAnalysis.analysisType,
        extracted_claim: claimAnalysis.extractedClaim,
        summary: 'LLM analysis service encountered an unexpected error.',
        reasons: [],
        recommended_actions: ['Exercise standard caution and verify message authenticity.'],
        limitations: ['LLM provider failed; evaluation relied on deterministic rules and evidence check.'],
        status: 'failed' as ProviderStatus,
      };
    }

    // 5. Signal Fusion: Merge deterministic rules with LLM analysis and evidence
    const mergedReasons: ReasonItem[] = [...ruleResult.matchedReasons];
    for (const r of llmResult.reasons) {
      if (!mergedReasons.some((existing) => existing.code === r.code)) {
        mergedReasons.push(r);
      }
    }

    // Add evidence-backed claim verification reason if verified or contradicted
    if (claimAnalysis.hasFactualAssertion && claimEvaluation.verdict !== 'unverified') {
      mergedReasons.push({
        code: `claim_${claimEvaluation.verdict}`,
        title: `Claim Verification: ${claimEvaluation.verdict.toUpperCase()}`,
        explanation: claimEvaluation.explanation,
        signal_type: claimEvaluation.verificationSource,
        evidence_refs: evidenceList.map((e) => e.url),
      });
    }

    let scamVerdict: ScamVerdict = 'no_obvious_risk_found';
    let scamRiskLevel: RiskLevel = 'low';

    if (ruleResult.suggestedVerdict === 'likely_scam') {
      // Deterministic high-severity detection (UPI PIN trap, OTP theft, Digital Arrest, etc.) takes precedence
      scamVerdict = 'likely_scam';
      scamRiskLevel = 'high';
    } else if (llmResult.verdict === 'likely_scam' && llmResult.status === 'success') {
      scamVerdict = 'likely_scam';
      scamRiskLevel = 'high';
    } else if (ruleResult.suggestedVerdict === 'suspicious' || llmResult.verdict === 'suspicious') {
      scamVerdict = 'suspicious';
      scamRiskLevel = 'medium';
    } else if (llmResult.status === 'failed' || llmResult.status === 'not_configured') {
      if (ruleResult.suggestedVerdict !== 'no_obvious_risk_found') {
        scamVerdict = ruleResult.suggestedVerdict;
        scamRiskLevel = ruleResult.suggestedRiskLevel;
      } else {
        scamVerdict = 'unverified';
        scamRiskLevel = 'unknown';
      }
    } else {
      scamVerdict = llmResult.verdict;
      scamRiskLevel = llmResult.risk_level;
    }

    // 6. Grounded Claim Verdict Determination (Verdict Discipline)
    let claimVerdict: ClaimVerdict = 'unverified';
    let verificationSource: VerificationSource = 'unverified';

    if (claimEvaluation.verdict === 'supported' || claimEvaluation.verdict === 'contradicted' || claimEvaluation.verdict === 'mixed') {
      claimVerdict = claimEvaluation.verdict;
      verificationSource = claimEvaluation.verificationSource;
    } else if (!claimAnalysis.hasFactualAssertion) {
      claimVerdict = 'unverified';
      verificationSource = 'unverified';
    } else if (evidenceList.length > 0) {
      claimVerdict = 'unverified';
      verificationSource = 'evidence_limited_inference';
    } else {
      claimVerdict = 'unverified';
      verificationSource = 'unverified';
    }

    // 7. Determine Final Analysis Type
    const hasScamThreat = scamVerdict === 'likely_scam' || scamVerdict === 'suspicious';
    const hasFactualClaim = claimAnalysis.hasFactualAssertion;

    let finalAnalysisType: AnalysisType = 'insufficient_information';
    if (hasScamThreat && hasFactualClaim) {
      finalAnalysisType = 'both';
    } else if (hasScamThreat) {
      finalAnalysisType = 'scam_risk';
    } else if (hasFactualClaim) {
      finalAnalysisType = 'factual_claim';
    } else {
      finalAnalysisType = claimAnalysis.analysisType;
    }

    // 8. Formulate balanced, descriptive summary with regional UX support
    const isHindi = languageHint === 'hi' || /[\u0900-\u097F]/.test(text);
    const isHinglish = languageHint === 'hinglish';

    let summary = llmResult.summary;
    if (finalAnalysisType === 'both') {
      const scamCue = ruleResult.matchedReasons[0]?.title || 'Financial or credential risk';
      if (isHindi) {
        summary = `द्विआयामी जोखिम (Dual Threat): संदेश में वित्तीय या क्रेडेंशियल जोखिम (${scamCue}) के लक्षण हैं और साथ ही यह दावा किया गया है: "${claimAnalysis.extractedClaim}"। दावे का सत्यापन: ${claimVerdict === 'contradicted' ? 'खंडित (CONTRADICTED)' : claimVerdict === 'supported' ? 'समर्थित (SUPPORTED)' : 'अपुष्ट (UNVERIFIED)'}।`;
      } else if (isHinglish) {
        summary = `Dual threat detect hua hai: Message me scam cues (${scamCue}) hain aur sath me factual claim assert kiya gaya hai: "${claimAnalysis.extractedClaim}". Claim status: ${claimVerdict.toUpperCase()}.`;
      } else {
        summary = `Dual threat detected: Exhibits scam indicators (${scamCue}) while asserting factual claim "${claimAnalysis.extractedClaim}". Claim is evaluated as ${claimVerdict.toUpperCase()}.`;
      }
    } else if (finalAnalysisType === 'factual_claim') {
      if (claimVerdict === 'contradicted') {
        summary = isHindi
          ? `तथ्यात्मक दावा "${claimAnalysis.extractedClaim}" आधिकारिक स्रोतों और फैक्ट-चेक द्वारा खंडित (CONTRADICTED) पाया गया है।`
          : `Factual claim "${claimAnalysis.extractedClaim}" is CONTRADICTED by attributable reference sources.`;
      } else if (claimVerdict === 'supported') {
        summary = isHindi
          ? `तथ्यात्मक दावा "${claimAnalysis.extractedClaim}" विश्वसनीय संदर्भ स्रोतों द्वारा समर्थित (SUPPORTED) है।`
          : `Factual claim "${claimAnalysis.extractedClaim}" is SUPPORTED by attributable reference sources.`;
      } else {
        summary = isHindi
          ? `तथ्यात्मक दावा प्रस्तुत किया गया है ("${claimAnalysis.extractedClaim}"), लेकिन इसकी पुष्टि या खंडन के लिए पर्याप्त ठोस साक्ष्य नहीं मिले।`
          : `Factual claim asserted ("${claimAnalysis.extractedClaim}"), but insufficient conclusive evidence was found to verify or refute it.`;
      }
    } else if (finalAnalysisType === 'insufficient_information') {
      summary = isHindi
        ? 'प्रस्तुत संदेश में पर्याप्त संदर्भ या सत्यापन योग्य दावों का अभाव है।'
        : claimAnalysis.explanation || 'Submission lacks sufficient factual context or verifiable propositions to assess.';
    } else if (scamVerdict === 'likely_scam' && ruleResult.matchedReasons.length > 0) {
      summary = isHindi
        ? `उच्च जोखिम वाली धोखाधड़ी के संकेत: ${ruleResult.matchedReasons.map((r) => r.title).join(', ')}।`
        : `High-risk scam indicators detected: ${ruleResult.matchedReasons.map((r) => r.title).join(', ')}.`;
    }

    // Merge recommended actions and limitations
    const mergedActions = Array.from(
      new Set([...ruleResult.actions, ...llmResult.recommended_actions])
    );
    if (isHindi) {
      mergedActions.push('राष्ट्रीय साइबर अपराध हेल्पलाइन: 1930 पर तुरंत कॉल करें अथवा cybercrime.gov.in पर रिपोर्ट करें।');
    } else if (isHinglish) {
      mergedActions.push('National Cyber Crime Helpline: 1930 pe call karein ya cybercrime.gov.in pe report karein.');
    }

    const mergedLimitations = Array.from(
      new Set([...ruleResult.limitations, ...llmResult.limitations])
    );

    if (claimAnalysis.hasFactualAssertion && evidenceList.length === 0) {
      mergedLimitations.push(
        'Independent evidence search yielded no directly matching fact-check records; absence of evidence does not imply truth.'
      );
    }

    return {
      analysis_id: analysisId,
      input_type: 'text',
      analysis_type: finalAnalysisType,
      extracted_claim: claimAnalysis.extractedClaim,
      classification: {
        analysis_type: finalAnalysisType,
        scam_risk: {
          verdict: scamVerdict,
          risk_level: scamRiskLevel,
        },
        claim_verification: {
          verdict: claimVerdict,
          extracted_claim: claimAnalysis.extractedClaim,
          verification_source: verificationSource,
        },
      },
      verdict: scamVerdict,
      risk_level: scamRiskLevel,
      summary,
      reasons: mergedReasons,
      evidence: evidenceList,
      recommended_actions: mergedActions,
      limitations: mergedLimitations,
      checks_performed: checksPerformed,
      provider_status: providerStatus,
      created_at: new Date().toISOString(),
    };
  }

  async analyzeUrl(urlStr: string): Promise<AnalysisResponse> {
    const analysisId = `an_${crypto.randomBytes(8).toString('hex')}`;
    const checksPerformed: string[] = ['url_normalization_ssrf_guard', 'deterministic_url_rules', this.reputation.name];
    const providerStatus: Record<string, ProviderStatus> = {};

    // 1. SSRF and URL Syntax Validation
    const norm = validateAndNormalizeUrl(urlStr);
    if (!norm.isValid || !norm.parsed) {
      throw new Error(norm.error || 'Invalid or unsafe URL format.');
    }

    const targetUrl = norm.normalizedUrl || urlStr;
    const apexDomain = extractApexDomain(norm.parsed.hostname);

    // 2. Evaluate Deterministic URL Structural Signals
    const deterministicSignals = evaluateDeterministicUrlSignals(norm.parsed);
    const reasons: ReasonItem[] = [...deterministicSignals.matchedReasons];
    const recommendedActions: string[] = [...deterministicSignals.actions];
    const limitations: string[] = [...deterministicSignals.limitations];

    // 3. Evaluate Live URL Reputation
    let repResult: ReputationResult | undefined;
    try {
      repResult = await this.reputation.checkUrl(targetUrl);
      providerStatus.url_reputation = repResult.status;

      if (repResult.isMalicious) {
        if (!reasons.some((r) => r.code === 'flagged_domain')) {
          reasons.unshift({
            code: 'flagged_domain',
            title: 'Reputation Threat Intelligence Match',
            explanation: repResult.threatDetails || 'Domain matches known threat intelligence blocklists.',
            signal_type: 'reputation_check',
            evidence_refs: [],
          });
        }
        recommendedActions.push(
          'Do not visit this URL or submit credentials/personal information.',
          'Close any tabs or browser windows opened to this destination.'
        );
      } else if (repResult?.threatDetails) {
        const details = repResult.threatDetails;
        if (!reasons.some((r) => r.explanation === details)) {
          reasons.push({
            code: 'suspicious_domain_cue',
            title: 'Suspicious Domain Cue',
            explanation: details,
            signal_type: 'reputation_check',
            evidence_refs: [],
          });
        }
      }
    } catch {
      providerStatus.url_reputation = 'failed';
      limitations.push('Live URL reputation lookup encountered an error; relying on deterministic checks.');
    }

    // 4. Evidence Retrieval for Domain / Institution Context with Relevance Filtering
    let evidenceList: AnalysisResponse['evidence'] = [];
    try {
      const evResult = await this.evidence.searchEvidence(apexDomain);
      providerStatus.evidence = evResult.status;
      checksPerformed.push(this.evidence.name);

      if (evResult.evidence.length > 0) {
        // Strict relevance filtering: discard generic or unrelated articles (e.g. "airline codes" for bank URLs)
        const { relevant, filteredOutCount } = filterAndScoreEvidence(
          evResult.evidence,
          apexDomain,
          null,
          0.20
        );
        evidenceList = relevant;

        if (filteredOutCount > 0 && relevant.length === 0) {
          limitations.push(
            'Retrieved reference search results were evaluated as unrelated to this specific domain and omitted to prevent false attribution.'
          );
        }
      }
    } catch {
      providerStatus.evidence = 'unavailable';
    }

    providerStatus.llm = 'not_applicable';

    // 5. Signal Fusion & Verdict Determination
    let verdict: ScamVerdict = 'no_obvious_risk_found';
    let riskLevel: RiskLevel = 'low';

    if (deterministicSignals.suggestedVerdict === 'likely_scam' || repResult?.isMalicious) {
      verdict = 'likely_scam';
      riskLevel = 'high';
    } else if (deterministicSignals.suggestedVerdict === 'suspicious' || (repResult?.threatDetails && !repResult.isMalicious)) {
      verdict = 'suspicious';
      riskLevel = 'medium';
    } else if (providerStatus.url_reputation === 'failed' || providerStatus.url_reputation === 'unavailable') {
      verdict = 'unverified';
      riskLevel = 'unknown';
    } else {
      verdict = 'no_obvious_risk_found';
      riskLevel = 'low';
      recommendedActions.push(
        'Verify that the address bar matches the intended official domain name exactly before entering credentials.'
      );
    }

    // Summary formulation
    let summary: string;
    if (verdict === 'likely_scam') {
      summary = `High-risk indicators detected for this URL: ${reasons.map((r) => r.title).join(', ')}.`;
    } else if (verdict === 'suspicious') {
      summary = `Caution advised: URL exhibits structural or telemetry cues that warrant verification: ${reasons.map((r) => r.title).join(', ')}.`;
    } else if (verdict === 'unverified') {
      summary = 'Unable to conclusively verify URL safety; live threat reputation lookup was unavailable.';
    } else {
      summary = 'No known threat indicators or suspicious structural patterns detected for this URL.';
    }

    const mergedActions = Array.from(new Set(recommendedActions));
    const mergedLimitations = Array.from(new Set(limitations));

    return {
      analysis_id: analysisId,
      input_type: 'url',
      analysis_type: 'scam_risk',
      extracted_claim: null,
      classification: {
        analysis_type: 'scam_risk',
        scam_risk: {
          verdict,
          risk_level: riskLevel,
        },
        claim_verification: {
          verdict: 'unverified',
          extracted_claim: null,
          verification_source: 'reputation_feed',
        },
      },
      verdict,
      risk_level: riskLevel,
      summary,
      reasons,
      evidence: evidenceList,
      recommended_actions: mergedActions,
      limitations: mergedLimitations,
      checks_performed: checksPerformed,
      provider_status: providerStatus,
      created_at: new Date().toISOString(),
    };
  }

  async analyzeImage(
    imageBuffer: Buffer,
    declaredMimeType?: string,
    languageHint: string = 'auto'
  ): Promise<AnalysisResponse> {
    const analysisId = `an_${crypto.randomBytes(8).toString('hex')}`;
    const checksPerformed: string[] = ['image_security_guard'];
    const providerStatus: Record<string, ProviderStatus> = {};

    // 1. Image Security, Size, MIME, Magic Bytes & Dimension Guard
    const validation = validateImageBuffer(imageBuffer, declaredMimeType);
    if (!validation.isValid) {
      throw new ApiError(
        validation.errorCode === 'FILE_TOO_LARGE' ? 413 : 400,
        validation.errorCode,
        validation.errorMessage
      );
    }

    // 2. Vision OCR Text Extraction
    checksPerformed.push(this.vision.name);
    let ocrResult: VisionOcrResult;
    try {
      ocrResult = await this.vision.extractText(imageBuffer, validation.mimeType);
      providerStatus.vision_ocr = ocrResult.status;
    } catch {
      providerStatus.vision_ocr = 'failed';
      ocrResult = {
        extractedText: '',
        status: 'failed',
      };
    }

    const rawExtracted = ocrResult.extractedText?.trim() || '';

    // 3. Handle unreadable, blank, or zero-text images gracefully without crash or safe-verdict hallucination
    if (!rawExtracted || rawExtracted === '[NO_READABLE_TEXT]') {
      const isHindi = languageHint === 'hi';
      const unreadableSummary = isHindi
        ? 'अपलोड किए गए स्क्रीनशॉट से कोई पढ़ने योग्य या स्पष्ट टेक्स्ट नहीं मिला। कृपया स्पष्ट और अनक्रॉप्ड इमेज अपलोड करें।'
        : 'No legible or verifiable text was detected in the submitted screenshot.';

      const unreadableActions = [
        'Ensure the screenshot is clear, well-lit, and not cropped or blurry.',
        'If the message contains text, consider typing or pasting the key text directly into the text analyzer.',
      ];
      if (isHindi) {
        unreadableActions.push('कृपया जांचें कि इमेज में टेक्स्ट धुंधला या कटा हुआ न हो।');
      }

      const unreadableLimitations = [
        'Optical Character Recognition (OCR) did not detect any legible text in this image.',
        'Unreadable images cannot be verified and are evaluated as unverified / unknown risk.',
        'This system does not inspect non-textual image features, steganography, or deepfakes.',
      ];

      return {
        analysis_id: analysisId,
        input_type: 'image',
        analysis_type: 'insufficient_information',
        extracted_claim: null,
        extracted_text: '',
        classification: {
          analysis_type: 'insufficient_information',
          scam_risk: {
            verdict: 'unverified',
            risk_level: 'unknown',
          },
          claim_verification: {
            verdict: 'unverified',
            extracted_claim: null,
            verification_source: 'unverified',
          },
        },
        verdict: 'unverified',
        risk_level: 'unknown',
        summary: unreadableSummary,
        reasons: [
          {
            code: 'ocr_unreadable_content',
            title: 'Unreadable or Blank Image',
            explanation: 'No readable textual propositions, URLs, or sender cues were detected in the uploaded screenshot.',
            signal_type: 'vision_ocr',
            evidence_refs: [],
          },
        ],
        evidence: [],
        recommended_actions: unreadableActions,
        limitations: unreadableLimitations,
        checks_performed: checksPerformed,
        provider_status: {
          ...providerStatus,
          evidence: 'not_applicable',
          url_reputation: 'not_applicable',
          llm: 'not_applicable',
        },
        created_at: new Date().toISOString(),
      };
    }

    // 4. Sensitive credential warning check
    const sensitiveCheck = checkSensitiveImageCues(rawExtracted);

    // 5. Feed extracted text through standard analysis orchestrator pipeline
    const textAnalysis = await this.analyzeText(rawExtracted, languageHint);

    // 6. Enrich with image-specific metadata, limitations, and security provenance
    const imageLimitations = [
      ...textAnalysis.limitations,
      'Image analysis is based strictly on optical text extraction; this system cannot verify screenshot authenticity, detect tampering/photoshop, or authenticate digital receipts.',
    ];

    const imageActions = [...textAnalysis.recommended_actions];
    if (sensitiveCheck.isSensitive) {
      imageActions.unshift(
        sensitiveCheck.cueMessage ||
          'Warning: This screenshot appears to contain sensitive payment or security credentials. Never share unmasked payment card details, CVVs, or account passwords.'
      );
    }

    const mergedChecks = Array.from(new Set([...checksPerformed, ...textAnalysis.checks_performed]));
    const mergedProviderStatus: Record<string, ProviderStatus> = {
      ...providerStatus,
      ...textAnalysis.provider_status,
    };

    return {
      ...textAnalysis,
      analysis_id: analysisId,
      input_type: 'image',
      extracted_text: rawExtracted,
      limitations: imageLimitations,
      recommended_actions: imageActions,
      checks_performed: mergedChecks,
      provider_status: mergedProviderStatus,
    };
  }
}

export const defaultOrchestrator = new AnalysisOrchestrator();
