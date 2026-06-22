/**
 * Stored metadata for a database-backed API bearer token.
 *
 * The raw secret is never persisted; only its sha256 hash is stored for lookup.
 */
export interface ApiTokenRecord {
  /**
   * Stable identifier used for revoke and audit operations.
   */
  id: string;

  /**
   * Human-readable label chosen when the token was created.
   */
  name: string;

  /**
   * sha256 hex digest of the bearer token secret.
   */
  tokenHash: string;

  /**
   * Non-secret prefix shown in listings (for example `hbk_AbCd1234`).
   */
  tokenPrefix: string;

  /**
   * When the token was created.
   */
  createdAt: Date;

  /**
   * When the token was last used to authenticate a request, if ever.
   */
  lastUsedAt: Date | null;

  /**
   * When the token was revoked; null means the token is still active.
   */
  revokedAt: Date | null;
}
