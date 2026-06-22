import { Firestore } from '@google-cloud/firestore';
import { API_TOKENS_COLLECTION } from '#/db/firestore/const.js';
import { firestoreConfigSchema } from '#/db/firestore/schemas.js';
import type { FirestoreApiTokenDocument, FirestoreDatabaseConfig } from '#/db/firestore/types.js';
import { mapFirestoreApiToken } from '#/db/firestore/utils.js';
import type { IDatabase } from '#/db/IDatabase.js';
import type { ApiTokenRecord } from '#/db/types.js';
import { formatZodError } from '#/db/validation.js';

/**
 * Firestore-backed database implementation.
 */
export class FirestoreDatabase implements IDatabase {
  /**
   * Active Firestore client, or null when disconnected.
   */
  private client: Firestore | null = null;

  /**
   * Creates a Firestore database instance from validated config.
   *
   * @param config - Parsed Firestore connection settings.
   */
  constructor(private readonly config: FirestoreDatabaseConfig) { }

  /**
   * Validates raw config and constructs a {@link FirestoreDatabase}.
   *
   * @param config - Raw `db` section from server.yaml.
   * @returns Configured Firestore database instance.
   * @throws {Error} When config fails Firestore-specific validation.
   */
  static fromConfig(config: unknown): FirestoreDatabase {
    const parsed = firestoreConfigSchema.safeParse(config);
    if (!parsed.success) {
      throw new Error(formatZodError(parsed.error));
    }

    return new FirestoreDatabase({
      projectId: parsed.data.projectId,
      keyFilename: parsed.data.keyFilename
    });
  }

  /**
   * Opens a Firestore client and verifies connectivity by listing collections.
   */
  async connect(): Promise<void> {
    if (this.client) {
      return;
    }

    const client = new Firestore({
      projectId: this.config.projectId,
      keyFilename: this.config.keyFilename
    });

    await client.listCollections();

    this.client = client;
  }

  /**
   * Terminates the Firestore client and releases resources.
   */
  async disconnect(): Promise<void> {
    if (!this.client) {
      return;
    }

    await this.client.terminate();
    this.client = null;
  }

  /**
   * Firestore uses schemaless documents; no migration work is required.
   */
  async migrate(): Promise<void> {
    return;
  }

  /**
   * Inserts a new API token document.
   *
   * @param record - Token metadata to persist.
   */
  async createApiToken(record: ApiTokenRecord): Promise<void> {
    await this.requireClient().collection(API_TOKENS_COLLECTION).doc(record.id).set({
      name: record.name,
      tokenHash: record.tokenHash,
      tokenPrefix: record.tokenPrefix,
      createdAt: record.createdAt,
      lastUsedAt: record.lastUsedAt,
      revokedAt: record.revokedAt
    });
  }

  /**
   * Finds an active token by its stored hash.
   *
   * @param tokenHash - sha256 hex digest of the bearer token secret.
   */
  async findActiveApiTokenByHash(tokenHash: string): Promise<ApiTokenRecord | null> {
    const snapshot = await this.requireClient()
      .collection(API_TOKENS_COLLECTION)
      .where('tokenHash', '==', tokenHash)
      .limit(1)
      .get();

    const doc = snapshot.docs[0];
    if (!doc) {
      return null;
    }

    const data = doc.data() as FirestoreApiTokenDocument;
    if (data.revokedAt !== null) {
      return null;
    }

    return mapFirestoreApiToken(doc.id, data);
  }

  /**
   * Lists all API tokens ordered by creation time descending.
   */
  async listApiTokens(): Promise<ApiTokenRecord[]> {
    const snapshot = await this.requireClient()
      .collection(API_TOKENS_COLLECTION)
      .orderBy('createdAt', 'desc')
      .get();

    return snapshot.docs.map((doc) =>
      mapFirestoreApiToken(doc.id, doc.data() as FirestoreApiTokenDocument)
    );
  }

  /**
   * Soft-revokes an active token by id.
   *
   * @param id - Token identifier to revoke.
   */
  async revokeApiToken(id: string): Promise<boolean> {
    const docRef = this.requireClient().collection(API_TOKENS_COLLECTION).doc(id);
    const snapshot = await docRef.get();
    if (!snapshot.exists) {
      return false;
    }

    const data = snapshot.data() as FirestoreApiTokenDocument;
    if (data.revokedAt !== null) {
      return false;
    }

    await docRef.update({ revokedAt: new Date() });
    return true;
  }

  /**
   * Updates the last-used timestamp for a token.
   *
   * @param id - Token identifier that authenticated a request.
   * @param when - Timestamp of the authenticated request.
   */
  async touchApiTokenLastUsed(id: string, when: Date): Promise<void> {
    await this.requireClient()
      .collection(API_TOKENS_COLLECTION)
      .doc(id)
      .update({ lastUsedAt: when });
  }

  /**
   * Returns the active Firestore client or throws when connect has not been called.
   *
   * @returns Connected Firestore client.
   * @throws {Error} When the database is not connected.
   */
  private requireClient(): Firestore {
    if (!this.client) {
      throw new Error('Firestore database is not connected.');
    }

    return this.client;
  }
}
