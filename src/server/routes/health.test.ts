import { describe, expect, it, vi } from 'vitest';
import type { IDatabase } from '#/db/IDatabase.js';
import { createServer } from '#/server/createServer.js';

/**
 * Builds a minimal database stub for route tests.
 *
 * @returns Mock database with no-op lifecycle methods.
 */
function createStubDatabase(): IDatabase {
  return {
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    migrate: vi.fn().mockResolvedValue(undefined),
    createApiToken: vi.fn().mockResolvedValue(undefined),
    findActiveApiTokenByHash: vi.fn().mockResolvedValue(null),
    listApiTokens: vi.fn().mockResolvedValue([]),
    revokeApiToken: vi.fn().mockResolvedValue(false),
    touchApiTokenLastUsed: vi.fn().mockResolvedValue(undefined)
  };
}

describe('GET /health', () => {
  it('returns ok status and version without authentication', async () => {
    const app = await createServer(
      {
        host: '127.0.0.1',
        port: 8787,
        db: { driver: 'postgres' }
      },
      { version: '0.1.0', db: createStubDatabase() }
    );

    const response = await app.inject({
      method: 'GET',
      url: '/health'
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: 'ok',
      version: '0.1.0'
    });

    await app.close();
  });
});
