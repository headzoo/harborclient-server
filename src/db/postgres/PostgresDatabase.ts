import pg from 'pg';
import { mapApiTokenSqlRow, type ApiTokenSqlRow } from '#/db/apiTokenRows.js';
import type { IDatabase } from '#/db/IDatabase.js';
import type { ApiTokenRecord } from '#/db/types.js';
import { API_TOKENS_MIGRATION_SQL } from '#/db/postgres/migrations.js';
import { postgresConfigSchema } from '#/db/postgres/schemas.js';
import type { PostgresDatabaseConfig } from '#/db/postgres/types.js';
import { formatZodError } from '#/db/validation.js';

const { Pool } = pg;

/**
 * Postgres-backed database implementation.
 */
export class PostgresDatabase implements IDatabase {
  /**
   * Active Postgres connection pool, or null when disconnected.
   */
  private pool: pg.Pool | null = null;

  /**
   * Creates a Postgres database instance from validated config.
   *
   * @param config - Parsed Postgres connection settings.
   */
  constructor(private readonly config: PostgresDatabaseConfig) { }

  /**
   * Validates raw config and constructs a {@link PostgresDatabase}.
   *
   * @param config - Raw `db` section from server.yaml.
   * @returns Configured Postgres database instance.
   * @throws {Error} When config fails Postgres-specific validation.
   */
  static fromConfig(config: unknown): PostgresDatabase {
    const parsed = postgresConfigSchema.safeParse(config);
    if (!parsed.success) {
      throw new Error(formatZodError(parsed.error));
    }

    return new PostgresDatabase({
      host: parsed.data.host,
      port: parsed.data.port,
      user: parsed.data.user,
      password: parsed.data.password,
      database: parsed.data.database
    });
  }

  /**
   * Opens a Postgres connection pool and verifies connectivity with a query.
   */
  async connect(): Promise<void> {
    if (this.pool) {
      return;
    }

    const pool = new Pool({
      host: this.config.host,
      port: this.config.port,
      user: this.config.user,
      password: this.config.password,
      database: this.config.database
    });

    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();

    this.pool = pool;
  }

  /**
   * Closes the Postgres connection pool and releases resources.
   */
  async disconnect(): Promise<void> {
    if (!this.pool) {
      return;
    }

    await this.pool.end();
    this.pool = null;
  }

  /**
   * Creates the api_tokens table when it does not already exist.
   */
  async migrate(): Promise<void> {
    await this.query(API_TOKENS_MIGRATION_SQL);
  }

  /**
   * Inserts a new API token record.
   *
   * @param record - Token metadata to persist.
   */
  async createApiToken(record: ApiTokenRecord): Promise<void> {
    await this.query(
      `INSERT INTO api_tokens (
        id,
        name,
        token_hash,
        token_prefix,
        created_at,
        last_used_at,
        revoked_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        record.id,
        record.name,
        record.tokenHash,
        record.tokenPrefix,
        record.createdAt,
        record.lastUsedAt,
        record.revokedAt
      ]
    );
  }

  /**
   * Finds an active token by its stored hash.
   *
   * @param tokenHash - sha256 hex digest of the bearer token secret.
   */
  async findActiveApiTokenByHash(tokenHash: string): Promise<ApiTokenRecord | null> {
    const result = await this.query<ApiTokenSqlRow>(
      `SELECT
        id,
        name,
        token_hash,
        token_prefix,
        created_at,
        last_used_at,
        revoked_at
      FROM api_tokens
      WHERE token_hash = $1
        AND revoked_at IS NULL
      LIMIT 1`,
      [tokenHash]
    );

    const row = result.rows[0];
    return row ? mapApiTokenSqlRow(row) : null;
  }

  /**
   * Lists all API tokens ordered by creation time descending.
   */
  async listApiTokens(): Promise<ApiTokenRecord[]> {
    const result = await this.query<ApiTokenSqlRow>(
      `SELECT
        id,
        name,
        token_hash,
        token_prefix,
        created_at,
        last_used_at,
        revoked_at
      FROM api_tokens
      ORDER BY created_at DESC`
    );

    return result.rows.map(mapApiTokenSqlRow);
  }

  /**
   * Soft-revokes an active token by id.
   *
   * @param id - Token identifier to revoke.
   */
  async revokeApiToken(id: string): Promise<boolean> {
    const result = await this.query(
      `UPDATE api_tokens
      SET revoked_at = $2
      WHERE id = $1
        AND revoked_at IS NULL`,
      [id, new Date()]
    );

    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Updates the last-used timestamp for a token.
   *
   * @param id - Token identifier that authenticated a request.
   * @param when - Timestamp of the authenticated request.
   */
  async touchApiTokenLastUsed(id: string, when: Date): Promise<void> {
    await this.query(`UPDATE api_tokens SET last_used_at = $2 WHERE id = $1`, [id, when]);
  }

  /**
   * Returns the active pool or throws when connect has not been called.
   *
   * @returns Connected Postgres pool.
   * @throws {Error} When the database is not connected.
   */
  private requirePool(): pg.Pool {
    if (!this.pool) {
      throw new Error('Postgres database is not connected.');
    }

    return this.pool;
  }

  /**
   * Executes a parameterized SQL statement against the active pool.
   *
   * @param sql - SQL statement with $1-style placeholders.
   * @param params - Bound parameter values.
   * @returns Query result from pg.
   */
  private async query<T extends pg.QueryResultRow>(
    sql: string,
    params: unknown[] = []
  ): Promise<pg.QueryResult<T>> {
    return this.requirePool().query<T>(sql, params);
  }
}
