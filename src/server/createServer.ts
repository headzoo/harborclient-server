import { readFileSync } from 'node:fs';
import Fastify, { type FastifyInstance } from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider
} from 'fastify-type-provider-zod';
import type { ServerConfig } from '#/config/serverConfig.js';
import type { IDatabase } from '#/db/IDatabase.js';
import { registerRoutes } from '#/server/routes/index.js';

export interface CreateServerOptions {
  /**
   * When true, enables Fastify's built-in request logger.
   */
  verbose?: boolean;

  /**
   * Package version exposed on the health endpoint (defaults to package.json).
   */
  version?: string;

  /**
   * Database used for bearer token validation on protected routes.
   */
  db: IDatabase;
}

/**
 * Reads the package version from the nearest package.json.
 *
 * @returns Semantic version string from package.json.
 */
function readPackageVersion(): string {
  const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as {
    version: string;
  };
  return pkg.version;
}

/**
 * Builds a configured Fastify instance with Zod validation and registered routes.
 *
 * Does not call `listen`; use {@link runServer} or test inject for that.
 *
 * @param _config - Server bind settings (reserved for future route/plugin use).
 * @param options - Logger, version, and database overrides.
 * @returns Fastify app with type provider and routes attached.
 */
export async function createServer(
  _config: ServerConfig,
  options: CreateServerOptions
): Promise<FastifyInstance> {
  const app = Fastify({
    logger: options.verbose ?? false
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await registerRoutes(app, {
    version: options.version ?? readPackageVersion(),
    db: options.db
  });

  return app;
}
