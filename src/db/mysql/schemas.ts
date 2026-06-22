import { z } from 'zod/v4';

/**
 * Zod schema for validating MySQL port values from server.yaml.
 */
export const portSchema = z.union([
  z
    .number()
    .int({ message: 'MySQL port must be an integer between 1 and 65535.' })
    .min(1, { message: 'MySQL port must be an integer between 1 and 65535.' })
    .max(65535, { message: 'MySQL port must be an integer between 1 and 65535.' }),
  z
    .string()
    .regex(/^\d+$/, { message: 'MySQL port must be an integer between 1 and 65535.' })
    .transform(Number)
    .pipe(
      z
        .number()
        .int({ message: 'MySQL port must be an integer between 1 and 65535.' })
        .min(1, { message: 'MySQL port must be an integer between 1 and 65535.' })
        .max(65535, { message: 'MySQL port must be an integer between 1 and 65535.' })
    )
]);

/**
 * Zod schema for validating raw MySQL database config from server.yaml.
 */
export const mysqlConfigSchema = z.object({
  driver: z.literal('mysql'),
  host: z.string().trim().min(1, { message: 'MySQL host must not be empty.' }),
  port: portSchema,
  user: z.string().trim().min(1, { message: 'MySQL user must not be empty.' }),
  password: z.string(),
  database: z.string().trim().min(1, { message: 'MySQL database must not be empty.' })
});
