import type { FastifyReply } from 'fastify';
import { errorResponseSchema } from '#/server/routes/schemas/common.js';

/**
 * Maps known database-layer errors to HTTP responses.
 *
 * @param reply - Fastify reply used to send error payloads.
 * @param error - Thrown error from an {@link IDatabase} operation.
 * @returns True when the error was handled and a response was sent.
 */
export function handleDbError(reply: FastifyReply, error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  if (error.message.includes('is required')) {
    void reply.code(400).send(errorResponseSchema.parse({ error: error.message }));
    return true;
  }

  if (error.message.toLowerCase().includes('not found')) {
    void reply.code(404).send(errorResponseSchema.parse({ error: error.message }));
    return true;
  }

  return false;
}
