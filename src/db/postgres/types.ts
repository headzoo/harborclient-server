/**
 * Validated configuration for a Postgres database connection.
 */
export interface PostgresDatabaseConfig {
  /**
   * Postgres server hostname or IP address.
   */
  host: string;

  /**
   * TCP port for the Postgres server.
   */
  port: number;

  /**
   * Database user name.
   */
  user: string;

  /**
   * Database user password.
   */
  password: string;

  /**
   * Default database name.
   */
  database: string;
}
