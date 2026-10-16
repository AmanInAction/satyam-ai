import {
  ReasonItem,
  EvidenceItem,
  ProviderStatus,
  ScamVerdict,
  RiskLevel,
  ClaimVerdict,
  AnalysisType,
  VerificationSource,
} from '../validation/schemas';

export interface LLMAnalysisResult {
  verdict: ScamVerdict;
  risk_level: RiskLevel;
  claim_verdict?: ClaimVerdict;
  analysis_type?: AnalysisType;
  extracted_claim?: string | null;
  verification_source?: VerificationSource;
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

export interface VisionOcrResult {
  extractedText: string;
  confidence?: number;
  status: ProviderStatus;
  detectedLanguage?: string;
  isSensitiveContent?: boolean;
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

export interface IVisionOcrProvider {
  name: string;
  extractText(imageBuffer: Buffer, mimeType: string): Promise<VisionOcrResult>;
}
