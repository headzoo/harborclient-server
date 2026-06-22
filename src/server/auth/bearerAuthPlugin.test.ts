import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';
import type { IDatabase } from '#/db/IDatabase.js';
import type { ApiTokenRecord } from '#/db/types.js';
import { hashToken } from '#/server/auth/apiTokens.js';
import {
  createBearerAuthHook,
  registerBearerAuthDecorator
} from '#/server/auth/bearerAuthPlugin.js';

const sampleRecord: ApiTokenRecord = {
  id: 'token-1',
  name: 'Test token',
  tokenHash: hashToken('hbk_valid-token'),
  tokenPrefix: 'hbk_valid-',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  lastUsedAt: null,
  revokedAt: null
};

/**
 * Builds a stub database for bearer auth integration tests.
 *
 * @param record - Active token returned by hash lookup, or null when invalid.
 * @returns Mock database implementing token lookup and touch methods.
 */
function createAuthDb(record: ApiTokenRecord | null): IDatabase {
  return {
    connect: vi.fn(),
    disconnect: vi.fn(),
    migrate: vi.fn(),
    createApiToken: vi.fn(),
    findActiveApiTokenByHash: vi.fn().mockResolvedValue(record),
    listApiTokens: vi.fn(),
    revokeApiToken: vi.fn(),
    touchApiTokenLastUsed: vi.fn().mockResolvedValue(undefined)
  };
}

/**
 * Creates a Fastify app with one protected route behind bearer auth.
 *
 * @param db - Database stub used by the auth hook.
 * @returns Listening-ready Fastify instance with GET /protected.
 */
async function createProtectedApp(db: IDatabase) {
  const app = Fastify();

  await app.register(async (protectedApp) => {
    registerBearerAuthDecorator(protectedApp);
    protectedApp.addHook('onRequest', createBearerAuthHook(db));
    protectedApp.get('/protected', async () => ({ ok: true }));
  });

  return app;
}

describe('createBearerAuthHook', () => {
  it('returns 401 when Authorization header is missing', async () => {
    const app = await createProtectedApp(createAuthDb(sampleRecord));

    const response = await app.inject({
      method: 'GET',
      url: '/protected'
    });

    expect(response.statusCode).toBe(401);
    expect(response.headers['www-authenticate']).toBe('Bearer');
    expect(response.json()).toEqual({ error: 'Unauthorized' });

    await app.close();
  });

  it('returns 401 when the bearer token is invalid', async () => {
    const app = await createProtectedApp(createAuthDb(null));

    const response = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: {
        authorization: 'Bearer hbk_invalid'
      }
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: 'Unauthorized' });

    await app.close();
  });

  it('allows requests with a valid bearer token', async () => {
    const db = createAuthDb(sampleRecord);
    const app = await createProtectedApp(db);

    const response = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: {
        authorization: 'Bearer hbk_valid-token'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });
    expect(db.findActiveApiTokenByHash).toHaveBeenCalledWith(sampleRecord.tokenHash);
    expect(db.touchApiTokenLastUsed).toHaveBeenCalledWith(sampleRecord.id, expect.any(Date));

    await app.close();
  });
});
