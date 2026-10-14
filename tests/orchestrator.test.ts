import { describe, it, expect } from 'vitest';
import { AnalysisOrchestrator } from '../src/lib/analysis/orchestrator';

describe('AnalysisOrchestrator', () => {
  const orchestrator = new AnalysisOrchestrator();

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
});
