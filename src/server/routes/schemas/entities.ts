import { z } from 'zod/v4';
import type {
  CollectionRecord,
  EnvironmentRecord,
  FolderRecord,
  SavedRequestRecord
} from '#/db/types.js';
import {
  authConfigSchema,
  bodyTypeSchema,
  httpMethodSchema,
  keyValueSchema,
  timestampSchema,
  variableSchema
} from '#/server/routes/schemas/common.js';

/**
 * JSON shape for a persisted collection record.
 */
export const collectionRecordSchema = z.object({
  id: z.string(),
  name: z.string(),
  variables: z.array(variableSchema),
  headers: z.array(keyValueSchema),
  auth: authConfigSchema,
  preRequestScript: z.string(),
  postRequestScript: z.string(),
  createdAt: timestampSchema
});

/**
 * JSON shape for a persisted environment record.
 */
export const environmentRecordSchema = z.object({
  id: z.string(),
  name: z.string(),
  variables: z.array(variableSchema),
  createdAt: timestampSchema
});

/**
 * JSON shape for a persisted folder record.
 */
export const folderRecordSchema = z.object({
  id: z.string(),
  collectionId: z.string(),
  name: z.string(),
  sortOrder: z.number().int(),
  createdAt: timestampSchema
});

/**
 * JSON shape for a persisted saved request record.
 */
export const savedRequestRecordSchema = z.object({
  id: z.string(),
  collectionId: z.string(),
  name: z.string(),
  method: httpMethodSchema,
  url: z.string(),
  headers: z.array(keyValueSchema),
  params: z.array(keyValueSchema),
  auth: authConfigSchema,
  body: z.string(),
  bodyType: bodyTypeSchema,
  preRequestScript: z.string(),
  postRequestScript: z.string(),
  comment: z.string(),
  folderId: z.string().nullable(),
  sortOrder: z.number().int(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema
});

/**
 * Request body for creating a collection.
 */
export const createCollectionBodySchema = z.object({
  name: z.string().trim().min(1)
});

/**
 * Request body for updating a collection.
 */
export const updateCollectionBodySchema = z.object({
  name: z.string().trim().min(1),
  variables: z.array(variableSchema),
  headers: z.array(keyValueSchema),
  preRequestScript: z.string(),
  postRequestScript: z.string(),
  auth: authConfigSchema
});

/**
 * Request body for creating an environment.
 */
export const createEnvironmentBodySchema = z.object({
  name: z.string().trim().min(1)
});

/**
 * Request body for updating an environment.
 */
export const updateEnvironmentBodySchema = z.object({
  name: z.string().trim().min(1),
  variables: z.array(variableSchema)
});

/**
 * Request body for creating a folder.
 */
export const createFolderBodySchema = z.object({
  name: z.string().trim().min(1)
});

/**
 * Request body for renaming a folder.
 */
export const renameFolderBodySchema = z.object({
  name: z.string().trim().min(1)
});

/**
 * Request body for reordering folders within a collection.
 */
export const reorderFoldersBodySchema = z.object({
  orderedFolderIds: z.array(z.string().trim().min(1))
});

/**
 * Request body for creating or updating a saved request.
 */
export const saveRequestBodySchema = z.object({
  name: z.string().trim().min(1),
  method: httpMethodSchema,
  url: z.string(),
  headers: z.array(keyValueSchema),
  params: z.array(keyValueSchema),
  auth: authConfigSchema,
  body: z.string(),
  bodyType: bodyTypeSchema,
  preRequestScript: z.string(),
  postRequestScript: z.string(),
  comment: z.string(),
  folderId: z.string().nullable().optional()
});

/**
 * Request body for updating an existing saved request.
 */
export const updateSaveRequestBodySchema = saveRequestBodySchema.extend({
  collectionId: z.string().trim().min(1)
});

/**
 * Request body for reordering requests within a folder or collection root.
 */
export const reorderRequestsBodySchema = z.object({
  folderId: z.string().nullable(),
  orderedRequestIds: z.array(z.string().trim().min(1))
});

/**
 * Request body for moving a request to another folder or root index.
 */
export const moveRequestBodySchema = z.object({
  folderId: z.string().nullable(),
  index: z.number().int().min(0)
});

/**
 * List response wrapper for collections.
 */
export const listCollectionsResponseSchema = z.object({
  collections: z.array(collectionRecordSchema)
});

/**
 * List response wrapper for environments.
 */
export const listEnvironmentsResponseSchema = z.object({
  environments: z.array(environmentRecordSchema)
});

/**
 * List response wrapper for folders.
 */
export const listFoldersResponseSchema = z.object({
  folders: z.array(folderRecordSchema)
});

/**
 * List response wrapper for saved requests.
 */
export const listRequestsResponseSchema = z.object({
  requests: z.array(savedRequestRecordSchema)
});

/**
 * Empty JSON body schema for 204 No Content responses.
 */
export const emptyResponseSchema = z.null();

/**
 * Serializes a collection record for JSON responses.
 *
 * @param record - Collection record from the database layer.
 * @returns Collection with ISO timestamp strings.
 */
export function serializeCollection(record: CollectionRecord) {
  return {
    ...record,
    createdAt: record.createdAt.toISOString()
  };
}

/**
 * Serializes an environment record for JSON responses.
 *
 * @param record - Environment record from the database layer.
 * @returns Environment with ISO timestamp strings.
 */
export function serializeEnvironment(record: EnvironmentRecord) {
  return {
    ...record,
    createdAt: record.createdAt.toISOString()
  };
}

/**
 * Serializes a folder record for JSON responses.
 *
 * @param record - Folder record from the database layer.
 * @returns Folder with ISO timestamp strings.
 */
export function serializeFolder(record: FolderRecord) {
  return {
    ...record,
    createdAt: record.createdAt.toISOString()
  };
}

/**
 * Serializes a saved request record for JSON responses.
 *
 * @param record - Saved request record from the database layer.
 * @returns Saved request with ISO timestamp strings.
 */
export function serializeSavedRequest(record: SavedRequestRecord) {
  return {
    ...record,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}
