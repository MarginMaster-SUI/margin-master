/**
 * MarginMaster Backend - Main Entry Point
 *
 * Starts the blockchain event indexer service
 */

import { startIndexer } from './services/blockchain-indexer.js';
import pino from 'pino';

const logger = pino({ name: 'main' });

async function main() {
  logger.info('MarginMaster Backend starting...');

  // Start blockchain event indexer
  await startIndexer();
}

main().catch((error) => {
  logger.error({ error }, 'Fatal error in main');
  process.exit(1);
});
