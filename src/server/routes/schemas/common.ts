import { z } from 'zod/v4';

/**
 * Standard error body returned by protected API routes.
 */
export const errorResponseSchema = z.object({
  error: z.string()
});

/**
 * Route parameter schema for string entity identifiers (UUIDs).
 */
export const idParamSchema = z.object({
  id: z.string().trim().min(1)
});

/**
 * Route parameter schema for a parent collection identifier.
 */
export const collectionIdParamSchema = z.object({
  collectionId: z.string().trim().min(1)
});

/**
 * Supported HTTP request methods for saved requests.
 */
export const httpMethodSchema = z.enum([
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'HEAD',
  'OPTIONS'
]);

/**
 * Request body content type for saved requests.
 */
export const bodyTypeSchema = z.enum(['none', 'json', 'text', 'multipart', 'urlencoded']);

/**
 * Authorization type for collections and saved requests.
 */
export const authTypeSchema = z.enum(['none', 'basic', 'bearer']);

/**
 * Zod schema for a key-value pair with an enable toggle.
 */
export const keyValueSchema = z.object({
  key: z.string(),
  value: z.string(),
  enabled: z.boolean()
});

/**
 * Zod schema for a collection- or environment-scoped variable.
 */
export const variableSchema = z.object({
  key: z.string(),
  value: z.string(),
  defaultValue: z.string(),
  share: z.boolean()
});

/**
 * Zod schema for authorization settings on collections and requests.
 */
export const authConfigSchema = z.object({
  type: authTypeSchema,
  basic: z.object({
    username: z.string(),
    password: z.string()
  }),
  bearer: z.object({
    token: z.string()
  })
});

/**
 * ISO 8601 timestamp strings returned in JSON responses.
 */
export const timestampSchema = z.iso.datetime();
