import { beforeEach, describe, expect, it, vi } from 'vitest';

const { FirestoreMock } = vi.hoisted(() => {
  /**
   * Mock Firestore client constructor used by {@link FirestoreDatabase}.
   */
  class MockFirestore {
    listCollections = vi.fn().mockResolvedValue([]);
    terminate = vi.fn().mockResolvedValue(undefined);

    /**
     * Captures Firestore construction config for assertions.
     *
     * @param config - Client settings passed to the Firestore constructor.
     */
    constructor(public readonly config: unknown) { }
  }

  return {
    FirestoreMock: vi.fn(MockFirestore)
  };
});

vi.mock('@google-cloud/firestore', () => ({
  Firestore: FirestoreMock
}));

import { FirestoreDatabase } from '#/db/FirestoreDatabase.js';

beforeEach(() => {
  FirestoreMock.mockClear();
});

describe('FirestoreDatabase.fromConfig', () => {
  it('accepts valid config', () => {
    const db = FirestoreDatabase.fromConfig({
      driver: 'firestore',
      projectId: 'my-project'
    });

    expect(db).toBeInstanceOf(FirestoreDatabase);
  });

  it('accepts optional keyFilename', () => {
    const db = FirestoreDatabase.fromConfig({
      driver: 'firestore',
      projectId: 'my-project',
      keyFilename: '/path/to/key.json'
    });

    expect(db).toBeInstanceOf(FirestoreDatabase);
  });

  it('throws when projectId is missing', () => {
    expect(() =>
      FirestoreDatabase.fromConfig({
        driver: 'firestore'
      })
    ).toThrow();
  });

  it('throws when driver does not match', () => {
    expect(() =>
      FirestoreDatabase.fromConfig({
        driver: 'mysql',
        projectId: 'my-project'
      })
    ).toThrow();
  });
});

describe('FirestoreDatabase lifecycle', () => {
  it('creates a client, verifies connectivity, and terminates on disconnect', async () => {
    const db = FirestoreDatabase.fromConfig({
      driver: 'firestore',
      projectId: 'my-project',
      keyFilename: '/path/to/key.json'
    });

    await db.connect();

    expect(FirestoreMock).toHaveBeenCalledWith({
      projectId: 'my-project',
      keyFilename: '/path/to/key.json'
    });

    const client = FirestoreMock.mock.instances[0];
    expect(client).toBeDefined();
    expect(client.listCollections).toHaveBeenCalledOnce();

    await db.disconnect();

    expect(client.terminate).toHaveBeenCalledOnce();
  });

  it('is idempotent when connect is called more than once', async () => {
    const db = FirestoreDatabase.fromConfig({
      driver: 'firestore',
      projectId: 'my-project'
    });

    await db.connect();
    await db.connect();

    expect(FirestoreMock).toHaveBeenCalledOnce();

    const client = FirestoreMock.mock.instances[0];
    expect(client.listCollections).toHaveBeenCalledOnce();
  });

  it('is safe to call disconnect when not connected', async () => {
    const db = FirestoreDatabase.fromConfig({
      driver: 'firestore',
      projectId: 'my-project'
    });

    await expect(db.disconnect()).resolves.toBeUndefined();
  });
});
