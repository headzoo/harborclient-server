import type { ApiTokenRecord } from '#/db/types.js';
import type { FirestoreApiTokenDocument } from '#/db/firestore/types.js';

/**
 * Maps a Firestore document to the shared {@link ApiTokenRecord} shape.
 *
 * @param id - Document identifier.
 * @param data - Stored token fields.
 * @returns Normalized token record for application code.
 */
export function mapFirestoreApiToken(id: string, data: FirestoreApiTokenDocument): ApiTokenRecord {
  return {
    id,
    name: data.name,
    tokenHash: data.tokenHash,
    tokenPrefix: data.tokenPrefix,
    createdAt: data.createdAt,
    lastUsedAt: data.lastUsedAt,
    revokedAt: data.revokedAt
  };
}
