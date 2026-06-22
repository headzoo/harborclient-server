export { createDatabase } from '#/db/createDatabase.js';
export type { IDatabase } from '#/db/IDatabase.js';
export type {
  ApiTokenRecord,
  AuthConfig,
  AuthType,
  BodyType,
  CollectionRecord,
  EnvironmentRecord,
  FolderRecord,
  HttpMethod,
  KeyValue,
  SaveRequestInput,
  SavedRequestRecord,
  Variable
} from '#/db/types.js';
export { DEFAULT_AUTH_JSON, defaultAuth, normalizeAuth, normalizeVariable } from '#/db/types.js';
export { FirestoreDatabase } from '#/db/firestore/FirestoreDatabase.js';
export type { FirestoreDatabaseConfig } from '#/db/firestore/types.js';
export { MysqlDatabase } from '#/db/mysql/MysqlDatabase.js';
export type { MysqlDatabaseConfig } from '#/db/mysql/types.js';
export { PostgresDatabase } from '#/db/postgres/PostgresDatabase.js';
export type { PostgresDatabaseConfig } from '#/db/postgres/types.js';
