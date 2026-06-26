import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import type { PluginsConfig } from '#/config/pluginsConfig.js';
import { pluginSourcesResponseSchema } from '#/server/routes/schemas/plugins.js';

/**
 * Options for registering plugin source routes.
 */
export interface RegisterPluginsRoutesOptions {
  /**
   * Returns the current normalized plugin source configuration from server.yaml.
   */
  getPlugins: () => PluginsConfig | null;
}

/**
 * Registers bearer-protected plugin source routes.
 *
 * @param app - Encapsulated Fastify scope with auth applied.
 * @param options - Plugin source configuration from server.yaml.
 */
export async function registerPluginsRoutes(
  app: FastifyInstance,
  options: RegisterPluginsRoutesOptions
): Promise<void> {
  const routes = app.withTypeProvider<ZodTypeProvider>();

  routes.route({
    method: 'GET',
    url: '/plugins/sources',
    schema: {
      response: {
        200: pluginSourcesResponseSchema
      }
    },
    /**
     * Returns plugin catalog and trusted-publisher URLs configured on this Team Hub.
     */
    handler: async (_request, reply) => {
      const plugins = options.getPlugins();
      if (!plugins) {
        return reply.send({
          catalogs: [],
          trusted: []
        });
      }

      return reply.send({
        catalogs: plugins.catalogs,
        trusted: plugins.trusted
      });
    }
  });
}
