import { z } from 'zod/v4';

/**
 * Zod schema for validating raw Firestore database config from server.yaml.
 */
export const firestoreConfigSchema = z.object({
  driver: z.literal('firestore'),
  projectId: z.string().trim().min(1, { message: 'Firestore projectId must not be empty.' }),
  keyFilename: z.string().trim().min(1).optional()
});
