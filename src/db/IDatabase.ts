import type { ApiTokenRecord } from '#/db/types.js';

/**
 * Common contract for HarborClient server database backends.
 */
export interface IDatabase {
  /**
   * Opens a connection pool or client to the configured database.
   */
  connect(): Promise<void>;

  /**
   * Closes open connections and releases resources.
   */
  disconnect(): Promise<void>;

  /**
   * Creates required tables or indexes when absent.
   *
   * SQL backends run DDL; Firestore treats schema as implicit and performs no work.
   */
  migrate(): Promise<void>;

  /**
   * Persists a newly generated API token record.
   *
   * @param record - Token metadata including the stored hash (not the raw secret).
   */
  createApiToken(record: ApiTokenRecord): Promise<void>;

  /**
   * Looks up a non-revoked token by its sha256 hash for request authentication.
   *
   * @param tokenHash - sha256 hex digest of the bearer token secret.
   * @returns Matching active token record, or null when not found or revoked.
   */
  findActiveApiTokenByHash(tokenHash: string): Promise<ApiTokenRecord | null>;

  /**
   * Returns all API token records ordered newest-first for operator listing.
   */
  listApiTokens(): Promise<ApiTokenRecord[]>;

  /**
   * Soft-revokes a token by id.
   *
   * @param id - Token identifier to revoke.
   * @returns True when an active token was updated; false when already revoked or missing.
   */
  revokeApiToken(id: string): Promise<boolean>;

  /**
   * Updates the last-used timestamp for a token after successful authentication.
   *
   * @param id - Token identifier that authenticated the request.
   * @param when - Timestamp of the authenticated request.
   */
  touchApiTokenLastUsed(id: string, when: Date): Promise<void>;
}
