import mysql, { type Pool, type ResultSetHeader, type RowDataPacket } from 'mysql2/promise';
import { mapApiTokenSqlRow, type ApiTokenSqlRow } from '#/db/apiTokenRows.js';
import type { IDatabase } from '#/db/IDatabase.js';
import type { ApiTokenRecord } from '#/db/types.js';
import { API_TOKENS_MIGRATION_SQL } from '#/db/mysql/migrations.js';
import { mysqlConfigSchema } from '#/db/mysql/schemas.js';
import type { MysqlDatabaseConfig } from '#/db/mysql/types.js';
import { formatZodError } from '#/db/validation.js';

/**
 * MySQL-backed database implementation.
 */
export class MysqlDatabase implements IDatabase {
  /**
   * Active MySQL connection pool, or null when disconnected.
   */
  private pool: Pool | null = null;

  /**
   * Creates a MySQL database instance from validated config.
   *
   * @param config - Parsed MySQL connection settings.
   */
  constructor(private readonly config: MysqlDatabaseConfig) { }

  /**
   * Validates raw config and constructs a {@link MysqlDatabase}.
   *
   * @param config - Raw `db` section from server.yaml.
   * @returns Configured MySQL database instance.
   * @throws {Error} When config fails MySQL-specific validation.
   */
  static fromConfig(config: unknown): MysqlDatabase {
    const parsed = mysqlConfigSchema.safeParse(config);
    if (!parsed.success) {
      throw new Error(formatZodError(parsed.error));
    }

    return new MysqlDatabase({
      host: parsed.data.host,
      port: parsed.data.port,
      user: parsed.data.user,
      password: parsed.data.password,
      database: parsed.data.database
    });
  }

  /**
   * Opens a MySQL connection pool and verifies connectivity with a ping.
   */
  async connect(): Promise<void> {
    if (this.pool) {
      return;
    }

    const pool = mysql.createPool({
      host: this.config.host,
      port: this.config.port,
      user: this.config.user,
      password: this.config.password,
      database: this.config.database
    });

    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();

    this.pool = pool;
  }

  /**
   * Closes the MySQL connection pool and releases resources.
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
    await this.executeStatement(API_TOKENS_MIGRATION_SQL);
  }

  /**
   * Inserts a new API token record.
   *
   * @param record - Token metadata to persist.
   */
  async createApiToken(record: ApiTokenRecord): Promise<void> {
    await this.executeStatement(
      `INSERT INTO api_tokens (
        id,
        name,
        token_hash,
        token_prefix,
        created_at,
        last_used_at,
        revoked_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
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
    const rows = await this.queryRows<ApiTokenSqlRow & RowDataPacket>(
      `SELECT
        id,
        name,
        token_hash,
        token_prefix,
        created_at,
        last_used_at,
        revoked_at
      FROM api_tokens
      WHERE token_hash = ?
        AND revoked_at IS NULL
      LIMIT 1`,
      [tokenHash]
    );

    const row = rows[0];
    return row ? mapApiTokenSqlRow(row) : null;
  }

  /**
   * Lists all API tokens ordered by creation time descending.
   */
  async listApiTokens(): Promise<ApiTokenRecord[]> {
    const rows = await this.queryRows<ApiTokenSqlRow & RowDataPacket>(
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

    return rows.map(mapApiTokenSqlRow);
  }

  /**
   * Soft-revokes an active token by id.
   *
   * @param id - Token identifier to revoke.
   */
  async revokeApiToken(id: string): Promise<boolean> {
    const result = await this.executeStatement(
      `UPDATE api_tokens
      SET revoked_at = ?
      WHERE id = ?
        AND revoked_at IS NULL`,
      [new Date(), id]
    );

    return (result.affectedRows ?? 0) > 0;
  }

  /**
   * Updates the last-used timestamp for a token.
   *
   * @param id - Token identifier that authenticated a request.
   * @param when - Timestamp of the authenticated request.
   */
  async touchApiTokenLastUsed(id: string, when: Date): Promise<void> {
    await this.executeStatement(`UPDATE api_tokens SET last_used_at = ? WHERE id = ?`, [when, id]);
  }

  /**
   * Returns the active pool or throws when connect has not been called.
   *
   * @returns Connected MySQL pool.
   * @throws {Error} When the database is not connected.
   */
  private requirePool(): Pool {
    if (!this.pool) {
      throw new Error('MySQL database is not connected.');
    }

    return this.pool;
  }

  /**
   * Executes a parameterized SELECT and returns matching rows.
   *
   * @param sql - SQL statement with ? placeholders.
   * @param params - Bound parameter values.
   * @returns Query rows from mysql2.
   */
  private async queryRows<T extends RowDataPacket>(
    sql: string,
    params: Array<string | number | Date | null> = []
  ): Promise<T[]> {
    const [rows] = await this.requirePool().execute<T[]>(sql, params);
    return rows;
  }

  /**
   * Executes a parameterized statement and returns result metadata.
   *
   * @param sql - SQL statement with ? placeholders.
   * @param params - Bound parameter values.
   * @returns Result metadata such as affected row counts.
   */
  private async executeStatement(
    sql: string,
    params: Array<string | number | Date | null> = []
  ): Promise<ResultSetHeader> {
    const [result] = await this.requirePool().execute(sql, params);
    return result as ResultSetHeader;
  }
}
