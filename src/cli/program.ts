import { Command } from 'commander';
import { DEFAULT_CONFIG_PATH } from '#/config/serverConfig.js';
import { registerMigrateCommand, type MigrateCommandOptions } from '#/cli/migrateCommand.js';
import {
  registerTokenCommand,
  type TokenCommandOptions,
  type TokenCreateCommandOptions,
  type TokenRevokeCommandOptions
} from '#/cli/tokenCommand.js';
import { registerStartCommand, type StartCommandOptions } from '#/server.js';

export interface ProgramDependencies {
  /**
   * Optional override for the start subcommand handler (used in tests).
   */
  startCommand?: (options: StartCommandOptions) => Promise<void>;

  /**
   * Optional override for the migrate subcommand handler (used in tests).
   */
  migrateCommand?: (options: MigrateCommandOptions) => Promise<void>;

  /**
   * Optional overrides for token subcommand handlers (used in tests).
   */
  tokenCommand?: {
    create?: (options: TokenCreateCommandOptions) => Promise<void>;
    list?: (options: TokenCommandOptions) => Promise<void>;
    revoke?: (options: TokenRevokeCommandOptions) => Promise<void>;
  };
}

/**
 * Creates the root Commander program with global options and subcommands.
 *
 * @param version - Package version shown by `--version`.
 * @param deps - Injectable handlers for testing.
 * @returns Configured Commander program ready to parse argv.
 */
export function createProgram(version: string, deps: ProgramDependencies = {}): Command {
  const program = new Command();

  program
    .name('harborclient-server')
    .description('Central server for HarborClient')
    .version(version)
    .showHelpAfterError()
    .enablePositionalOptions()
    .option('-v, --verbose', 'Enable verbose logging')
    .option(
      '-c, --config <path>',
      `Path to config file (default: ${DEFAULT_CONFIG_PATH})`,
      DEFAULT_CONFIG_PATH
    );

  registerStartCommand(program, deps.startCommand);
  registerMigrateCommand(program, deps.migrateCommand);
  registerTokenCommand(program, deps.tokenCommand);

  return program;
}
