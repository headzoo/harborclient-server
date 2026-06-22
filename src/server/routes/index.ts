import type { FastifyInstance } from 'fastify';
import { registerHealthRoute } from '#/server/routes/health.js';

export interface RegisterRoutesOptions {
  /**
   * Application version reported by the health endpoint.
   */
  version: string;
}

/**
 * Registers all HTTP routes on the Fastify instance.
 *
 * @param app - Fastify server to attach routes to.
 * @param options - Shared route metadata such as app version.
 */
export async function registerRoutes(
  app: FastifyInstance,
  options: RegisterRoutesOptions
): Promise<void> {
  await registerHealthRoute(app, options.version);
}
