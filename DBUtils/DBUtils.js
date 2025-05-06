/**
 * @typedef {Object} DefineTablesAndFieldsRequest
 * @property {TableDefinition[]} tables
 * @property {FieldDefinition[]} fields
 */

/**
 * @typedef {Object} TableDefinition
 * @property {string} name - Must start with 'u_'
 * @property {string} [label]
 * @property {string} [extend] - Must start with 'u_'
 * @property {boolean} [isExtendable]
 * @property {string} [role]
 * @property {boolean} [configAccess]
 * @property {boolean} [publicAccess]
 */

/**
 * @typedef {Object} FieldDefinition
 * @property {string} table - Must start with 'u_'
 * @property {string} name - Must start with 'u_'
 * @property {string} [label]
 * @property {FieldType} type
 * @property {string} [referenceTable] - Must start with 'u_'
 * @property {string} [defaultValue]
 * @property {ChoiceDefinition[]} [choices]
 * @property {boolean} [useDependentField]
 * @property {string} [dependentOnField]
 */

/**
 * @typedef {Object} ChoiceDefinition
 * @property {string} value
 * @property {string} label
 * @property {string} [language]
 * @property {boolean} [inactive]
 * @property {number} [sequence]
 */

/**
 * @typedef {
 *   'audio' |
 *   'boolean' |
 *   'calendar_date_time' |
 *   'choice' |
 *   'color' |
 *   'conditions' |
 *   'condition_string' |
 *   'currency' |
 *   'currency2' |
 *   'data_structure' |
 *   'decimal' |
 *   'document_id' |
 *   'domain_id' |
 *   'due_date' |
 *   'field_name' |
 *   'file_attachment' |
 *   'float' |
 *   'geo_point' |
 *   'glide_date' |
 *   'glide_date_time' |
 *   'glide_duration' |
 *   'glide_encrypted' |
 *   'glide_list' |
 *   'glide_time' |
 *   'glide_utc_time' |
 *   'html' |
 *   'icon' |
 *   'insert_timestamp' |
 *   'integer' |
 *   'ip_addr' |
 *   'journal' |
 *   'journal_input' |
 *   'journal_list' |
 *   'language' |
 *   'longint' |
 *   'nds_icon' |
 *   'password' |
 *   'password2' |
 *   'percent_complete' |
 *   'phone_number_e164' |
 *   'price' |
 *   'public_image' |
 *   'reference' |
 *   'script' |
 *   'script_plain' |
 *   'simple_name_values' |
 *   'string' |
 *   'string_full_utf8' |
 *   'table_name' |
 *   'translated_html' |
 *   'translated_text' |
 *   'url' |
 *   'user_image' |
 *   'variables' |
 *   'video' |
 *   'wiki_text' |
 *   'workflow'
 * } FieldType
 */

/**
 * Script Include: DBUtils
 *
 * Contains utility functions for creating fields and tables.
 */
