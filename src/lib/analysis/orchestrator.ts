import crypto from 'node:crypto';
import {
  AnalysisResponse,
  ScamVerdict,
  RiskLevel,
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
    this.llm = options.llmProvider ?? new MockLLMProvider();
    this.evidence = options.evidenceProvider ?? new MockEvidenceProvider();
    this.reputation = options.reputationProvider ?? new MockReputationProvider();
  }

  async analyzeText(text: string, languageHint: string = 'auto'): Promise<AnalysisResponse> {
    const analysisId = `an_${crypto.randomBytes(8).toString('hex')}`;
    const checksPerformed: string[] = ['deterministic_rules', this.llm.name];
    const providerStatus: Record<string, ProviderStatus> = {};

    let llmResult;
    try {
      llmResult = await this.llm.analyzeText(text, languageHint);
      providerStatus.llm = llmResult.status;
    } catch {
      providerStatus.llm = 'failed';
      llmResult = {
        verdict: 'unverified' as ScamVerdict,
        risk_level: 'unknown' as RiskLevel,
        summary: 'Analysis service temporarily encountered an error processing this request.',
        reasons: [],
        recommended_actions: ['Exercise standard caution and retry in a moment.'],
        limitations: ['LLM provider encountered an error; fallback verdict emitted.'],
        status: 'failed' as ProviderStatus,
      };
    }

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

    return {
      analysis_id: analysisId,
      input_type: 'text',
      verdict: llmResult.verdict,
      risk_level: llmResult.risk_level,
      summary: llmResult.summary,
      reasons: llmResult.reasons,
      evidence: evidenceList,
      recommended_actions: llmResult.recommended_actions,
      limitations: llmResult.limitations,
      checks_performed: checksPerformed,
      provider_status: providerStatus,
      created_at: new Date().toISOString(),
    };
  }

  async analyzeUrl(urlStr: string): Promise<AnalysisResponse> {
    const analysisId = `an_${crypto.randomBytes(8).toString('hex')}`;
    const checksPerformed: string[] = ['url_syntax_check', this.reputation.name];
    const providerStatus: Record<string, ProviderStatus> = {};

    let verdict: ScamVerdict = 'no_obvious_risk_found';
    let riskLevel: RiskLevel = 'low';
    const reasons: ReasonItem[] = [];
    const limitations: string[] = [
      'URL reputation lookup does not guarantee absence of zero-day threats or newly hosted phishing.',
    ];
    const recommendedActions: string[] = [];

    // Basic heuristic check for suspicious patterns
    try {
      const rep = await this.reputation.checkUrl(urlStr);
      providerStatus.url_reputation = rep.status;

      if (rep.isMalicious) {
        verdict = 'likely_scam';
        riskLevel = 'high';
        reasons.push({
          code: 'flagged_domain',
          title: 'Suspicious Domain Pattern',
          explanation: rep.threatDetails || 'Domain matches known high-risk or deceptive indicators.',
        });
        recommendedActions.push(
          'Do not visit this URL or submit credentials/personal information.',
          'Close any tabs opened to this destination.'
        );
      } else {
        recommendedActions.push(
          'Check that the address bar matches the intended brand domain exactly before entering information.'
        );
      }
    } catch {
      providerStatus.url_reputation = 'failed';
      verdict = 'unverified';
      riskLevel = 'unknown';
      limitations.push('Reputation provider lookup failed.');
    }

    providerStatus.llm = 'not_applicable';
    providerStatus.evidence = 'not_applicable';

    return {
      analysis_id: analysisId,
      input_type: 'url',
      verdict,
      risk_level: riskLevel,
      summary:
        verdict === 'likely_scam'
          ? 'URL exhibits indicators associated with malicious or deceptive campaigns.'
          : 'No known threat indicators detected for this URL in configured databases.',
      reasons,
      evidence: [],
      recommended_actions: recommendedActions,
      limitations,
      checks_performed: checksPerformed,
      provider_status: providerStatus,
      created_at: new Date().toISOString(),
    };
  }
}

export const defaultOrchestrator = new AnalysisOrchestrator();
