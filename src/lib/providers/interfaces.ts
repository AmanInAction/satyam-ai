import {
  ReasonItem,
  EvidenceItem,
  ProviderStatus,
  ScamVerdict,
  RiskLevel,
  ClaimVerdict,
} from '../validation/schemas';

export interface LLMAnalysisResult {
  verdict: ScamVerdict;
  risk_level: RiskLevel;
  claim_verdict?: ClaimVerdict;
  summary: string;
  reasons: ReasonItem[];
  recommended_actions: string[];
  limitations: string[];
  status: ProviderStatus;
}

export interface EvidenceSearchResult {
  evidence: EvidenceItem[];
  status: ProviderStatus;
}

export interface ReputationResult {
  isMalicious: boolean;
  threatDetails?: string;
  status: ProviderStatus;
}

export interface ILLMProvider {
  name: string;
  analyzeText(text: string, languageHint?: string): Promise<LLMAnalysisResult>;
}

export interface IEvidenceProvider {
  name: string;
  searchEvidence(query: string): Promise<EvidenceSearchResult>;
}

export interface IReputationProvider {
  name: string;
  checkUrl(url: string): Promise<ReputationResult>;
}
