import { Command } from 'commander';
import { mergeGlobalOptions } from '#/cli/globalOptions.js';
import { loadServerConfig } from '#/config/serverConfig.js';
import { createDatabase } from '#/db/index.js';
import type { CollectionRecord } from '#/db/types.js';

export interface CollectionCommandOptions {
  /**
   * Path to the server YAML config file (from global `-c` / `--config`).
   */
  config: string;
}

/**
 * Prints a collection record for CLI listings.
 *
 * @param collection - Collection record to display.
 */
function printCollection(collection: CollectionRecord): void {
  console.log(`- id: ${collection.id}`);
  console.log(`  name: ${collection.name}`);
  console.log(`  created: ${collection.createdAt.toISOString()}`);
  console.log(`  updated: ${collection.updatedAt.toISOString()}`);
}

/**
 * Lists stored collections.
 *
 * @param options - Parsed collection list options including config path.
 */
export async function collectionListCommand(options: CollectionCommandOptions): Promise<void> {
  const config = loadServerConfig(options.config);
  const db = createDatabase(config.db);

  await db.connect();
  const collections = await db.listCollections();
  await db.disconnect();

  if (collections.length === 0) {
    console.log('No collections found.');
    return;
  }

  for (const collection of collections) {
    printCollection(collection);
  }
}

/**
 * Registers the `collection` command group on a Commander program.
 *
 * @param program - Root or parent Commander instance.
 * @param handlers - Injectable handlers for testing.
 */
export function registerCollectionCommand(
  program: Command,
  handlers: {
    list?: (options: CollectionCommandOptions) => Promise<void>;
  } = {}
): void {
  const collection = program.command('collection').description('Inspect stored collections');

  collection
    .command('list')
    .description('List stored collections')
    .action(
      /**
       * Runs the collection list subcommand after merging global CLI options.
       */
      async function collectionListAction(this: Command, options: CollectionCommandOptions) {
        await (handlers.list ?? collectionListCommand)(mergeGlobalOptions(this, options));
      }
    );
}
