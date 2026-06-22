import type { Command } from 'commander';

export interface GlobalCommandOptions {
  /**
   * When true, enables verbose server logging.
   */
  verbose?: boolean;

  /**
   * Path to the server YAML config file.
   */
  config?: string;
}

/**
 * Merges root-level CLI options into a subcommand's parsed options.
 *
 * Commander stores global flags on the parent command; subcommands receive only
 * their own flags unless merged explicitly.
 *
 * @param command - The subcommand instance whose parent holds global opts.
 * @param options - Options parsed for the subcommand action.
 * @returns Options with global `verbose` and `config` values applied.
 */
export function mergeGlobalOptions<T extends GlobalCommandOptions>(
  command: Command,
  options: T
): T {
  const globalOpts = command.parent?.opts() as GlobalCommandOptions | undefined;

  return {
    ...options,
    verbose: globalOpts?.verbose ?? options.verbose,
    config: globalOpts?.config ?? options.config
  };
}
