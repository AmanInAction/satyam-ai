import { z } from 'zod';

export const TextAnalysisRequestSchema = z.object({
  text: z
    .string({ required_error: 'Text is required' })
    .trim()
    .min(1, 'Text cannot be empty')
    .max(10000, 'Text cannot exceed 10,000 characters'),
  language_hint: z
    .enum(['auto', 'en', 'hi', 'hinglish'])
    .optional()
    .default('auto'),
});

export type TextAnalysisRequest = z.infer<typeof TextAnalysisRequestSchema>;

export const UrlAnalysisRequestSchema = z.object({
  url: z
    .string({ required_error: 'URL is required' })
    .trim()
    .url('Invalid URL format')
    .refine(
      (val) => {
        try {
          const parsed = new URL(val);
          return parsed.protocol === 'http:' || parsed.protocol === 'https:';
        } catch {
          return false;
        }
      },
      { message: 'Only http and https protocols are supported' }
    ),
});

export type UrlAnalysisRequest = z.infer<typeof UrlAnalysisRequestSchema>;

export const ImageAnalysisRequestSchema = z.object({
  image_data: z.string().min(1, 'Image data is required'),
  mime_type: z.enum(['image/png', 'image/jpeg', 'image/webp'], {
    errorMap: () => ({ message: 'Supported image types are image/png, image/jpeg, and image/webp' }),
  }),
  language_hint: z.enum(['auto', 'en', 'hi', 'hinglish']).optional().default('auto'),
});
export type ImageAnalysisRequest = z.infer<typeof ImageAnalysisRequestSchema>;

export const ScamVerdictSchema = z.enum([
  'likely_scam',
  'suspicious',
  'unverified',
  'no_obvious_risk_found',
]);
export type ScamVerdict = z.infer<typeof ScamVerdictSchema>;

export const RiskLevelSchema = z.enum(['low', 'medium', 'high', 'unknown']);
export type RiskLevel = z.infer<typeof RiskLevelSchema>;

export const ClaimVerdictSchema = z.enum([
  'supported',
  'contradicted',
  'mixed',
  'unverified',
]);
export type ClaimVerdict = z.infer<typeof ClaimVerdictSchema>;

export const AnalysisTypeSchema = z.enum([
  'scam_risk',
  'factual_claim',
  'both',
  'insufficient_information',
]);
export type AnalysisType = z.infer<typeof AnalysisTypeSchema>;

export const VerificationSourceSchema = z.enum([
  'fact_check_database',
  'encyclopedic_reference',
  'reputation_feed',
  'evidence_limited_inference',
  'unverified',
]);
export type VerificationSource = z.infer<typeof VerificationSourceSchema>;

export const ClassificationSchema = z.object({
  analysis_type: AnalysisTypeSchema.optional().default('both'),
  scam_risk: z.object({
    verdict: ScamVerdictSchema,
    risk_level: RiskLevelSchema,
  }),
  claim_verification: z.object({
    verdict: ClaimVerdictSchema,
    extracted_claim: z.string().nullable().optional(),
    verification_source: VerificationSourceSchema.optional().default('unverified'),
  }),
});
export type Classification = z.infer<typeof ClassificationSchema>;

export const ReasonItemSchema = z.object({
  code: z.string(),
  title: z.string(),
  explanation: z.string(),
  signal_type: z.string().optional(),
  evidence_refs: z.array(z.string()).optional().default([]),
  source_ref: z.string().nullable().optional(),
});
export type ReasonItem = z.infer<typeof ReasonItemSchema>;

export const EvidenceItemSchema = z.object({
  title: z.string(),
  publisher: z.string(),
  url: z.string().url(),
  relevance: z.string(),
  source_type: z.string().optional(),
  relevance_score: z.number().min(0).max(1).optional(),
  verification_finding: z.enum(['supports', 'contradicts', 'neutral', 'unrelated']).optional(),
});
export type EvidenceItem = z.infer<typeof EvidenceItemSchema>;

export const ProviderStatusEnum = z.enum([
  'success',
  'partial',
  'unavailable',
  'not_configured',
  'not_applicable',
  'failed',
]);
export type ProviderStatus = z.infer<typeof ProviderStatusEnum>;

export const AnalysisResponseSchema = z.object({
  analysis_id: z.string(),
  input_type: z.enum(['text', 'url', 'image']),
  analysis_type: AnalysisTypeSchema.optional(),
  extracted_claim: z.string().nullable().optional(),
  extracted_text: z.string().nullable().optional(),
  classification: ClassificationSchema,
  verdict: ScamVerdictSchema.optional(),
  risk_level: RiskLevelSchema.optional(),
  summary: z.string(),
  reasons: z.array(ReasonItemSchema),
  evidence: z.array(EvidenceItemSchema),
  recommended_actions: z.array(z.string()),
  limitations: z.array(z.string()),
  checks_performed: z.array(z.string()),
  provider_status: z.record(ProviderStatusEnum),
  created_at: z.string().datetime(),
});
export type AnalysisResponse = z.infer<typeof AnalysisResponseSchema>;

