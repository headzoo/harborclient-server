import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createPoolMock } = vi.hoisted(() => ({
  createPoolMock: vi.fn()
}));

vi.mock('mysql2/promise', () => ({
  default: {
    createPool: createPoolMock
  }
}));

import { MysqlDatabase } from '#/db/MysqlDatabase.js';

const validConfig = {
  driver: 'mysql',
  host: '127.0.0.1',
  port: 3306,
  user: 'harbor',
  password: 'harbor',
  database: 'harbor'
};

/**
 * Builds a mock MySQL pool for lifecycle tests.
 *
 * @returns Mock pool with spied getConnection and end methods.
 */
function createMockPool() {
  const connection = {
    ping: vi.fn().mockResolvedValue(undefined),
    release: vi.fn()
  };

  return {
    getConnection: vi.fn().mockResolvedValue(connection),
    end: vi.fn().mockResolvedValue(undefined),
    connection
  };
}

beforeEach(() => {
  createPoolMock.mockReset();
});

describe('MysqlDatabase.fromConfig', () => {
  it('accepts valid config', () => {
    const db = MysqlDatabase.fromConfig(validConfig);

    expect(db).toBeInstanceOf(MysqlDatabase);
  });

  it('accepts port as a string', () => {
    const db = MysqlDatabase.fromConfig({
      ...validConfig,
      port: '3306'
    });

    expect(db).toBeInstanceOf(MysqlDatabase);
  });

  it('throws when host is missing', () => {
    expect(() =>
      MysqlDatabase.fromConfig({
        driver: 'mysql',
        port: 3306,
        user: 'harbor',
        password: 'harbor',
        database: 'harbor'
      })
    ).toThrow();
  });

  it('throws when driver does not match', () => {
    expect(() =>
      MysqlDatabase.fromConfig({
        ...validConfig,
        driver: 'postgres'
      })
    ).toThrow();
  });
});

describe('MysqlDatabase lifecycle', () => {
  it('creates a pool, verifies connectivity, and closes on disconnect', async () => {
    const pool = createMockPool();
    createPoolMock.mockReturnValue(pool);
    const db = MysqlDatabase.fromConfig(validConfig);

    await db.connect();

    expect(createPoolMock).toHaveBeenCalledWith({
      host: '127.0.0.1',
      port: 3306,
      user: 'harbor',
      password: 'harbor',
      database: 'harbor'
    });
    expect(pool.getConnection).toHaveBeenCalledOnce();
    expect(pool.connection.ping).toHaveBeenCalledOnce();
    expect(pool.connection.release).toHaveBeenCalledOnce();

    await db.disconnect();

    expect(pool.end).toHaveBeenCalledOnce();
  });

  it('is idempotent when connect is called more than once', async () => {
    const pool = createMockPool();
    createPoolMock.mockReturnValue(pool);
    const db = MysqlDatabase.fromConfig(validConfig);

    await db.connect();
    await db.connect();

    expect(createPoolMock).toHaveBeenCalledOnce();
    expect(pool.getConnection).toHaveBeenCalledOnce();
  });

  it('is safe to call disconnect when not connected', async () => {
    const db = MysqlDatabase.fromConfig(validConfig);

    await expect(db.disconnect()).resolves.toBeUndefined();
  });
});
