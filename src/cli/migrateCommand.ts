import { Command } from 'commander';
import { mergeGlobalOptions } from '#/cli/globalOptions.js';
import { loadServerConfig } from '#/config/serverConfig.js';
import { createDatabase } from '#/db/index.js';

export interface MigrateCommandOptions {
  /**
   * Path to the server YAML config file (from global `-c` / `--config`).
   */
  config: string;
}

/**
 * Runs database schema migrations for the configured backend.
 *
 * @param options - Parsed migrate command options including config path.
 */
export async function migrateCommand(options: MigrateCommandOptions): Promise<void> {
  const config = loadServerConfig(options.config);
  const db = createDatabase(config.db);

  await db.connect();
  await db.migrate();
  await db.disconnect();

  console.log('Database migration completed successfully.');
}

/**
 * Registers the `migrate` subcommand on a Commander program.
 *
 * @param program - Root or parent Commander instance.
 * @param handler - Action to run when `migrate` is invoked (defaults to {@link migrateCommand}).
 */
export function registerMigrateCommand(
  program: Command,
  handler: (options: MigrateCommandOptions) => Promise<void> = migrateCommand
): void {
  program
    .command('migrate')
    .description('Apply database schema migrations')
    .action(
      /**
       * Runs the migrate subcommand after merging global CLI options.
       */
      async function migrateAction(this: Command, options: MigrateCommandOptions) {
        await handler(mergeGlobalOptions(this, options));
      }
    );
}
