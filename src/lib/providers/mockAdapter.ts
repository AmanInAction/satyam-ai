import {
  ILLMProvider,
  IEvidenceProvider,
  IReputationProvider,
  LLMAnalysisResult,
  EvidenceSearchResult,
  ReputationResult,
} from './interfaces';

export class MockLLMProvider implements ILLMProvider {
  name = 'mock_llm';

  async analyzeText(text: string): Promise<LLMAnalysisResult> {
    const lower = text.toLowerCase();
    const hasUrgency = /urgent|immediately|blocked|expires|within 24 hours/i.test(lower);
    const hasFinancial = /fee|pay|transfer|gift card|crypto|upi|bank account/i.test(lower);
    const hasOtp = /otp|password|pin|credential|verification code/i.test(lower);

    if (hasOtp || (hasUrgency && hasFinancial)) {
      return {
        verdict: 'likely_scam',
        risk_level: 'high',
        summary: 'Message exhibits high-risk indicators of urgency pressure combined with payment or credential solicitation.',
        reasons: [
          {
            code: 'urgency_pressure',
            title: 'Urgency Pressure',
            explanation: 'Demands immediate action under threat of account loss or penalty.',
          },
          ...(hasOtp
            ? [
                {
                  code: 'credential_solicitation',
                  title: 'Credential or OTP Request',
                  explanation: 'Legitimate institutions never ask for your confidential password, PIN, or OTP.',
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
        summary: 'Message contains potential risk cues that warrant caution before responding.',
        reasons: [
          {
            code: 'unsolicited_request',
            title: 'Unsolicited Alert',
            explanation: 'Contains unsolicited notices that mimic administrative or billing communications.',
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

    return {
      verdict: 'no_obvious_risk_found',
      risk_level: 'low',
      summary: 'No obvious scam patterns or high-risk cues detected in the submitted text.',
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
