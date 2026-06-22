import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/cli.ts'],
  format: ['esm'],
  target: 'node24',
  clean: true,
  sourcemap: true,
  external: ['commander', 'fastify', 'fastify-type-provider-zod', 'yaml', 'zod'],
  banner: {
    js: '#!/usr/bin/env node'
  }
});
