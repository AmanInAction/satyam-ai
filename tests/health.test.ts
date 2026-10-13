import { describe, it, expect } from 'vitest';
import { GET } from '../app/api/v1/health/route';

describe('Health Route Handler', () => {
  it('returns HTTP 200 with service metadata and without exposing secrets', async () => {
    const response = await GET();
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.status).toBe('ok');
    expect(data.service).toBe('satyam-ai');
    expect(data.version).toBe('v1');
    expect(data.timestamp).toBeDefined();

    // Ensure no secret keys or environment variables leaked
    expect(data.apiKey).toBeUndefined();
    expect(data.secret).toBeUndefined();
    expect(data.env).toBeUndefined();
  });
});
