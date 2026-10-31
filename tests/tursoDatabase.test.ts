import { afterEach, describe, expect, it } from 'vitest';
import { TursoDatabase } from '../src/lib/db/tursoDatabase';

const originalUrl = process.env.TURSO_DATABASE_URL;
const originalToken = process.env.TURSO_AUTH_TOKEN;

afterEach(() => {
  if (originalUrl === undefined) delete process.env.TURSO_DATABASE_URL;
  else process.env.TURSO_DATABASE_URL = originalUrl;
  if (originalToken === undefined) delete process.env.TURSO_AUTH_TOKEN;
  else process.env.TURSO_AUTH_TOKEN = originalToken;
});

describe('Turso production database configuration', () => {
  it('fails explicitly when production credentials are missing', async () => {
    delete process.env.TURSO_DATABASE_URL;
    delete process.env.TURSO_AUTH_TOKEN;

    await expect(new TursoDatabase().getSession('session-token'))
      .rejects.toThrow('TURSO_DATABASE_URL and TURSO_AUTH_TOKEN are required');
  });
});
