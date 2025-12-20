/**
 * Common utilities for auto-mode routes
 */

import { createLogger } from '../../lib/logger.js';
import {
  getErrorMessage as getErrorMessageShared,
  createLogError,
} from '../common.js';

const logger = createLogger('AutoMode');

// Re-export shared utilities
export { getErrorMessageShared as getErrorMessage };
export const logError = createLogError(logger);
