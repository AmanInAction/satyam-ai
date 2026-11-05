import { describe, it, expect, vi } from 'vitest';
import { AnalysisOrchestrator } from '../src/lib/analysis/orchestrator';
import { createTestPng } from '../src/lib/security/imageSecurity';

describe('AnalysisOrchestrator', () => {
  const orchestrator = new AnalysisOrchestrator();

  it('does not silently select the mock LLM outside the test runtime', async () => {
    const previousEnv = {
      vitest: process.env.VITEST,
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      sessionToken: process.env.AWS_SESSION_TOKEN,
    };

    delete process.env.VITEST;
    process.env.AWS_ACCESS_KEY_ID = '';
    process.env.AWS_SECRET_ACCESS_KEY = '';
    process.env.AWS_SESSION_TOKEN = '';

    try {
      const productionLikeOrchestrator = new AnalysisOrchestrator({
        evidenceProvider: {
          name: 'unused_evidence',
          searchEvidence: async () => ({ evidence: [], status: 'not_applicable' }),
        },
      });
      const result = await productionLikeOrchestrator.analyzeText('Meet me at noon.');

      expect(result.checks_performed).toContain('amazon_bedrock');
      expect(result.provider_status.llm).toBe('not_configured');
      expect(result.classification.scam_risk.verdict).toBe('unverified');
    } finally {
      if (previousEnv.vitest === undefined) delete process.env.VITEST;
      else process.env.VITEST = previousEnv.vitest;
      if (previousEnv.accessKeyId === undefined) delete process.env.AWS_ACCESS_KEY_ID;
      else process.env.AWS_ACCESS_KEY_ID = previousEnv.accessKeyId;
      if (previousEnv.secretAccessKey === undefined) delete process.env.AWS_SECRET_ACCESS_KEY;
      else process.env.AWS_SECRET_ACCESS_KEY = previousEnv.secretAccessKey;
      if (previousEnv.sessionToken === undefined) delete process.env.AWS_SESSION_TOKEN;
      else process.env.AWS_SESSION_TOKEN = previousEnv.sessionToken;
    }
  });

  it('identifies urgent financial / OTP threats as likely_scam with unverified claim', async () => {
    const input = 'Your bank account will be blocked within 24 hours. Submit your OTP and pay fee immediately.';
    const result = await orchestrator.analyzeText(input);

    expect(result.input_type).toBe('text');
    expect(result.classification).toBeDefined();
    expect(result.classification.scam_risk.verdict).toBe('likely_scam');
    expect(result.classification.scam_risk.risk_level).toBe('high');
    expect(result.classification.claim_verification.verdict).toBe('unverified');
    expect(result.verdict).toBe('likely_scam');
    expect(result.risk_level).toBe('high');
    expect(result.reasons.length).toBeGreaterThan(0);
    expect(result.checks_performed).toContain('mock_llm');
    expect(result.provider_status.llm).toBe('success');
  });

  it('identifies benign text as no_obvious_risk_found', async () => {
    const input = 'Hey, are we still meeting for lunch tomorrow at 1 PM?';
    const result = await orchestrator.analyzeText(input);

    expect(result.classification.scam_risk.verdict).toBe('no_obvious_risk_found');
    expect(result.classification.scam_risk.risk_level).toBe('low');
    expect(result.verdict).toBe('no_obvious_risk_found');
    expect(result.risk_level).toBe('low');
    expect(result.limitations.length).toBeGreaterThan(0);
  });

  it('does not submit non-claim message text to the evidence provider', async () => {
    const searchEvidence = vi.fn(async () => ({
      evidence: [],
      status: 'success' as const,
    }));
    const isolatedOrchestrator = new AnalysisOrchestrator({
      evidenceProvider: {
        name: 'evidence_spy',
        searchEvidence,
      },
    });

    const result = await isolatedOrchestrator.analyzeText(
      'Please call me.'
    );

    expect(searchEvidence).not.toHaveBeenCalled();
    expect(result.provider_status.evidence).toBe('not_applicable');
  });

  it('identifies deceptive URL patterns while preserving claim dimension', async () => {
    const url = 'https://free-gift-reward.com/claim';
    const result = await orchestrator.analyzeUrl(url);

    expect(result.input_type).toBe('url');
    expect(result.classification.scam_risk.verdict).toBe('likely_scam');
    expect(result.classification.scam_risk.risk_level).toBe('high');
    expect(result.classification.claim_verification.verdict).toBe('unverified');
    expect(result.verdict).toBe('likely_scam');
    expect(result.risk_level).toBe('high');
    expect(result.reasons.some((r) => r.code === 'flagged_domain')).toBe(true);
  });

  it('returns partial result gracefully if provider throws on ambiguous text', async () => {
    const failingProvider = {
      name: 'broken_llm',
      analyzeText: async () => {
        throw new Error('Service down');
      },
    };

    const faultyOrchestrator = new AnalysisOrchestrator({
      llmProvider: failingProvider,
    });

    const result = await faultyOrchestrator.analyzeText('Random ambiguous text without keywords');
    expect(result.classification.scam_risk.verdict).toBe('unverified');
    expect(result.classification.scam_risk.risk_level).toBe('unknown');
    expect(result.classification.claim_verification.verdict).toBe('unverified');
    expect(result.verdict).toBe('unverified');
    expect(result.risk_level).toBe('unknown');
    expect(result.provider_status.llm).toBe('failed');
  });

  it('preserves high-risk scam verdict when deterministic rule fires even if LLM provider fails', async () => {
    const failingProvider = {
      name: 'broken_llm',
      analyzeText: async () => {
        throw new Error('Bedrock timeout or quota exceeded');
      },
    };

    const faultyOrchestrator = new AnalysisOrchestrator({
      llmProvider: failingProvider,
    });

    const result = await faultyOrchestrator.analyzeText(
      'Scan QR code and enter UPI PIN to receive Rs 5000 cashback immediately'
    );
    expect(result.classification.scam_risk.verdict).toBe('likely_scam');
    expect(result.classification.scam_risk.risk_level).toBe('high');
    expect(result.reasons.some((r) => r.code === 'upi_receive_pin_trap')).toBe(true);
    expect(result.provider_status.llm).toBe('failed');
    expect(result.limitations.some((l) => l.includes('LLM provider failed'))).toBe(true);
  });

  it('uses structured image credential indicators when the LLM text assessment is inconclusive', async () => {
    const visualAnalysis = {
      extracted_text: 'SBI reward program for eligible customers.',
      language_detected: 'English',
      claimed_organization: 'SBI',
      claimed_offer_or_reward: 'Reward program',
      requested_user_action: 'Complete reward verification',
      credential_requests: ['UPI PIN'],
      payment_instructions: [],
      suspicious_indicators: [],
      impersonation_indicators: [],
      urgency_indicators: [],
      confidence: 0.96,
      visual_analysis_summary: 'The image requests a UPI PIN to verify a reward.',
    };
    const imageOrchestrator = new AnalysisOrchestrator({
      visionProvider: {
        name: 'structured_test_vision',
        extractText: async () => ({
          extractedText: visualAnalysis.extracted_text,
          status: 'success',
          visualAnalysis,
        }),
      },
      evidenceProvider: {
        name: 'empty_test_evidence',
        searchEvidence: async () => ({ evidence: [], status: 'not_applicable' }),
      },
      llmProvider: {
        name: 'inconclusive_llm',
        analyzeText: async () => ({
          verdict: 'unverified',
          risk_level: 'unknown',
          summary: 'Unable to verify the reward claim.',
          reasons: [],
          recommended_actions: [],
          limitations: [],
          status: 'success',
        }),
      },
    });

    const result = await imageOrchestrator.analyzeImage(createTestPng(250, 150), 'image/png');

    expect(result.classification.scam_risk.verdict).toBe('likely_scam');
    expect(result.classification.scam_risk.risk_level).toBe('high');
    expect(result.classification.claim_verification.verdict).toBe('unverified');
    expect(result.visual_analysis).toEqual(visualAnalysis);
    expect(result.reasons.some((reason) => reason.code === 'credential_otp_solicitation')).toBe(true);
    expect(result.reasons.find((reason) => reason.code === 'credential_otp_solicitation')?.explanation)
      .toContain('UPI PIN');
  });
});
