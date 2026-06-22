/**
 * Validated configuration for a MySQL database connection.
 */
export interface MysqlDatabaseConfig {
  /**
   * MySQL server hostname or IP address.
   */
  host: string;

  /**
   * TCP port for the MySQL server.
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
   * Default database/schema name.
   */
  database: string;
}
