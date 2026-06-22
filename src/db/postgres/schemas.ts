import { z } from 'zod/v4';

/**
 * Zod schema for validating Postgres port values from server.yaml.
 */
export const portSchema = z.union([
  z
    .number()
    .int({ message: 'Postgres port must be an integer between 1 and 65535.' })
    .min(1, { message: 'Postgres port must be an integer between 1 and 65535.' })
    .max(65535, { message: 'Postgres port must be an integer between 1 and 65535.' }),
  z
    .string()
    .regex(/^\d+$/, { message: 'Postgres port must be an integer between 1 and 65535.' })
    .transform(Number)
    .pipe(
      z
        .number()
        .int({ message: 'Postgres port must be an integer between 1 and 65535.' })
        .min(1, { message: 'Postgres port must be an integer between 1 and 65535.' })
        .max(65535, { message: 'Postgres port must be an integer between 1 and 65535.' })
    )
]);

/**
 * Zod schema for validating raw Postgres database config from server.yaml.
 */
export const postgresConfigSchema = z.object({
  driver: z.literal('postgres'),
  host: z.string().trim().min(1, { message: 'Postgres host must not be empty.' }),
  port: portSchema,
  user: z.string().trim().min(1, { message: 'Postgres user must not be empty.' }),
  password: z.string(),
  database: z.string().trim().min(1, { message: 'Postgres database must not be empty.' })
});
