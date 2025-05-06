// noinspection ES6ConvertVarToLetConst

/**
 * Singleton factory for SNLogger instances
 * Provides global access to logging functionality
 * @namespace
 */
// eslint-disable-next-line no-unused-vars
var SNLog = (function () {
  var logger = new SNLogger();

  // noinspection JSUnusedGlobalSymbols
  return {
    /**
     * Logs a message at info level (alias for info)
     * @param {string} msg - The message to log
     * @param {string|Array} [sourceOrArgs] - Either a source string or array of message arguments
     * @param {Array} [maybeArgs] - Message arguments when the source is provided
     */
    log: function (msg, sourceOrArgs, maybeArgs) {
      logger.log(msg, sourceOrArgs, maybeArgs);
    },
    /**
     * Logs an info level message
     * @param {string} msg - The message to log
     * @param {string|Array} [sourceOrArgs] - Either a source string or array of message arguments
     * @param {Array} [maybeArgs] - Message arguments when the source is provided
     */
    info: function (msg, sourceOrArgs, maybeArgs) {
      logger.info(msg, sourceOrArgs, maybeArgs);
    },
    /**
     * Logs a warning level message
     * @param {string} msg - The message to log
     * @param {string|Array} [sourceOrArgs] - Either a source string or array of message arguments
     * @param {Array} [maybeArgs] - Message arguments when the source is provided
     */
    warn: function (msg, sourceOrArgs, maybeArgs) {
      logger.warn(msg, sourceOrArgs, maybeArgs);
    },
    /**
     * Logs an error level message
     * @param {string} msg - The message to log
     * @param {string|Array} [sourceOrArgs] - Either a source string or array of message arguments
     * @param {Array} [maybeArgs] - Message arguments when the source is provided
     */
    error: function (msg, sourceOrArgs, maybeArgs) {
      logger.error(msg, sourceOrArgs, maybeArgs);
    },
    /**
     * Logs a debug level message
     * @param {string} msg - The message to log
     * @param {string|Array} [sourceOrArgs] - Either a source string or array of message arguments
     * @param {Array} [maybeArgs] - Message arguments when the source is provided
     */
    debug: function (msg, sourceOrArgs, maybeArgs) {
      logger.debug(msg, sourceOrArgs, maybeArgs);
    },
    /**
     * Logs a fatal level message
     * @param {string} msg - The message to log
     * @param {string|Array} [sourceOrArgs] - Either a source string or array of message arguments
     * @param {Array} [maybeArgs] - Message arguments when the source is provided
     */
    fatal: function (msg, sourceOrArgs, maybeArgs) {
      logger.fatal(msg, sourceOrArgs, maybeArgs);
    },
    /**
     * Logs a trace level message
     * @param {string} msg - The message to log
     * @param {string|Array} [sourceOrArgs] - Either a source string or array of message arguments
     * @param {Array} [maybeArgs] - Message arguments when the source is provided
     */
    trace: function (msg, sourceOrArgs, maybeArgs) {
      logger.trace(msg, sourceOrArgs, maybeArgs);
    },
    /**
     * Creates a new logger instance with the specified source
     * @param {string} [source] - The source identifier for the new logger
     * @returns {SNLogger} A new SNLogger instance
     */
    newLogger: function (source) {
      if (typeof source !== "undefined") {
        return new SNLogger(source);
      }
      return new SNLogger();
    },
    /**
     * Creates a new logger instance with the specified source
     * @param {string} [source] - The source identifier for the new logger
     * @returns {SNLogger} A new SNLogger instance
     */
    getLogger: function (source) {
      if (typeof source !== "undefined") {
        return new SNLogger(source);
      }
      return new SNLogger();
    }
  };
})();
