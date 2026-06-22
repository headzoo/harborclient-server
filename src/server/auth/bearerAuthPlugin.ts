import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { IDatabase } from '#/db/IDatabase.js';
import type { ApiTokenRecord } from '#/db/types.js';
import { extractBearer, hashToken } from '#/server/auth/apiTokens.js';

declare module 'fastify' {
  interface FastifyRequest {
    /**
     * Authenticated API token attached by the bearer auth hook on protected routes.
     */
    apiToken: ApiTokenRecord | null;
  }
}

/**
 * Registers the `apiToken` request decorator used by protected route handlers.
 *
 * @param app - Fastify instance or encapsulated scope to decorate.
 */
export function registerBearerAuthDecorator(app: FastifyInstance): void {
  app.decorateRequest('apiToken', null);
}

/**
 * Builds an onRequest hook that validates bearer tokens against the database.
 *
 * @param db - Database used to resolve active token hashes.
 * @returns Hook that rejects unauthenticated requests with HTTP 401.
 */
export function createBearerAuthHook(db: IDatabase) {
  /**
   * Validates Authorization: Bearer and attaches the matching token record.
   *
   * @param request - Incoming HTTP request.
   * @param reply - Fastify reply used to short-circuit unauthorized requests.
   */
  return async function bearerAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const token = extractBearer(request.headers.authorization);
    if (!token) {
      return reply.header('WWW-Authenticate', 'Bearer').code(401).send({ error: 'Unauthorized' });
    }

    const record = await db.findActiveApiTokenByHash(hashToken(token));
    if (!record) {
      return reply.header('WWW-Authenticate', 'Bearer').code(401).send({ error: 'Unauthorized' });
    }

    request.apiToken = record;
    void db.touchApiTokenLastUsed(record.id, new Date()).catch(() => undefined);
  };
}