var DBUtils = Class.create();
// noinspection JSUnusedGlobalSymbols
DBUtils.prototype = {
  initialize: function () {
    this.errors = []; // Array to collect errors
    this.logger = SNLog.getLogger().withSource(this.type);
  },

  /**
   * Creates a table with the given parameters.
   * @param {string} tableName - The name of the table.
   * @param {string} label - The label of the table.
   * @param {string} extend - The table to extend (optional).
   * @param {boolean} isExtendable - Whether the table can be extended (optional).
   * @param {string} role - The sys_id of the role to assign to the table (optional).
   * @param {boolean} configAccess - Configuration access (optional).
   * @param {boolean} publicAccess - Public access (optional).
   * @returns {string|null} - The sys_id of the created or updated table.
   */
  createTable: function (tableName, label, extend, isExtendable, role, configAccess, publicAccess) {
    this.log("Creating table: " + tableName);

    var tableGR = new GlideRecord("sys_db_object");
    tableGR.addQuery("name", tableName);
    tableGR.query();
    if (tableGR.next()) {
      // Table already exists
      return tableGR.sys_id.toString();
    }

    tableGR.initialize();
    tableGR.name = tableName;
    tableGR.label = label || tableName;
    if (extend) {
      var superGR = new GlideRecord("sys_db_object");
      superGR.addQuery("name", extend);
      superGR.setLimit(1);
      superGR.query();
      if (superGR.next()) {
        tableGR.super_class = superGR.sys_id.toString();
      } else {
        this.errors.push("Table to extend not found: " + extend);
        return null;
      }
    }
    tableGR.is_extendable = isExtendable || false;
    tableGR.configuration_access = configAccess || false;
    tableGR.create_access_controls = !!role;
    if (role) {
      var roleGR = new GlideRecord("sys_user_role");
      roleGR.addQuery("name", role);
      roleGR.setLimit(1);
      roleGR.query();
      if (roleGR.next()) {
        tableGR.user_role = roleGR.sys_id.toString();
      } else {
        this.errors.push("Role not found: " + role);
      }
    }
    tableGR.setValue("public", publicAccess !== undefined ? publicAccess : false);
    tableGR.sys_name = tableName;
    tableGR.insert();

    return tableGR.sys_id.toString();
  },

  /**
   * Gets the absolute base table name for the given table.
   *
   * This method retrieves the root table from which the specified table inherits.
   * For example, if 'incident' extends 'task', this method would return 'task'.
   * If the table does not extend any other table, it returns the input table name.
   *
   * @param {string} tableName - The name of the table to get the root table for.
   * @returns {string} The name of the root/base table.
   */
  getRootTable: function (tableName) {
    var table = new TableUtils(tableName);
    return table.getAbsoluteBase();
  },

  /**
   * Creates a field with the given parameters.
   * @param {string} tableName - The name of the table.
   * @param {string} fieldName - The name of the field.
   * @param {string} fieldLabel - The label of the field.
   * @param {string} fieldType - The type of the field.
   * @param {string} referenceTable - The table that the field references (optional).
   * @param {boolean} useDependentField - Whether to use a dependent field (optional).
   * @param {string} dependent - The dependent field (optional).
   * @param {string} dependentOnField - The field that the dependent field depends on (optional).
   * @param {string} [defaultValue] - The default value for the field (optional).
   * @param {number} [choice=0] - The choice field type (1 = Dropdown w/ None, 3 = Dropdown w/o None, default is blank).
   * @param {number} [maxLength] - The maximum length of the field (optional).
   * @returns {string|null} - The sys_id of the created or updated field.
   */
  createField: function (tableName, fieldName, fieldLabel, fieldType, referenceTable, useDependentField, dependent, dependentOnField, defaultValue, choice, maxLength) {
    this.log("Creating field: " + fieldName + " in table: " + tableName);

    // noinspection SpellCheckingInspection
    var validTypes = ["audio", "boolean", "calendar_date_time", "choice", "color", "conditions", "condition_string", "currency", "currency2", "data_structure", "decimal", "document_id", "domain_id", "due_date", "email_script", "field_name", "file_attachment", "float", "geo_point", "glide_date", "glide_date_time", "glide_duration", "glide_encrypted", "glide_list", "glide_time", "glide_utc_time", "html", "icon", "insert_timestamp", "integer", "ip_addr", "journal", "journal_input", "journal_list", "language", "longint", "nds_icon", "password", "password2", "percent_complete", "phone_number_e164", "price", "public_image", "reference", "script", "script_plain", "simple_name_values", "string", "string_full_utf8", "table_name", "translated_html", "translated_text", "url", "user_image", "variables", "video", "wiki_text", "workflow", "xml"];

    if (validTypes.indexOf(fieldType) === -1) {
      this.errors.push("Invalid field type: " + fieldType);
      return null;
    }

    var fieldGR = new GlideRecord("sys_dictionary");
    fieldGR.addQuery("name", tableName);
    fieldGR.addQuery("element", fieldName);
    fieldGR.query();
    if (fieldGR.next()) {
      // Field already exists
      return fieldGR.sys_id.toString();
    }

    fieldGR.initialize();
    fieldGR.name = tableName;
    fieldGR.element = fieldName;
    fieldGR.column_label = fieldLabel || fieldName;
    fieldGR.internal_type = fieldType;

    if (fieldType === "string" && maxLength) {
      fieldGR.max_length = maxLength;
    }

    if (fieldType === "reference" && referenceTable) {
      var refTableGR = new GlideRecord("sys_db_object");
      refTableGR.addQuery("name", referenceTable);
      refTableGR.setLimit(1);
      refTableGR.query();
      if (refTableGR.next()) {
        fieldGR.reference = referenceTable;
      } else {
        this.errors.push("Reference table not found: " + referenceTable);
        return null;
      }
    }

    if (fieldType === "glide_list" && referenceTable) {
      var listTableGR = new GlideRecord("sys_db_object");
      listTableGR.addQuery("name", referenceTable);
      listTableGR.setLimit(1);
      listTableGR.query();
      if (!listTableGR.next()) {
        this.errors.push("Reference table not found for glide_list: " + referenceTable);
        return null;
      }
    }

    if (fieldType === "document_id" && !dependent) {
      this.errors.push("Document ID field type requires a dependent field.");
      return null;
    }

    if (fieldType === "choice" || fieldType === "string") {
      if (choice === 1) {
        fieldGR.choice = 1; // Dropdown w/ None
      } else if (choice === 3) {
        fieldGR.choice = 3; // Dropdown w/o None
        if (!defaultValue) {
          this.errors.push("Choice field type set to Dropdown w/o None requires a default value.");
          return null;
        }
      } else {
        fieldGR.choice = ""; // Blank, meaning not set
      }
    }

    if (fieldType === "choice" && defaultValue) {
      fieldGR.default_value = defaultValue;
    } else if (fieldType === "choice") {
      fieldGR.default_value = "none"; // Default choice value
    }

    fieldGR.use_dependent_field = useDependentField || false;
    if (useDependentField) {
      fieldGR.dependent = dependent || "";
      fieldGR.dependent_on_field = dependentOnField || "";
    }
    fieldGR.insert();

    return fieldGR.sys_id.toString();
  },

  /**
   * Creates a sys_choice record.
   * @param {string} tableName - The name of the table.
   * @param {string} fieldName - The name of the field.
   * @param {string} choiceValue - The value of the choice.
   * @param {string} choiceLabel - The label of the choice.
   * @param {string} [language='en'] - The language of the choice.
   * @param {boolean} [inactive=false] - Whether the choice is inactive.
   * @param {number} [sequence=0] - The sequence order of the choice.
   * @returns {string} - The sys_id of the created choice record.
   */
  createChoice: function (tableName, fieldName, choiceValue, choiceLabel, language, inactive, sequence) {
    this.log("Creating choice: " + choiceValue + " for field: " + fieldName + " in table: " + tableName);

    language = language || "en"; // Default to 'en'
    inactive = inactive || false; // Default to false
    sequence = sequence || 0; // Default to 0

    var choiceGR = new GlideRecord("sys_choice");
    choiceGR.addQuery("name", tableName);
    choiceGR.addQuery("element", fieldName);
    choiceGR.addQuery("value", choiceValue);
    choiceGR.query();
    if (choiceGR.next()) {
      // Choice already exists
      return choiceGR.sys_id.toString();
    }

    choiceGR.initialize();
    choiceGR.name = tableName;
    choiceGR.element = fieldName;
    choiceGR.value = choiceValue;
    choiceGR.label = choiceLabel;
    choiceGR.language = language;
    choiceGR.inactive = inactive;
    choiceGR.sequence = sequence; // Set the sequence order
    choiceGR.insert();

    return choiceGR.sys_id.toString();
  },

  /**
   * Creates tables and fields based on a JSON structure.
   * @param {DefineTablesAndFieldsRequest} definition - The JSON structure defining tables and fields.
   */
  createFromDefinition: function (definition) {
    if (!definition.tables || !Array.isArray(definition.tables)) {
      this.errors.push("Tables definition is missing or invalid.");
      return;
    }

    var tables = definition.tables.slice();
    var fields = definition.fields || [];

    // Ensure tables are created in the correct order
    var tableMap = {};
    tables.forEach(function (table) {
      tableMap[table.name] = table;
    });

    var tableCreationOrder = [];
    var processedTables = {};

    function addTableToCreationOrder(tableName) {
      if (processedTables[tableName]) {
        return;
      }
      var table = tableMap[tableName];
      if (table && table.extend) {
        addTableToCreationOrder(table.extend);
      }
      processedTables[tableName] = true;
      tableCreationOrder.push(table);
    }

    tables.forEach(function (table) {
      addTableToCreationOrder(table.name);
    });

    tableCreationOrder.forEach(function (table) {
      this.createTable(table.name, table.label, table.extend, table.isExtendable, table.role, table.configAccess, table.publicAccess);
    }, this);

    // Ensure fields are created in the correct order
    var fieldMap = {};
    fields.forEach(function (field) {
      fieldMap[field.name] = field;
    });

    var fieldCreationOrder = [];
    var processedFields = {};

    function addFieldToCreationOrder(fieldName) {
      if (processedFields[fieldName]) {
        return;
      }
      var field = fieldMap[fieldName];
      if (field && field.dependentOnField) {
        addFieldToCreationOrder(field.dependentOnField);
      }
      processedFields[fieldName] = true;
      fieldCreationOrder.push(field);
    }

    fields.forEach(function (field) {
      addFieldToCreationOrder(field.name);
    });

    fieldCreationOrder.forEach(function (field) {
      this.createField(
        field.table,
        field.name,
        field.label,
        field.type,
        field.referenceTable,
        field.useDependentField,
        field.dependent,
        field.dependentOnField,
        field.defaultValue, // Ensure this parameter is handled in createField
        field.type === "choice" ? field.choices : undefined, // Pass choices if the type is "choice"
        field.maxLength
      );

      // Create choice records if the field type is "choice" and choices are provided
      if (field.type === "choice" && field.choices && Array.isArray(field.choices)) {
        field.choices.forEach(function (choice) {
          this.createChoice(field.table, field.name, choice.value, choice.label, choice.language, choice.inactive, choice.sequence);
        }, this);
      }
    }, this);

    if (this.errors.length > 0) {
      this.reportErrors();
    }
  },

  /**
   * Creates tables and fields based on a JSON string.
   * @param {string} jsonString - The JSON string defining tables and fields.
   */
  createFromJSONString: function (jsonString) {
    try {
      var definition = JSON.parse(jsonString);
      this.createFromDefinition(definition);
    } catch (e) {
      this.errors.push("Invalid JSON string: " + e.message);
      this.reportErrors();
    }
  },

  /**
   * Report any errors encountered during processing.
   */
  reportErrors: function () {
    this.error("Errors encountered during processing:");
    this.logger.setPrint(true);
    // eslint-disable-next-line servicenow/minimize-gs-log-print
    this.log("Errors encountered during processing:");
    this.errors.forEach(function (error) {
      this.error(error);
    }, this);
    this.logger.setPrint(false);
  },

  /**
   * Retrieves the parent table name for a given table by querying the sys_db_object record.
   *
   * This function checks if the specified table extends another table by looking up its
   * super_class reference in the sys_db_object table. If the table exists and has a parent,
   * the parent table name is returned. Otherwise, returns false.
   *
   * @param {string} tableName - The name of the table to look up the parent for.
   * @returns {string|null} The name of the parent table if one exists, or false if:
   *                          - The input is invalid or empty
   *                          - The table does not exist
   *                          - The table does not extend another table
   *                          - An error occurs during execution
   */
  getParentTable: function (tableName) {
    try {
      // Validate the input
      if (!tableName || typeof tableName !== "string") {
        return null;
      }

      // Query sys_db_object for the specified table name
      var dbObjectGR = new GlideRecord("sys_db_object");
      dbObjectGR.addQuery("name", tableName);
      dbObjectGR.setLimit(1);
      dbObjectGR.query();

      // Check if the table exists
      if (dbObjectGR.next()) {
        // If super_class is blank, the table doesn't extend another table
        if (gs.nil(dbObjectGR.super_class)) {
          return null; // The table does not extend another table
        }

        // If super_class is not blank, return the name of the parent table
        return dbObjectGR.super_class.name.toString();
      }
      return null;
      // eslint-disable-next-line no-unused-vars
    } catch (error) {
      return null;
    }
  },

  /**
   * Retrieves a list of table names that contain a specific field
   * Only searches for script type fields (script, script_server, script_plain)
   * @returns {GlideRecord} GlideRecord script fields.
   */
  getScriptFields: function () {
    var dictionaryGR = new GlideRecord("sys_dictionary");
    try {
      dictionaryGR.addActiveQuery();
      dictionaryGR.addQuery("internal_type", "IN", "script,script_server,script_plain");
      dictionaryGR.addQuery("name", "DOES NOT CONTAIN", "var_");
      dictionaryGR.addQuery("name", "DOES NOT CONTAIN", "usageanalytics_count");
      dictionaryGR.addQuery("name", "DOES NOT CONTAIN", "syslog");
      dictionaryGR.addQuery("name", "DOES NOT CONTAIN", "sn_doc_");
      dictionaryGR.addQuery("name", "DOES NOT CONTAIN", "sys_ux_");
      dictionaryGR.addQuery("name", "DOES NOT CONTAIN", "x_yala_");
      dictionaryGR.addQuery("name", "!=", "sys_query_rewrite");
      dictionaryGR.addQuery("name", "!=", "v_transaction");
      dictionaryGR.addQuery("name", "!=", "sys_report_summary_line");
      dictionaryGR.addQuery("name", "!=", "sys_query_pattern");
      dictionaryGR.addQuery("name", "!=", "sys_transaction_pattern");
      dictionaryGR.addQuery("name", "!=", "sys_flow_runtime_value");
      dictionaryGR.addQuery("name", "!=", "sys_pd_activity_context");
      dictionaryGR.addQuery("name", "!=", "sys_search_signal_event");
      dictionaryGR.addQuery("name", "!=", "asmt_assessment_instance");
      dictionaryGR.addQuery("name", "!=", "sn_ci_analytics_conversation");
      dictionaryGR.addQuery("name", "!=", "sys_flow_context");
      dictionaryGR.addQuery("name", "!=", "sys_variable_value");
      dictionaryGR.addQuery("name", "!=", "sn_vul_nvd_entry");
      dictionaryGR.addQuery("name", "!=", "sys_flow_value");
      dictionaryGR.addQuery("name", "!=", "sn_infoblox_spoke_cname_records");
      dictionaryGR.addQuery("name", "!=", "sys_pd_context");
      dictionaryGR.addQuery("name", "!=", "sys_pd_lane_context");
      dictionaryGR.addQuery("name", "!=", "em_alert");
      dictionaryGR.addQuery("name", "!=", "sn_jamf_integrate_sg_jamf_computers");
      dictionaryGR.addQuery("name", "!=", "sys_script_execution_history");
      dictionaryGR.addQuery("name", "!=", "sn_ex_sp_task_tab_configuration");
      dictionaryGR.query();
    } catch (err) {
      this.error(err);
    }
    return dictionaryGR;
  },

  /**
   * Retrieves the table hierarchy for the specified table name.
   *
   * This function first checks a cached hierarchy in the `MC.HIERARCHY` object
   * to see if the hierarchy for the given table name is already available.
   * If not found, it uses system utilities to determine the hierarchy.
   * The resulting hierarchy is a comma-separated string of tables.
   *
   * @param {string} tableName - The name of the table whose hierarchy is to be retrieved.
   * @returns {string} A comma-separated string of table names representing the hierarchy of the table.
   */
  getTableHierarchy: function (tableName) {
    var tables = String(tableName);
    var util = new TableUtils(tableName);
    if (util.tableExists()) {
      var tableArrayList = GlideDBObjectManager.get().getTables(tableName);

      // Use the j2js method to convert the Java ArrayList to JavaScript
      gs.include("j2js");
      var tableArray = j2js(tableArrayList);
      tables = tableArray.join(",");
    }
    return tables;
  },

  /**
   * Checks if a field already exists locally in the specified table hierarchy.
   *
   * @param {string} tableName - The name of the table to check for the field.
   * @param {string} fieldName - The name of the field to check for existence.
   * @returns {boolean} Returns `true` if the field exists locally in the table hierarchy, otherwise `false`.
   */
  fieldExistsLocally: function (tableName, fieldName) {
    var dictGR = new GlideRecord("sys_dictionary");
    dictGR.addQuery("name", "IN", this.getTableHierarchy(tableName));
    dictGR.addQuery("element", fieldName);
    dictGR.queryNoDomain();
    return dictGR.hasNext();
  },

  /**
   * Counts the number of local records in a specified table that match a given encoded query.
   *
   * This function uses the GlideAggregate API to execute a query against the specified table
   * and retrieves the count of records matching the encoded query. It logs the encoded query
   * and the resulting count for debugging purposes.
   *
   * @param {string} table - The name of the table to query.
   * @param {string} encodedQuery - The encoded query to filter records in the table.
   * @returns {number} The count of local records that match the query.
   */
  countRecords: function (table, encodedQuery) {
    var ga = new GlideAggregate(table);
    ga.addEncodedQuery(encodedQuery);
    ga.addAggregate("COUNT");
    ga.queryNoDomain();
    if (ga.next()) {
      // eslint-disable-next-line servicenow/minimize-gs-log-print
      return parseInt(String(ga.getAggregate("COUNT")), 10);
    }
    return 0;
  },

  trim: function (str) {
    return String(str).trim();
  },

  setDebug: function (debug) {
    if (debug) {
      this.logger.setDebug();
      this.logger.setPrint(true);
    } else {
      this.logger.useAutoLogLevel();
      this.logger.setPrint(false);
    }
  },

  /*
   * log() <br />
   * Used to log items for debugging purposes.
   */
  log: function (msg) {
    this.logger.log(msg);
  },

  /*
   * error() <br />
   * Used to log items for debugging purposes.
   */
  error: function (msg) {
    this.logger.error(msg);
  },

  logTiming: function () {
    this.logger.logTiming();
  },

  type: "DBUtils"
};
