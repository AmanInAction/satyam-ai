import {
  ILLMProvider,
  IEvidenceProvider,
  IReputationProvider,
  LLMAnalysisResult,
  EvidenceSearchResult,
  ReputationResult,
} from './interfaces';
import { identifyAnalysisTypeAndClaim } from '../analysis/claimExtractor';

export class MockLLMProvider implements ILLMProvider {
  name = 'mock_llm';

  async analyzeText(text: string): Promise<LLMAnalysisResult> {
    const claimAnalysis = identifyAnalysisTypeAndClaim(text);
    const lower = text.toLowerCase();
    const isBenignOtpWarning =
      /do not share|never share|not share with anyone|bank never calls/i.test(lower);
    const hasUrgency = /urgent|immediately|blocked|expires|within 24 hours/i.test(lower);
    const hasFinancial = /fee|pay|transfer|gift card|crypto|upi|bank account/i.test(lower);
    const hasOtpSolicitation =
      (/otp|password|pin|credential|verification code/i.test(lower) &&
        /share|send|tell|provide|verify with/i.test(lower) &&
        !isBenignOtpWarning);

    if (hasOtpSolicitation || (hasUrgency && hasFinancial && !isBenignOtpWarning)) {
      return {
        verdict: 'likely_scam',
        risk_level: 'high',
        claim_verdict: 'unverified',
        analysis_type: claimAnalysis.hasFactualAssertion ? 'both' : 'scam_risk',
        extracted_claim: claimAnalysis.extractedClaim,
        summary: 'Message exhibits high-risk indicators of urgency pressure combined with payment or credential solicitation.',
        reasons: [
          {
            code: 'urgency_pressure',
            title: 'Urgency Pressure',
            explanation: 'Demands immediate action under threat of account loss or penalty.',
            signal_type: 'deterministic_rule',
            evidence_refs: [],
          },
          ...(hasOtpSolicitation
            ? [
                {
                  code: 'credential_solicitation',
                  title: 'Credential or OTP Request',
                  explanation: 'Legitimate institutions never ask for your confidential password, PIN, or OTP.',
                  signal_type: 'deterministic_rule',
                  evidence_refs: [],
                },
              ]
            : []),
        ],
        recommended_actions: [
          'Do not share passwords, PINs, or one-time codes.',
          'Verify independently with the organization using official contact numbers.',
          'Do not click embedded links or initiate transactions.',
        ],
        limitations: [
          'Heuristic analysis based on pattern recognition; independently verify sender identity.',
        ],
        status: 'success',
      };
    }

    if (hasUrgency || hasFinancial) {
      return {
        verdict: 'suspicious',
        risk_level: 'medium',
        claim_verdict: 'unverified',
        analysis_type: claimAnalysis.hasFactualAssertion ? 'both' : 'scam_risk',
        extracted_claim: claimAnalysis.extractedClaim,
        summary: 'Message contains potential risk cues that warrant caution before responding.',
        reasons: [
          {
            code: 'unsolicited_request',
            title: 'Unsolicited Alert',
            explanation: 'Contains unsolicited notices that mimic administrative or billing communications.',
            signal_type: 'deterministic_rule',
            evidence_refs: [],
          },
        ],
        recommended_actions: [
          'Verify message authenticity through official channels before acting.',
        ],
        limitations: [
          'Context is limited; benign administrative alerts can share similar wording.',
        ],
        status: 'success',
      };
    }

    const defaultAnalysisType = claimAnalysis.analysisType;

    return {
      verdict: 'no_obvious_risk_found',
      risk_level: 'low',
      claim_verdict: 'unverified',
      analysis_type: defaultAnalysisType,
      extracted_claim: claimAnalysis.extractedClaim,
      summary:
        defaultAnalysisType === 'insufficient_information'
          ? 'Submission lacks sufficient factual context or verifiable propositions.'
          : defaultAnalysisType === 'factual_claim'
          ? 'No obvious scam patterns detected; factual assertions require independent verification against sources.'
          : 'No obvious scam patterns or high-risk cues detected in the submitted text.',
      reasons: [],
      recommended_actions: [
        'Remain vigilant even when obvious risks are not identified.',
      ],
      limitations: [
        'Absence of known scam cues does not guarantee complete authenticity or truth.',
      ],
      status: 'success',
    };
  }
}

export class MockEvidenceProvider implements IEvidenceProvider {
  name = 'mock_evidence';

  async searchEvidence(): Promise<EvidenceSearchResult> {
    return {
      evidence: [],
      status: 'not_configured',
    };
  }
}

export class MockReputationProvider implements IReputationProvider {
  name = 'mock_reputation';

  async checkUrl(url: string): Promise<ReputationResult> {
    const isSuspicious = /free-gift|verify-login|account-update|bank-secure/i.test(url);
    return {
      isMalicious: isSuspicious,
      threatDetails: isSuspicious ? 'Domain matches known phishing keyword patterns' : undefined,
      status: 'success',
    };
  }
}
