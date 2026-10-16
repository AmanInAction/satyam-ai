import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as handleTextAnalyze } from '../app/api/v1/analyze/text/route';
import { POST as handleUrlAnalyze } from '../app/api/v1/analyze/url/route';

describe('Route Handlers API Contract', () => {
  it('rejects invalid JSON with standardized error envelope', async () => {
    const req = new NextRequest('http://localhost:3000/api/v1/analyze/text', {
      method: 'POST',
      body: 'invalid-json',
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await handleTextAnalyze(req);
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.error).toBeDefined();
    expect(data.error.code).toBe('INVALID_JSON');
    expect(data.error.request_id).toMatch(/^req_/);
  });

  it('rejects empty text with 400 and validation details', async () => {
    const req = new NextRequest('http://localhost:3000/api/v1/analyze/text', {
      method: 'POST',
      body: JSON.stringify({ text: '  ' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await handleTextAnalyze(req);
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.error.code).toBe('INVALID_INPUT');
    expect(data.error.message).toContain('Text cannot be empty');
  });

  it('successfully analyzes valid text and returns schema-compliant response with dual classification', async () => {
    const req = new NextRequest('http://localhost:3000/api/v1/analyze/text', {
      method: 'POST',
      body: JSON.stringify({ text: 'Urgent: account suspended. Pay fee now.' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await handleTextAnalyze(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.analysis_id).toBeDefined();
    expect(data.input_type).toBe('text');
    expect(data.classification).toBeDefined();
    expect(data.classification.scam_risk).toBeDefined();
    expect(data.classification.claim_verification).toBeDefined();
    expect(data.classification.scam_risk.verdict).toBe('likely_scam');
    expect(data.classification.claim_verification.verdict).toBe('unverified');
    expect(Array.isArray(data.reasons)).toBe(true);
    expect(data.provider_status).toBeDefined();
  });

  it('rejects invalid protocol in URL analysis', async () => {
    const req = new NextRequest('http://localhost:3000/api/v1/analyze/url', {
      method: 'POST',
      body: JSON.stringify({ url: 'ftp://ftp.example.com/files' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await handleUrlAnalyze(req);
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.error.code).toBe('INVALID_INPUT');
  });

  it('successfully analyzes valid URL and returns dual classification', async () => {
    const req = new NextRequest('http://localhost:3000/api/v1/analyze/url', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://example.com' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await handleUrlAnalyze(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.input_type).toBe('url');
    expect(data.classification).toBeDefined();
    expect(data.classification.scam_risk.verdict).toBe('no_obvious_risk_found');
    expect(data.classification.claim_verification.verdict).toBe('unverified');
    expect(Array.isArray(data.evidence)).toBe(true);
    expect(data.checks_performed).toContain('url_normalization_ssrf_guard');
  });

  it('rejects SSRF loopback address with 400 and SSRF_BLOCKED code', async () => {
    const req = new NextRequest('http://localhost:3000/api/v1/analyze/url', {
      method: 'POST',
      body: JSON.stringify({ url: 'http://127.0.0.1:8080/admin' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await handleUrlAnalyze(req);
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.error.code).toBe('SSRF_BLOCKED');
    expect(data.error.message).toContain('SSRF protection');
  });

  it('rejects cloud metadata IP address with 400 and SSRF_BLOCKED code', async () => {
    const req = new NextRequest('http://localhost:3000/api/v1/analyze/url', {
      method: 'POST',
      body: JSON.stringify({ url: 'http://169.254.169.254/latest/meta-data' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await handleUrlAnalyze(req);
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.error.code).toBe('SSRF_BLOCKED');
  });

  it('identifies deceptive brand spoofing URL as likely_scam via API', async () => {
    const req = new NextRequest('http://localhost:3000/api/v1/analyze/url', {
      method: 'POST',
      body: JSON.stringify({ url: 'http://sbi-yono-update.top/login' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await handleUrlAnalyze(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.classification.scam_risk.verdict).toBe('likely_scam');
    expect(data.classification.scam_risk.risk_level).toBe('high');
    expect(data.reasons.some((r: any) => r.code === 'brand_impersonation_in_domain')).toBe(true);
  });
});
