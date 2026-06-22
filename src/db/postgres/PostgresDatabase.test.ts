import { beforeEach, describe, expect, it, vi } from 'vitest';

const { PoolMock } = vi.hoisted(() => {
  /**
   * Mock Postgres Pool constructor used by {@link PostgresDatabase}.
   */
  class MockPool {
    /**
     * Borrowed client used to verify connectivity during connect.
     */
    client = {
      query: vi.fn().mockResolvedValue(undefined),
      release: vi.fn()
    };

    connect = vi.fn().mockImplementation(async () => this.client);
    query = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
    end = vi.fn().mockResolvedValue(undefined);

    /**
     * Captures pool construction config for assertions.
     *
     * @param config - Connection settings passed to the pool constructor.
     */
    constructor(public readonly config: unknown) {}
  }

  return {
    PoolMock: vi.fn(MockPool)
  };
});

vi.mock('pg', () => ({
  default: {
    Pool: PoolMock
  }
}));

import { PostgresDatabase } from '#/db/postgres/PostgresDatabase.js';

const validConfig = {
  driver: 'postgres',
  host: '127.0.0.1',
  port: 5432,
  user: 'harbor',
  password: 'harbor',
  database: 'harbor'
};

beforeEach(() => {
  PoolMock.mockClear();
});

describe('PostgresDatabase.fromConfig', () => {
  it('accepts valid config', () => {
    const db = PostgresDatabase.fromConfig(validConfig);

    expect(db).toBeInstanceOf(PostgresDatabase);
  });

  it('accepts port as a string', () => {
    const db = PostgresDatabase.fromConfig({
      ...validConfig,
      port: '5432'
    });

    expect(db).toBeInstanceOf(PostgresDatabase);
  });

  it('throws when database is missing', () => {
    expect(() =>
      PostgresDatabase.fromConfig({
        driver: 'postgres',
        host: '127.0.0.1',
        port: 5432,
        user: 'harbor',
        password: 'harbor'
      })
    ).toThrow();
  });

  it('throws when driver does not match', () => {
    expect(() =>
      PostgresDatabase.fromConfig({
        ...validConfig,
        driver: 'mysql'
      })
    ).toThrow();
  });
});

describe('PostgresDatabase lifecycle', () => {
  it('creates a pool, verifies connectivity, and closes on disconnect', async () => {
    const db = PostgresDatabase.fromConfig(validConfig);

    await db.connect();

    expect(PoolMock).toHaveBeenCalledWith({
      host: '127.0.0.1',
      port: 5432,
      user: 'harbor',
      password: 'harbor',
      database: 'harbor'
    });

    const pool = PoolMock.mock.instances[0];
    expect(pool).toBeDefined();
    expect(pool.connect).toHaveBeenCalledOnce();
    expect(pool.client.query).toHaveBeenCalledWith('SELECT 1');
    expect(pool.client.release).toHaveBeenCalledOnce();

    await db.disconnect();

    expect(pool.end).toHaveBeenCalledOnce();
  });

  it('is idempotent when connect is called more than once', async () => {
    const db = PostgresDatabase.fromConfig(validConfig);

    await db.connect();
    await db.connect();

    expect(PoolMock).toHaveBeenCalledOnce();

    const pool = PoolMock.mock.instances[0];
    expect(pool.connect).toHaveBeenCalledOnce();
  });

  it('is safe to call disconnect when not connected', async () => {
    const db = PostgresDatabase.fromConfig(validConfig);

    await expect(db.disconnect()).resolves.toBeUndefined();
  });
});

describe('PostgresDatabase api tokens', () => {
  it('runs migrate SQL against the pool', async () => {
    const db = PostgresDatabase.fromConfig(validConfig);

    await db.connect();
    await db.migrate();

    const pool = PoolMock.mock.instances[0];
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('CREATE TABLE IF NOT EXISTS api_tokens'),
      []
    );

    await db.disconnect();
  });

  it('throws when api token methods are called before connect', async () => {
    const db = PostgresDatabase.fromConfig(validConfig);

    await expect(
      db.createApiToken({
        id: 'id',
        name: 'name',
        tokenHash: 'hash',
        tokenPrefix: 'prefix',
        createdAt: new Date(),
        lastUsedAt: null,
        revokedAt: null
      })
    ).rejects.toThrow('Postgres database is not connected.');
  });
});
