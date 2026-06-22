import { describe, expect, it } from 'vitest';
import { createServer } from '#/server/createServer.js';

describe('GET /health', () => {
  it('returns ok status and version', async () => {
    const app = await createServer(
      {
        host: '127.0.0.1',
        port: 8787,
        db: { driver: 'postgres' }
      },
      { version: '0.1.0' }
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
