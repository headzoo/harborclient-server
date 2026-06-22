import { describe, expect, it } from 'vitest';
import { createStubDatabase } from '#/db/stubDatabase.js';
import { authHeader, createProtectedTestApp } from '#/server/routes/test/createTestApp.js';

const sampleEnvironment = {
  id: 'env-1',
  name: 'Production',
  variables: [],
  createdAt: new Date('2026-01-02T00:00:00.000Z')
};

describe('environment routes', () => {
  it('lists environments with a valid bearer token', async () => {
    const db = createStubDatabase();
    db.listEnvironments.mockResolvedValue([sampleEnvironment]);
    const app = await createProtectedTestApp({ db, withValidAuth: true });

    const response = await app.inject({
      method: 'GET',
      url: '/environments',
      headers: authHeader()
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      environments: [
        {
          ...sampleEnvironment,
          createdAt: sampleEnvironment.createdAt.toISOString()
        }
      ]
    });

    await app.close();
  });

  it('creates an environment with a valid bearer token', async () => {
    const db = createStubDatabase();
    db.createEnvironment.mockResolvedValue(sampleEnvironment);
    const app = await createProtectedTestApp({ db, withValidAuth: true });

    const response = await app.inject({
      method: 'POST',
      url: '/environments',
      headers: authHeader(),
      payload: { name: 'Production' }
    });

    expect(response.statusCode).toBe(200);
    expect(db.createEnvironment).toHaveBeenCalledWith('Production');
    expect(response.json().id).toBe('env-1');

    await app.close();
  });
});
