import crypto from 'node:crypto';
import {
  AnalysisResponse,
  ScamVerdict,
  RiskLevel,
  ClaimVerdict,
  ReasonItem,
  ProviderStatus,
} from '../validation/schemas';
import {
  ILLMProvider,
  IEvidenceProvider,
  IReputationProvider,
} from '../providers/interfaces';
import {
  MockLLMProvider,
  MockEvidenceProvider,
  MockReputationProvider,
} from '../providers/mockAdapter';
import { BedrockLLMProvider } from '../providers/bedrockAdapter';
import { CompositeEvidenceProvider } from '../providers/evidenceProvider';
import { CompositeReputationProvider } from '../providers/reputationProvider';
import {
  validateAndNormalizeUrl,
  evaluateDeterministicUrlSignals,
  extractApexDomain,
} from '../security/urlSecurity';
import { evaluateDeterministicRules } from './deterministicRules';

export interface OrchestratorOptions {
  llmProvider?: ILLMProvider;
  evidenceProvider?: IEvidenceProvider;
  reputationProvider?: IReputationProvider;
}

export class AnalysisOrchestrator {
  private llm: ILLMProvider;
  private evidence: IEvidenceProvider;
  private reputation: IReputationProvider;

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
  }

  async analyzeText(text: string, languageHint: string = 'auto'): Promise<AnalysisResponse> {
    const analysisId = `an_${crypto.randomBytes(8).toString('hex')}`;
    const checksPerformed: string[] = ['deterministic_rules', this.llm.name];
    const providerStatus: Record<string, ProviderStatus> = {};

    // 1. Evaluate India-relevant deterministic scam rules
    const ruleResult = evaluateDeterministicRules(text);

    // 2. Invoke LLM provider (Bedrock or Mock)
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
        summary: 'LLM analysis service encountered an unexpected error.',
        reasons: [],
        recommended_actions: ['Exercise standard caution and verify message authenticity.'],
        limitations: ['LLM provider failed; evaluation relied on deterministic rules.'],
        status: 'failed' as ProviderStatus,
      };
    }

    // 3. Attempt evidence lookup if available
    let evidenceList: AnalysisResponse['evidence'] = [];
    try {
      const evResult = await this.evidence.searchEvidence(text.slice(0, 100));
      providerStatus.evidence = evResult.status;
      evidenceList = evResult.evidence;
      checksPerformed.push(this.evidence.name);
    } catch {
      providerStatus.evidence = 'unavailable';
    }

    providerStatus.url_reputation = 'not_applicable';

    // 4. Signal Fusion: Merge deterministic rules with LLM analysis
    const mergedReasons: ReasonItem[] = [...ruleResult.matchedReasons];
    for (const r of llmResult.reasons) {
      if (!mergedReasons.some((existing) => existing.code === r.code)) {
        mergedReasons.push(r);
      }
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

    const claimVerdict: ClaimVerdict = llmResult.claim_verdict ?? 'unverified';

    // Formulate concise, user-friendly summary
    let summary = llmResult.summary;
    if (scamVerdict === 'likely_scam' && ruleResult.matchedReasons.length > 0) {
      summary = `High-risk scam indicators detected: ${ruleResult.matchedReasons.map((r) => r.title).join(', ')}.`;
    } else if (scamVerdict === 'unverified' && (llmResult.status === 'failed' || llmResult.status === 'not_configured')) {
      summary = 'Analysis was unable to verify this content conclusively with configured AI providers.';
    }

    // Merge recommended actions and limitations
    const mergedActions = Array.from(
      new Set([...ruleResult.actions, ...llmResult.recommended_actions])
    );
    const mergedLimitations = Array.from(
      new Set([...ruleResult.limitations, ...llmResult.limitations])
    );

    return {
      analysis_id: analysisId,
      input_type: 'text',
      classification: {
        scam_risk: {
          verdict: scamVerdict,
          risk_level: scamRiskLevel,
        },
        claim_verification: {
          verdict: claimVerdict,
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
    let repResult;
    try {
      repResult = await this.reputation.checkUrl(targetUrl);
      providerStatus.url_reputation = repResult.status;

      if (repResult.isMalicious) {
        if (!reasons.some((r) => r.code === 'reputation_threat_match')) {
          reasons.unshift({
            code: 'reputation_threat_match',
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
      } else if (repResult.threatDetails && !reasons.some((r) => r.explanation === repResult.threatDetails)) {
        reasons.push({
          code: 'suspicious_domain_cue',
          title: 'Suspicious Domain Cue',
          explanation: repResult.threatDetails,
          signal_type: 'reputation_check',
          evidence_refs: [],
        });
      }
    } catch {
      providerStatus.url_reputation = 'failed';
      limitations.push('Live URL reputation lookup encountered an error; relying on deterministic checks.');
    }

    // 4. Evidence Retrieval for Domain / Institution Context
    let evidenceList: AnalysisResponse['evidence'] = [];
    try {
      const evResult = await this.evidence.searchEvidence(apexDomain);
      providerStatus.evidence = evResult.status;
      evidenceList = evResult.evidence;
      checksPerformed.push(this.evidence.name);
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
      classification: {
        scam_risk: {
          verdict,
          risk_level: riskLevel,
        },
        claim_verification: {
          verdict: 'unverified',
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
}

export const defaultOrchestrator = new AnalysisOrchestrator();
