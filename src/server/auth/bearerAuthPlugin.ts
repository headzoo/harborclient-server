import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { IDatabase } from '#/db/IDatabase.js';
import type { ApiTokenRecord } from '#/db/types.js';
import type { UserRecord } from '#/db/types.js';
import { extractBearer, hashToken } from '#/server/auth/apiTokens.js';
import type { IThrottleStore } from '#/server/auth/throttle/IThrottleStore.js';

declare module 'fastify' {
  interface FastifyRequest {
    /**
     * Authenticated API token attached by the bearer auth hook on protected routes.
     */
    apiToken: ApiTokenRecord | null;

    /**
     * User account owning the authenticated API token.
     */
    user: UserRecord | null;
  }
}

/**
 * Registers the auth-related request decorators used by protected route handlers.
 *
 * @param app - Fastify instance or encapsulated scope to decorate.
 */
export function registerBearerAuthDecorator(app: FastifyInstance): void {
  app.decorateRequest('apiToken', null);
  app.decorateRequest('user', null);
}

/**
 * Builds the throttle key for a request from client IP and bearer token material.
 *
 * Raw token secrets are hashed before inclusion in the key.
 *
 * @param request - Incoming HTTP request.
 * @param token - Raw bearer token, or null when missing.
 * @returns Throttle key in the form `{ip}:{tokenHash|none}`.
 */
export function buildAuthThrottleKey(request: FastifyRequest, token: string | null): string {
  const tokenPart = token ? hashToken(token) : 'none';
  return `${request.ip}:${tokenPart}`;
}

/**
 * Builds an onRequest hook that validates bearer tokens against the database.
 *
 * @param db - Database used to resolve active token hashes and owning users.
 * @param throttleStore - Redis-backed store for failed auth throttling.
 * @returns Hook that rejects unauthenticated requests with HTTP 401.
 */
export function createBearerAuthHook(db: IDatabase, throttleStore: IThrottleStore) {
  /**
   * Validates Authorization: Bearer and attaches the matching token and user.
   *
   * @param request - Incoming HTTP request.
   * @param reply - Fastify reply used to short-circuit unauthorized requests.
   */
  return async function bearerAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const policy = throttleStore.getPolicy();
    const token = extractBearer(request.headers.authorization);
    const throttleKey = buildAuthThrottleKey(request, token);

    try {
      if (await throttleStore.isBlocked(throttleKey)) {
        return reply
          .header('Retry-After', String(policy.blockSeconds))
          .code(429)
          .send({ error: 'Too Many Requests' });
      }
    } catch {
      return reply.code(503).send({ error: 'Service Unavailable' });
    }

    if (!token) {
      try {
        await throttleStore.recordFailure(throttleKey);
      } catch {
        return reply.code(503).send({ error: 'Service Unavailable' });
      }

      return reply.header('WWW-Authenticate', 'Bearer').code(401).send({ error: 'Unauthorized' });
    }

    const record = await db.findActiveApiTokenByHash(hashToken(token));
    if (!record) {
      try {
        await throttleStore.recordFailure(throttleKey);
      } catch {
        return reply.code(503).send({ error: 'Service Unavailable' });
      }

      return reply.header('WWW-Authenticate', 'Bearer').code(401).send({ error: 'Unauthorized' });
    }

    const user = await db.findUserById(record.userId);
    if (!user) {
      try {
        await throttleStore.recordFailure(throttleKey);
      } catch {
        return reply.code(503).send({ error: 'Service Unavailable' });
      }

      return reply.header('WWW-Authenticate', 'Bearer').code(401).send({ error: 'Unauthorized' });
    }

    try {
      await throttleStore.reset(throttleKey);
    } catch {
      return reply.code(503).send({ error: 'Service Unavailable' });
    }

    request.apiToken = record;
    request.user = user;
    void db.touchApiTokenLastUsed(record.id, new Date()).catch(() => undefined);
  };
}
