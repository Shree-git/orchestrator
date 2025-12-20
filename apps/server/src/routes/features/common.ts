/**
 * Common utilities for features routes
 */

import { createLogger } from '../../lib/logger.js';
import {
  getErrorMessage as getErrorMessageShared,
  createLogError,
} from '../common.js';

const logger = createLogger('Features');

// Re-export shared utilities
export { getErrorMessageShared as getErrorMessage };
export const logError = createLogError(logger);
