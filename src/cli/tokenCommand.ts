import { Command, InvalidArgumentError } from 'commander';
import { mergeGlobalOptions } from '#/cli/globalOptions.js';
import { loadServerConfig } from '#/config/serverConfig.js';
import { createDatabase } from '#/db/index.js';
import { generateApiToken } from '#/server/auth/apiTokens.js';

export interface TokenCommandOptions {
  /**
   * Path to the server YAML config file (from global `-c` / `--config`).
   */
  config: string;
}

export interface TokenCreateCommandOptions extends TokenCommandOptions {
  /**
   * Human-readable label for the new token.
   */
  name: string;
}

export interface TokenRevokeCommandOptions extends TokenCommandOptions {
  /**
   * Identifier of the token to revoke.
   */
  id: string;
}

/**
 * Formats a nullable date for CLI output.
 *
 * @param value - Date to format, or null when unset.
 * @returns ISO string or a dash placeholder.
 */
function formatOptionalDate(value: Date | null): string {
  return value ? value.toISOString() : '-';
}

/**
 * Parses and validates a token name from CLI input.
 *
 * @param value - Name string from a Commander option or argument.
 * @returns Trimmed non-empty token name.
 * @throws {InvalidArgumentError} When the name is empty after trimming.
 */
function parseTokenName(value: string): string {
  const name = value.trim();
  if (!name) {
    throw new InvalidArgumentError('Token name must not be empty.');
  }

  return name;
}

/**
 * Creates a new API token and prints the one-time secret.
 *
 * @param options - Parsed token create options including config path and name.
 */
export async function tokenCreateCommand(options: TokenCreateCommandOptions): Promise<void> {
  const config = loadServerConfig(options.config);
  const db = createDatabase(config.db);
  const { record, secret } = generateApiToken(options.name);

  await db.connect();
  await db.createApiToken(record);
  await db.disconnect();

  console.log(`Created API token "${record.name}" (${record.id}).`);
  console.log(`Token prefix: ${record.tokenPrefix}`);
  console.log('');
  console.log('Store this token now; it will not be shown again:');
  console.log(secret);
}

/**
 * Lists stored API tokens without revealing their secrets.
 *
 * @param options - Parsed token list options including config path.
 */
export async function tokenListCommand(options: TokenCommandOptions): Promise<void> {
  const config = loadServerConfig(options.config);
  const db = createDatabase(config.db);

  await db.connect();
  const tokens = await db.listApiTokens();
  await db.disconnect();

  if (tokens.length === 0) {
    console.log('No API tokens found.');
    return;
  }

  for (const token of tokens) {
    console.log(`- id: ${token.id}`);
    console.log(`  name: ${token.name}`);
    console.log(`  prefix: ${token.tokenPrefix}`);
    console.log(`  created: ${formatOptionalDate(token.createdAt)}`);
    console.log(`  last used: ${formatOptionalDate(token.lastUsedAt)}`);
    console.log(`  revoked: ${formatOptionalDate(token.revokedAt)}`);
  }
}

/**
 * Soft-revokes an API token by id.
 *
 * @param options - Parsed token revoke options including config path and token id.
 */
export async function tokenRevokeCommand(options: TokenRevokeCommandOptions): Promise<void> {
  const config = loadServerConfig(options.config);
  const db = createDatabase(config.db);

  await db.connect();
  const revoked = await db.revokeApiToken(options.id);
  await db.disconnect();

  if (revoked) {
    console.log(`Revoked API token ${options.id}.`);
    return;
  }

  console.log(`No active API token found with id ${options.id}.`);
}

/**
 * Registers the `token` command group on a Commander program.
 *
 * @param program - Root or parent Commander instance.
 * @param handlers - Injectable handlers for testing.
 */
export function registerTokenCommand(
  program: Command,
  handlers: {
    create?: (options: TokenCreateCommandOptions) => Promise<void>;
    list?: (options: TokenCommandOptions) => Promise<void>;
    revoke?: (options: TokenRevokeCommandOptions) => Promise<void>;
  } = {}
): void {
  const token = program.command('token').description('Manage API bearer tokens');

  token
    .command('create')
    .description('Create a new API bearer token')
    .requiredOption('--name <name>', 'Human-readable token label', parseTokenName)
    .action(
      /**
       * Runs the token create subcommand after merging global CLI options.
       */
      async function tokenCreateAction(this: Command, options: TokenCreateCommandOptions) {
        await (handlers.create ?? tokenCreateCommand)(mergeGlobalOptions(this, options));
      }
    );

  token
    .command('list')
    .description('List stored API bearer tokens')
    .action(
      /**
       * Runs the token list subcommand after merging global CLI options.
       */
      async function tokenListAction(this: Command, options: TokenCommandOptions) {
        await (handlers.list ?? tokenListCommand)(mergeGlobalOptions(this, options));
      }
    );

  token
    .command('revoke')
    .description('Revoke an API bearer token by id')
    .argument('<id>', 'Token identifier to revoke')
    .action(
      /**
       * Runs the token revoke subcommand after merging global CLI options.
       */
      async function tokenRevokeAction(this: Command, id: string, options: TokenCommandOptions) {
        await (handlers.revoke ?? tokenRevokeCommand)(mergeGlobalOptions(this, { ...options, id }));
      }
    );
}
