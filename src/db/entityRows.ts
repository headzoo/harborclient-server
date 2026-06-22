import type {
  AuthConfig,
  BodyType,
  CollectionRecord,
  EnvironmentRecord,
  FolderRecord,
  HttpMethod,
  KeyValue,
  SavedRequestRecord,
  Variable
} from '#/db/types.js';
import { defaultAuth, normalizeAuth, normalizeVariable } from '#/db/types.js';

/**
 * Parses a JSON string, returning a fallback value on failure.
 *
 * @param value - Raw JSON text.
 * @param fallback - Value returned when parsing fails.
 * @returns Parsed value or fallback.
 */
function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

/**
 * Parses auth JSON from a database row, falling back to defaultAuth when absent or invalid.
 *
 * @param value - Raw auth column from storage.
 * @returns Normalized AuthConfig.
 */
function readAuth(value: string): AuthConfig {
  return normalizeAuth(parseJson(value, defaultAuth()));
}

/**
 * Parses and normalizes variable rows from storage.
 *
 * @param value - Raw variables JSON text.
 * @returns Normalized Variable array.
 */
function readVariables(value: string): Variable[] {
  return parseJson<Partial<Variable>[]>(value, []).map(normalizeVariable);
}

/**
 * SQL row shape returned by relational backends for the collections table.
 */
export interface CollectionSqlRow {
  /**
   * Primary key identifier.
   */
  id: string;

  /**
   * Display name column.
   */
  name: string;

  /**
   * JSON-encoded variables column.
   */
  variables: string;

  /**
   * JSON-encoded headers column.
   */
  headers: string;

  /**
   * JSON-encoded auth column.
   */
  auth: string;

  /**
   * Pre-request script column.
   */
  pre_request_script: string;

  /**
   * Post-request script column.
   */
  post_request_script: string;

  /**
   * Creation timestamp column.
   */
  created_at: Date;
}

/**
 * SQL row shape returned by relational backends for the environments table.
 */
export interface EnvironmentSqlRow {
  /**
   * Primary key identifier.
   */
  id: string;

  /**
   * Display name column.
   */
  name: string;

  /**
   * JSON-encoded variables column.
   */
  variables: string;

  /**
   * Creation timestamp column.
   */
  created_at: Date;
}

/**
 * SQL row shape returned by relational backends for the folders table.
 */
export interface FolderSqlRow {
  /**
   * Primary key identifier.
   */
  id: string;

  /**
   * Parent collection identifier column.
   */
  collection_id: string;

  /**
   * Display name column.
   */
  name: string;

  /**
   * Sort order column.
   */
  sort_order: number;

  /**
   * Creation timestamp column.
   */
  created_at: Date;
}

/**
 * SQL row shape returned by relational backends for the requests table.
 */
export interface RequestSqlRow {
  /**
   * Primary key identifier.
   */
  id: string;

  /**
   * Parent collection identifier column.
   */
  collection_id: string;

  /**
   * Optional parent folder identifier column.
   */
  folder_id: string | null;

  /**
   * Display name column.
   */
  name: string;

  /**
   * HTTP method column.
   */
  method: string;

  /**
   * Request URL column.
   */
  url: string;

  /**
   * JSON-encoded headers column.
   */
  headers: string;

  /**
   * JSON-encoded params column.
   */
  params: string;

  /**
   * JSON-encoded auth column.
   */
  auth: string;

  /**
   * Request body column.
   */
  body: string;

  /**
   * Body type column.
   */
  body_type: string;

  /**
   * Pre-request script column.
   */
  pre_request_script: string;

  /**
   * Post-request script column.
   */
  post_request_script: string;

  /**
   * Comment column.
   */
  comment: string;

  /**
   * Sort order column.
   */
  sort_order: number;

  /**
   * Creation timestamp column.
   */
  created_at: Date;

  /**
   * Last-updated timestamp column.
   */
  updated_at: Date;
}

/**
 * Maps a snake_case SQL row to the shared {@link CollectionRecord} shape.
 *
 * @param row - Database row from collections.
 * @returns Normalized collection record for application code.
 */
export function mapCollectionSqlRow(row: CollectionSqlRow): CollectionRecord {
  return {
    id: row.id,
    name: row.name,
    variables: readVariables(row.variables),
    headers: parseJson<KeyValue[]>(row.headers, []),
    auth: readAuth(row.auth),
    preRequestScript: row.pre_request_script,
    postRequestScript: row.post_request_script,
    createdAt: row.created_at
  };
}

/**
 * Maps a snake_case SQL row to the shared {@link EnvironmentRecord} shape.
 *
 * @param row - Database row from environments.
 * @returns Normalized environment record for application code.
 */
export function mapEnvironmentSqlRow(row: EnvironmentSqlRow): EnvironmentRecord {
  return {
    id: row.id,
    name: row.name,
    variables: readVariables(row.variables),
    createdAt: row.created_at
  };
}

/**
 * Maps a snake_case SQL row to the shared {@link FolderRecord} shape.
 *
 * @param row - Database row from folders.
 * @returns Normalized folder record for application code.
 */
export function mapFolderSqlRow(row: FolderSqlRow): FolderRecord {
  return {
    id: row.id,
    collectionId: row.collection_id,
    name: row.name,
    sortOrder: row.sort_order,
    createdAt: row.created_at
  };
}

/**
 * Maps a snake_case SQL row to the shared {@link SavedRequestRecord} shape.
 *
 * @param row - Database row from requests.
 * @returns Normalized saved request record for application code.
 */
export function mapRequestSqlRow(row: RequestSqlRow): SavedRequestRecord {
  return {
    id: row.id,
    collectionId: row.collection_id,
    folderId: row.folder_id,
    name: row.name,
    method: row.method as HttpMethod,
    url: row.url,
    headers: parseJson<KeyValue[]>(row.headers, []),
    params: parseJson<KeyValue[]>(row.params, []),
    auth: readAuth(row.auth),
    body: row.body,
    bodyType: row.body_type as BodyType,
    preRequestScript: row.pre_request_script,
    postRequestScript: row.post_request_script,
    comment: row.comment,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
