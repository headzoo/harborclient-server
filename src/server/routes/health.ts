import { z } from 'zod/v4';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';

/**
 * Response body schema for `GET /health`.
 */
export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  version: z.string()
});

/**
 * Registers the health check route used by probes and desktop client connectivity checks.
 *
 * @param app - Fastify server instance.
 * @param version - Application version included in the JSON response.
 */
export async function registerHealthRoute(app: FastifyInstance, version: string): Promise<void> {
  app.withTypeProvider<ZodTypeProvider>().route({
    method: 'GET',
    url: '/health',
    schema: {
      response: {
        200: healthResponseSchema
      }
    },
    /**
     * Returns the standard health payload for load balancers and client pings.
     */
    handler: async (_request, reply) => {
      return reply.send({
        status: 'ok' as const,
        version
      });
    }
  });
}
