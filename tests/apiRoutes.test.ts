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
  });
});
