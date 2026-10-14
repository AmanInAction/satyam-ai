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

export const ClassificationSchema = z.object({
  scam_risk: z.object({
    verdict: ScamVerdictSchema,
    risk_level: RiskLevelSchema,
  }),
  claim_verification: z.object({
    verdict: ClaimVerdictSchema,
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
