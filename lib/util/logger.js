/**
 * Logger functions for further customization and formatting of logging
 */
const Logger = {};

// ANSI escape codes for colors
const colors = { info: '\x1b[94m', warn: '\x1b[93m', error: '\x1b[91m', reset: '\x1b[94m' };

/**
 * Logs an info message to the console
 * @param {String} message - The message to log
 * @param {Object} data - Additional data to log
 */
Logger.info = (message, data) => {
  if (process.env.MOCHA) { return; }
  const logMessage = `[INFO] ${new Date().toISOString()} - ${message}${data ? ` - ${JSON.stringify(data)}` : ''}`;
  console.log(`${colors.info}${logMessage}${colors.reset}`);
};

/**
 * Logs a warning message
 * @param {String} message - The message to log
 * @param {Object} data - Additional data to log
 */
Logger.warn = (message, data) => {
  if (process.env.MOCHA) { return; }
  const logMessage = `[WARN] ${new Date().toISOString()} - ${message}${data ? ` - ${JSON.stringify(data)}` : ''}`;
  console.log(`${colors.warn}${logMessage}${colors.reset}`);
};

/**
 * Logs an error message
 * @param {String} message - The message to log
 * @param {Error} error - The error object to log
 * @param {Object} data - Additional data to log
 */
Logger.error = (message, error, data) => {
  if (process.env.MOCHA) { return; }
  const logMessage = `[ERROR] ${new Date().toISOString()} - ${message}${data ? ` - ${JSON.stringify(data)}` : ''}`;
  console.log(`${colors.error}${logMessage}${colors.reset}`);
  console.log(`${colors.error}${error.stack}${colors.reset}`);
};

export default Logger;