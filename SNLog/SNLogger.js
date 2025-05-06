// noinspection ES6ConvertVarToLetConst

/**
 * A logging utility class for ServiceNow that provides various logging levels and context management.
 * Supports logging to the syslog table with configurable log levels based on the instance type.
 * @class
 */
var SNLogger = Class.create();
// noinspection JSUnusedGlobalSymbols
SNLogger.prototype = {
  DEFAULT_LOG_LEVEL: "warn",
  /**
   * Initializes a new SNLogger instance
   * @param {string} [source] - The source identifier for the logger
   */
  initialize: function (source) {
    this.source = source || "";
    this.context = {};
    this.prefix = "" + Math.floor(Math.random() * 100000);
    this.counter = 0;
    this.logLevels = {
      trace: -2,
      debug: -1,
      info: 0,
      information: 0,
      warn: 1,
      warning: 1,
      error: 2,
      fatal: 3
    };
    this._initLogLevel();
    this.logLevelManuallySet = false;
    this.shouldPrint = false;
    this.stackTrace = false;
  },

  /**
   * Sets the context map for logging
   * @param {Object} contextMap - The context map to set
   * @returns {SNLogger} The logger instance for chaining
   */
  setContext: function (contextMap) {
    this.context = contextMap || {};
    return this;
  },

  /**
   * Alias for setContext method
   * @param {Object} contextMap - The context map to set
   * @returns {SNLogger} The logger instance for chaining
   */
  withContext: function (contextMap) {
    return this.setContext(contextMap);
  },

  /**
   * Adds a single parameter to the context map
   * @param {string} paramName - The name of the context parameter
   * @param {*} paramValue - The value to set for the context parameter
   * @returns {SNLogger} The logger instance for chaining
   */
  withContextParam: function (paramName, paramValue) {
    this.context[paramName] = paramValue;
    return this;
  },

  /**
   * Adds a single parameter to the context map (alias for withContextParam)
   * @param {string} paramName - The name of the context parameter
   * @param {*} paramValue - The value to set for the context parameter
   * @returns {SNLogger} The logger instance for chaining
   */
  addContextParam: function (paramName, paramValue) {
    return this.withContextParam(paramName, paramValue);
  },

  /**
   * Adds multiple key-value pairs to the existing context map.
   * If the provided contextMap is null or undefined, returns the logger instance without modification.
   * @param {Object} contextMap - An object containing key-value pairs to add to the context
   * @returns {SNLogger} The logger instance for chaining
   */
  addContext: function (contextMap) {
    if (!contextMap) {
      return this;
    }
    Object.keys(contextMap).forEach(function (key) {
      this.context[key] = contextMap[key];
    }, this);
    return this;
  },

  /**
   * Retrieves an array of field names from a GlideRecord
   * @param {GlideRecord} record - The GlideRecord to get fields from
   * @returns {string[]} Array of field names from the record, or empty array if record is invalid
   */
  getFields: function (record) {
    if (!this._isValidRecord(record)) {
      return [];
    }

    var fieldsOnRecord = [];

    var fields = record.getFields();
    for (var i = 0; i < fields.size(); i++) {
      var glideElement = fields.get(i);
      fieldsOnRecord.push(String(glideElement.getName()));
    }

    return fieldsOnRecord;
  },

  /**
   * Sets the source identifier for logging
   * @param {string} source - The source identifier to set
   * @returns {SNLogger} The logger instance for chaining
   */
  setSource: function (source) {
    this.source = source;
    this._initLogLevel();
    return this;
  },

  /**
   * Alias for setSource method
   * @param {string} source - The source identifier to set
   * @returns {SNLogger} The logger instance for chaining
   */
  withSource: function (source) {
    return this.setSource(source);
  },

  /**
   * Checks if a GlideRecord instance is valid
   * @private
   * @param {GlideRecord} record - The GlideRecord instance to validate
   * @returns {boolean} True if the record is a valid GlideRecord instance, false otherwise
   */
  _isValidRecord: function (record) {
    if (!(record instanceof GlideRecord)) {
      return false;
    }
    return record.isValid();
  },

  /**
   * Sets context using a GlideRecord
   * @param {GlideRecord} record - The GlideRecord to use for context
   * @returns {SNLogger} The logger instance for chaining
   */
  withRecord: function (record) {
    if (!this._isValidRecord(record)) {
      return this;
    }
    return this.withTable(record.getTableName()).withId(record.getUniqueValue());
  },

  /**
   * Sets context using a GlideRecord
   * @param {GlideRecord} record - The GlideRecord to use for context
   * @returns {SNLogger} The logger instance for chaining
   */
  withRecordDump: function (record) {
    if (!this._isValidRecord(record)) {
      return this;
    }
    this.withTable(record.getTableName()).withId(record.getUniqueValue());
    var fields = this.getFields(record);
    // this.context.record = {};
    for (var i = 0; i < fields.length; i++) {
      var value = record.getValue(fields[i]);
      if (value && String(value) !== "null" && String(value) !== "undefined" && String(value) !== "NaN" && String(value).trim() !== "" && String(value) !== "0") {
        // this.context.record[fields[i]] = value;
        this.withContextParam(fields[i], value);
      }
    }
    return this;
  },

  /**
   * Alias for withRecord method
   * @param {GlideRecord} record - The GlideRecord to use for context
   * @returns {SNLogger} The logger instance for chaining
   */
  withTaskGr: function (record) {
    return this.withRecord(record);
  },

  /**
   * Sets the task ID in the context
   * @param {string} id - The task ID to set
   * @returns {SNLogger} The logger instance for chaining
   */
  withTaskId: function (id) {
    this.context.sys_id = id;
    return this;
  },

  /**
   * Alias for withTable method
   * @param {string} table - The table name to set
   * @returns {SNLogger} The logger instance for chaining
   */
  withTaskTable: function (table) {
    return this.withTable(table);
  },

  /**
   * Sets the table name in the context
   * @param {string} table - The table name to set
   * @returns {SNLogger} The logger instance for chaining
   */
  withTable: function (table) {
    this.context.table = table;
    return this;
  },

  /**
   * Sets the sys_id in the context
   * @param {string} id - The sys_id to set
   * @returns {SNLogger} The logger instance for chaining
   */
  withId: function (id) {
    this.context.sys_id = id;
    return this;
  },

  /**
   * Sets the prefix for log sequence numbers
   * @param {string} prefix - The prefix to use for log sequences
   * @returns {SNLogger} The logger instance for chaining
   */
  setPrefix: function (prefix) {
    this.prefix = prefix;
    return this;
  },

  /**
   * Gets the configured log level for the current instance
   * @private
   * @returns {string|number} The configured log level for the instance
   */
  _getInstanceLevel: function () {
    var defaultLevel = this.DEFAULT_LOG_LEVEL;

    if (this.source) {
      var prop = this.source + ".log.level";
      var configured = gs.getProperty(prop);
      if (configured) {
        return configured;
      }
    }

    var fallback = gs.getProperty("snlog.log.level");
    if (fallback) {
      return fallback;
    }

    var instanceName = gs.getProperty("instance_name", "").toLowerCase();

    return instanceName.includes("dev") || instanceName.includes("test") ? "debug" : defaultLevel;
  },

  /**
   * Initializes the log level based on instance configuration
   * @private
   */
  _initLogLevel: function () {
    if (this.logLevelManuallySet) {
      return;
    }
    var configured = this._getInstanceLevel();

    this.setLogLevel(configured);
  },

  /**
   * Determines if a message at the given level should be logged
   * @private
   * @param {number} level - The log level to check
   * @returns {boolean} True if the message should be logged, false otherwise
   */
  _shouldLog: function (level) {
    return level >= this.logLevel;
  },
  /**
   * Builds a formatted message by replacing placeholders with arguments
   * and appends a stack trace if appropriate.
   * @private
   * @param {string} msg - The message template with placeholders
   * @param {Array} args - The arguments to insert into the message
   * @param {number} [level] - Optional log level for evaluating whether to include stack trace
   * @returns {string} The formatted message
   */
  _buildMessage: function (msg, args, level) {
    var result = msg;

    if (args && args.length > 0) {
      result = msg.replace(/\{(\d+)}/g, function (match, number) {
        return typeof args[number] !== "undefined" ? args[number] : match;
      });
    }

    if (this.stackTrace || level >= this.logLevels.error) {
      result += "\n" + this._getStackTrace(result);
    }

    return result;
  },

  /**
   * Inserts a log entry into the syslog table
   * @private
   * @param {string} level - The log level for the entry
   * @param {string} msg - The message to log
   */
  _insertLog: function (level, msg) {
    var logGR = new GlideRecord("syslog");
    logGR.newRecord();
    logGR.level = level;
    logGR.message = msg;
    logGR.source = this.source || "*** Script";
    logGR.context_map = JSON.stringify(this.context);
    //
    // if (gs.getCurrentApplicationId) {
    //     var appId = gs.getCurrentApplicationId();
    //     var appGR = new GlideRecord('sys_app');
    //     if (appGR.get(appId)) {
    //         logGR.source_application_family = appGR.application_family;
    //         logGR.source_package = appGR.scope;
    //     }
    // }

    logGR.sequence = this._buildSequence();
    logGR.insert();

    if (this.shouldPrint) {
      // eslint-disable-next-line servicenow/minimize-gs-log-print
      gs.print(msg);
    }
  },

  /**
   * Builds a unique prefix for log sequence numbering
   * @private
   * @returns {string} The formatted prefix string
   */
  _buildSequence: function () {
    return this.prefix + "-" + (this.counter++).toString().padStart(5, "0");
  },

  /**
   * Sets the log level to use the automatically determined level for the current instance
   * @returns {SNLogger} The logger instance for chaining
   */
  useAutoLogLevel: function () {
    this.logLevelManuallySet = false;
    this._initLogLevel();
    return this;
  },

  /**
   * Sets the log level for the logger instance
   * @param {string|number} level - The log level to set. Can be a string level name or numeric value
   * @returns {void}
   */
  setLogLevel: function (level) {
    this.logLevel = this._normalizeLogLevel(level);
  },

  /**
   * Normalizes the log level to a numeric value
   * @private
   * @param {string|number} level - The log level to normalize
   * @returns {number} The normalized numeric log level
   */
  _normalizeLogLevel: function (level) {
    if (typeof level === "number") {
      return level;
    }

    if (this.logLevels.hasOwnProperty(level)) {
      return this.logLevels[level];
    }

    try {
      var numericLevel = parseInt(String(level), 10);
      if (!isNaN(numericLevel)) {
        return numericLevel;
      }
      // eslint-disable-next-line no-unused-vars
    } catch (e) {
      // Do nothing, fall through to default
    }

    return this.logLevels[this.DEFAULT_LOG_LEVEL];
  },

  /**
   * Enables stack trace inclusion in log messages
   * @returns {SNLogger} The logger instance for chaining
   */
  withStackTrace: function () {
    this.stackTrace = true;
    return this;
  },

  /**
   * Sets whether logging should also print to console
   * @param {boolean} shouldPrint - Whether to print logs to console
   * @returns {SNLogger} The logger instance for chaining
   */
  setPrint: function (shouldPrint) {
    this.shouldPrint = !!shouldPrint;
    return this;
  },

  /**
   * Sets the log level to trace
   * @returns {SNLogger} The logger instance for chaining
   */
  setTrace: function () {
    this.setLogLevel("trace");
    this.logLevelManuallySet = true;
    return this;
  },

  /**
   * Sets the log level to debug
   * @returns {SNLogger} The logger instance for chaining
   */
  setDebug: function () {
    this.setLogLevel("debug");
    this.logLevelManuallySet = true;
    return this;
  },

  /**
   * Sets the log level to info
   * @returns {SNLogger} The logger instance for chaining
   */
  setInfo: function () {
    this.setLogLevel("info");
    this.logLevelManuallySet = true;
    return this;
  },

  /**
   * Sets the log level to warn
   * @returns {SNLogger} The logger instance for chaining
   */
  setWarn: function () {
    this.setLogLevel("warn");
    this.logLevelManuallySet = true;
    return this;
  },

  /**
   * Sets the log level to error
   * @returns {SNLogger} The logger instance for chaining
   */
  setError: function () {
    this.setLogLevel("error");
    this.logLevelManuallySet = true;
    return this;
  },

  /**
   * Sets the log level to fatal
   * @returns {SNLogger} The logger instance for chaining
   */
  setFatal: function () {
    this.setLogLevel("fatal");
    this.logLevelManuallySet = true;
    return this;
  },

  /**
   * Sets the log level to the specified level
   * @param {string} level - The log level to set
   * @returns {SNLogger} The logger instance for chaining
   */
  withLogLevel: function (level) {
    this.setLogLevel(level);
    this.logLevelManuallySet = true;
    return this;
  },

  /**
   * Internal logging function that handles all log levels
   * @private
   * @param {string} level - The log level
   * @param {string} msg - The message to log
   * @param {string|Array} [sourceOrArgs] - Either a source string or array of message arguments
   * @param {Array} [maybeArgs] - Message arguments when the source is provided
   */
  _log: function (level, msg, sourceOrArgs, maybeArgs) {
    var actualSource = this.source;
    var actualArgs = [];

    var numLevel = this._normalizeLogLevel(level);
    if (!this._shouldLog(numLevel)) {
      return;
    }

    if (typeof sourceOrArgs === "string") {
      actualSource = sourceOrArgs;
      actualArgs = maybeArgs || [];
    } else if (Array.isArray(sourceOrArgs)) {
      actualArgs = sourceOrArgs;
    }

    if (actualSource) {
      this.setSource(actualSource);
    }
    var formattedMsg = this._buildMessage(msg, actualArgs, numLevel);

    this._insertLog(numLevel, formattedMsg);
  },

  /**
   * Gets the stack trace for the current execution context
   * @private
   * @returns {string} The formatted stack trace string
   */
  _getStackTrace: function () {
    return "\n\n" + GlideLog.getStackTrace(new Packages.java.lang.Throwable());
  },

  /**
   * Records and logs the elapsed time between method calls
   * The first call initializes timing; subsequent calls log the elapsed time
   * since the last call and total time since initialization
   * @returns {number} The elapsed time in milliseconds since the last call
   */
  logTiming: function () {
    var end = new Date().getTime();
    if (this.theLastTime === 0) {
      this.theLastTime = end;
    }
    if (this.theBeginTime === 0) {
      this.theBeginTime = end;
    }
    var sectionTime = end - this.theLastTime;
    var totalTime = end - this.theBeginTime;
    this.log("Section Time: {0}ms | Total Time: {1}ms", [sectionTime, totalTime]);
    this.theLastTime = end;
    return sectionTime;
  },

  /**
   * Logs a fatal level message
   * @param {string} msg - The message to log
   * @param {string|Array} [sourceOrArgs] - Either a source string or array of message arguments
   * @param {Array} [maybeArgs] - Message arguments when the source is provided
   */
  fatal: function (msg, sourceOrArgs, maybeArgs) {
    this._log("fatal", msg, sourceOrArgs, maybeArgs);
  },
  /**
   * Logs an error level message
   * @param {string} msg - The message to log
   * @param {string|Array} [sourceOrArgs] - Either a source string or array of message arguments
   * @param {Array} [maybeArgs] - Message arguments when the source is provided
   */
  error: function (msg, sourceOrArgs, maybeArgs) {
    this._log("error", msg, sourceOrArgs, maybeArgs);
  },
  /**
   * Logs a warning level message
   * @param {string} msg - The message to log
   * @param {string|Array} [sourceOrArgs] - Either a source string or array of message arguments
   * @param {Array} [maybeArgs] - Message arguments when the source is provided
   */
  warn: function (msg, sourceOrArgs, maybeArgs) {
    this._log("warn", msg, sourceOrArgs, maybeArgs);
  },
  /**
   * Logs an info level message
   * @param {string} msg - The message to log
   * @param {string|Array} [sourceOrArgs] - Either a source string or array of message arguments
   * @param {Array} [maybeArgs] - Message arguments when the source is provided
   */
  info: function (msg, sourceOrArgs, maybeArgs) {
    this._log("info", msg, sourceOrArgs, maybeArgs);
  },
  /**
   * Logs a debug level message
   * @param {string} msg - The message to log
   * @param {string|Array} [sourceOrArgs] - Either a source string or array of message arguments
   * @param {Array} [maybeArgs] - Message arguments when the source is provided
   */
  debug: function (msg, sourceOrArgs, maybeArgs) {
    this._log("debug", msg, sourceOrArgs, maybeArgs);
  },
  /**
   * Logs a trace level message
   * @param {string} msg - The message to log
   * @param {string|Array} [sourceOrArgs] - Either a source string or array of message arguments
   * @param {Array} [maybeArgs] - Message arguments when the source is provided
   */
  trace: function (msg, sourceOrArgs, maybeArgs) {
    this._log("trace", msg, sourceOrArgs, maybeArgs);
  },

  /**
   * Logs a message at info level (alias for info)
   * @param {string} msg - The message to log
   * @param {string|Array} [sourceOrArgs] - Either a source string or array of message arguments
   * @param {Array} [maybeArgs] - Message arguments when the source is provided
   */
  log: function (msg, sourceOrArgs, maybeArgs) {
    this.info(msg, sourceOrArgs, maybeArgs);
  },

  /**
   * Records and logs the elapsed time between method calls and total execution time
   * The first call initializes the timing; subsequent calls log the time elapsed since the last call
   * and the total time since the first call
   */
  theLastTime: 0,
  theBeginTime: 0,
  type: "SNLogger"
};
