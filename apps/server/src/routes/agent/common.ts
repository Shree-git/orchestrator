/**
 * Common utilities for agent routes
 */

import { createLogger } from '../../lib/logger.js';
import {
  getErrorMessage as getErrorMessageShared,
  createLogError,
} from '../common.js';

const logger = createLogger('Agent');

// Re-export shared utilities
export { getErrorMessageShared as getErrorMessage };
export const logError = createLogError(logger);
