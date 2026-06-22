import { z } from 'zod/v4';

const portSchema = z.union([
  z
    .number()
    .int({ message: 'Port must be an integer between 1 and 65535.' })
    .min(1, { message: 'Port must be an integer between 1 and 65535.' })
    .max(65535, { message: 'Port must be an integer between 1 and 65535.' }),
  z
    .string()
    .regex(/^\d+$/, { message: 'Port must be an integer between 1 and 65535.' })
    .transform(Number)
    .pipe(
      z
        .number()
        .int({ message: 'Port must be an integer between 1 and 65535.' })
        .min(1, { message: 'Port must be an integer between 1 and 65535.' })
        .max(65535, { message: 'Port must be an integer between 1 and 65535.' })
    )
]);

/**
 * Zod schema for the `server` section of the config file (host and port).
 */
export const serverSectionSchema = z.object({
  port: portSchema,
  host: z.string().trim().min(1, { message: 'Host must not be empty.' })
});

/**
 * Zod schema for the `db` section of the config file (driver discriminant only).
 *
 * Driver-specific fields are validated by each database implementation.
 */
export const dbSectionSchema = z
  .object({
    driver: z.string().trim().min(1, { message: 'Database driver must not be empty.' })
  })
  .loose();

/**
 * Zod schema for the full server config document (`server.yaml` root mapping).
 */
export const serverConfigDocumentSchema = z.object({
  server: serverSectionSchema,
  db: dbSectionSchema
});

/**
 * Validated shape of a parsed server config YAML file.
 */
export type ServerConfigDocument = z.infer<typeof serverConfigDocumentSchema>;
