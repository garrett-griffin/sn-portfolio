// noinspection JSUnusedGlobalSymbols

/**
 * Handles translation of notification emails including subjects and message bodies
 * based on recipient language preferences and configured translations.
 * @class
 * @property {GlideRecord} record - The record associated with the notification
 * @property {TemplatePrinter} template - Template printer instance
 * @property {Object} email - Email outbound record
 * @property {GlideRecord} email_action - Email action record
 * @property {GlideRecord} event - Event record
 * @property {string} fallbackLanguage - Default fallback language code
 * @property {string} language - Current language code
 * @property {boolean} parametersSet - Whether parameters have been initialized
 * @property {GlideRecord} translation - Translation record
 * @property {boolean} showErrors - Whether to show translation errors
 */
var NotificationTranslationEngine = Class.create();
NotificationTranslationEngine.prototype = {
  record: false,
  template: false,
  email: false,
  email_action: null,
  event: false,
  fallbackLanguage: "en",
  language: "en",
  parametersSet: false,
  translation: false,
  showErrors: false,

  /**
   * Initializes a new instance of NotificationTranslationEngine
   * @param {GlideRecord} record - The record associated with the notification
   * @param {TemplatePrinter} template - Template printer instance
   * @param {Object} [email] - Email outbound record
   * @param {GlideRecord} [email_action] - Email action record
   * @param {GlideRecord} [event] - Event record
   */
  initialize: function (/* GlideRecord */ record, /* TemplatePrinter */ template, /* Optional EmailOutbound */ email, /* Optional GlideRecord */ email_action, /* Optional GlideRecord */ event) {
    if (typeof record !== "undefined" && typeof template !== "undefined" && typeof email !== "undefined" && typeof email_action !== "undefined" && typeof event !== "undefined") {
      this.setParameters(record, template, email, email_action, event);
    }
    this.logger = SNLog.getLogger().withSource("NotificationTranslationEngine");
    this.showErrors = gs.getProperty("notifications.embedded_data.show_errors", false);
  },

  /**
   * Sets parameters for translation and determines language and translation
   * @param {GlideRecord} record - The record associated with the notification
   * @param {TemplatePrinter} template - Template printer instance
   * @param {Object} [email] - Email outbound record
   * @param {GlideRecord} [email_action] - Email action record
   * @param {GlideRecord} [event] - Event record
   */
  setParameters: function (/* GlideRecord */ record, /* TemplatePrinter */ template, /* Optional EmailOutbound */ email, /* Optional GlideRecord */ email_action, /* Optional GlideRecord */ event) {
    this.record = record;
    this.template = template;
    this.email = email;
    this.email_action = email_action;
    this.event = event;

    this.determineLanguage();
    this.findTranslation();

    this.parametersSet = true;
  },

  /**
   * Gets language preference for a user ID by checking sys_user, group membership and HR profile
   * @param {string} userID - The sys_id of the user, group or profile to get language for
   * @returns {boolean} True if language was determined successfully, false if not found
   */
  getLanguageFromUserID: function (userID) {
    var usr = new GlideRecord("sys_user");
    usr.addQuery("sys_id", userID);
    usr.addQuery("sys_id", "!=", "");
    usr.addQuery("active", true);
    usr.setLimit(1);
    usr.query();
    if (usr.next()) {
      this.language = usr.u_cms_hr_language.toString();
      this.languageDetermined = true;
      return true;
    }
    var member = new GlideRecord("sys_user_grmember");
    member.addQuery("group", userID);
    member.addQuery("user.active", true);
    member.setLimit(1);
    member.query();
    if (member.next()) {
      return this.getLanguageFromUserID(member.user.toString());
    }

    var profile = new GlideRecord("sn_hr_core_profile");
    if (profile.get("sys_id", userID)) {
      if (profile.user.toString() !== "") {
        return this.getLanguageFromUserID(profile.user.toString());
      }
    }

    return false;
  },
  /**
   * Gets language preference by checking referenced user, group or HR profile in a specified field
   * @param {string} fieldName - Name of the reference field to check
   * @param {boolean} [useEmailAction=false] - Whether to check field on email action record instead of current record
   * @returns {boolean} True if language was determined successfully, false if not found
   */
  getLanguageFromField: function (fieldName, useEmailAction) {
    if (typeof useEmailAction == "undefined") {
      useEmailAction = false;
    }
    useEmailAction = !!useEmailAction;
    if (!useEmailAction && !this.record) {
      return false;
    }
    if (useEmailAction && !this.email_action) {
      return false;
    }
    if (fieldName === "") {
      return false;
    }
    var el;
    if (!useEmailAction) {
      el = this.record.getElement(fieldName);
    } else {
      el = this.email_action.getElement(fieldName);
    }
    if (!el) {
      return false;
    }
    var ed = el.getED();
    if (ed.getInternalType() !== "reference" && ed.getInternalType() !== "glide_list") {
      this.error("Element was not a reference field or glide list -- it was: " + ed.getInternalType());
      return false;
    }
    if (el.getReferenceTable() !== "sys_user" && el.getReferenceTable() !== "sys_user_group" && el.getReferenceTable() !== "sn_hr_core_profile") {
      return false;
    }
    var sysid = "";
    if (ed.getInternalType() === "glide_list") {
      if (el.toString() !== "") {
        var vals = el.toString().split(",");
        if (vals[0] !== "") {
          sysid = String(vals[0]);
        }
      }
    } else {
      sysid = el.toString();
    }
    if (el.getReferenceTable() === "sys_user_group" && sysid !== "") {
      var member = new GlideRecord("sys_user_grmember");
      member.addQuery("group", sysid);
      member.addQuery("user.active", true);
      member.setLimit(1);
      member.query();
      if (member.next()) {
        sysid = member.user.toString();
      }
    }
    if (el.getReferenceTable() === "sn_hr_core_profile" && sysid !== "") {
      var profile = new GlideRecord("sn_hr_core_profile");
      if (profile.get("sys_id", sysid)) {
        if (profile.user.toString() !== "") {
          sysid = profile.user.toString();
        }
      }
    }
    return this.getLanguageFromUserID(sysid);
  },

  /**
   * Determines the language for translation based on various configuration sources
   * @returns {string} The determined language code
   */
  determineLanguage: function () {
    this.languageDetermined = false;
    if (this.email_action !== "undefined" && this.email_action !== "" && this.email_action.u_language_source.toString() !== "") {
      switch (this.email_action.u_language_source.toString()) {
        case "Field on Record":
          this.getLanguageFromField(this.email_action.u_translation_field.toString());
          break;
        case "Parameter 1":
          this.getLanguageFromUserID(this.event.parm1);
          break;
        case "Parameter 2":
          this.getLanguageFromUserID(this.event.parm2);
          break;
        case "User field on Notification":
          this.getLanguageFromField("recipient_users", true);
          break;
        case "Group field on Notification":
          this.getLanguageFromField("recipient_groups", true);
          break;
        case "Current record":
          this.getLanguageFromUserID(this.record.sys_id);
          break;
        default:
          break;
      }
    }
    if ((!this.languageDetermined && this.record.sys_class_name === "sn_hr_core_case") || this.record.sys_class_name === "sn_hr_core_task") {
      // Determine the language of the Contact Employee
      this.getLanguageFromField("opened_for");
    } else if (!this.languageDetermined && this.record.sys_class_name === "kb_submission") {
      // See if it's in a parm
      this.getLanguageFromUserID(this.event.parm1);

      if (!this.languageDetermined) {
        this.getLanguageFromUserID(this.event.parm2);
      }
    }

    return this.language;
  },

  /**
   * Finds the appropriate translation record for the notification
   * Falls back to default language if specified language translation not found
   * @returns {GlideRecord|null} Translation record if found, false if no translation found
   */
  findTranslation: function () {
    var trans = new GlideRecord("x_wadm_nte_notification_translation");
    trans.addQuery("notification", this.email_action.sys_id.toString());
    trans.addQuery("language", this.language);
    trans.addQuery("active", true);
    trans.setLimit(1);
    trans.query();
    if (!trans.hasNext()) {
      trans = new GlideRecord("x_wadm_nte_notification_translation");
      trans.addQuery("notification", this.email_action.sys_id.toString());
      trans.addQuery("language", this.fallbackLanguage);
      trans.addQuery("active", true);
      trans.query();
    }
    if (!trans.hasNext()) {
      this.error("Could not find any translations for notification: " + this.email_action.getDisplayValue() + ".");
      return null;
    }
    trans.next();
    this.translation = trans;
    return trans;
  },

  /**
   * Translates the notification subject using the found translation
   * @returns {string} The translated subject string
   */
  translateSubject: function () {
    if (!this.parametersSet) {
      this.error("Parameters not properly set before translating subject.");
      return "";
    }
    if (this.translation === false) {
      this.error("Translation not properly identified. Could not translate Subject.");
      return "";
    }

    var subjectTxt = this.translation.subject.toString();

    this.log("Subject Text 1: " + subjectTxt);

    // Customization: Look for Scripts and parse them out.
    subjectTxt = this._processScripts(subjectTxt, this.record);
    this.log("Subject Text 2: " + subjectTxt);

    // Customization: Look for Fields and do the proper replacing
    subjectTxt = this._processFields(subjectTxt, this.record, this.showErrors);
    this.log("Subject Text 3: " + subjectTxt);

    return subjectTxt;
  },

  /**
   * Translates the notification body using the found translation
   * @returns {string} The translated message body string
   */
  translateBody: function () {
    if (!this.parametersSet) {
      this.error("Parameters not properly set before translating message body.");
      return "";
    }
    if (this.translation === false) {
      this.error("Translation not properly identified. Could not translate message body.");
      return "";
    }

    var msgTxt = this.translation.message.toString();

    // Customization: Look for Scripts and parse them out.
    msgTxt = this._processScripts(msgTxt, this.record);

    // Customization: Look for Fields and do the proper replacing
    msgTxt = this._processFields(msgTxt, this.record, this.showErrors);

    return msgTxt;
  },

  /**
   * Processes template variables in the document body and replaces them with actual field values.
   * Handles special cases for HR cases and tasks. Supports nested field references and translations.
   * @param {string} docBody - The document body text containing field placeholders to process
   * @param {GlideRecord} record - The GlideRecord containing the field values
   * @param {boolean} showErrors - Whether to show error messages for missing fields
   * @returns {string} The processed document body with all field placeholders replaced
   * @private
   */
  _processFields: function (docBody, record, showErrors) {
    this.log("Process Fields: " + docBody);

    if (typeof showErrors == "undefined") {
      showErrors = false;
    }

    if (String(record.sys_class_name).indexOf("sn_hr_core_case") >= 0 /* || gr.sys_class_name == "sn_hr_core_task" */) {
      docBody = docBody.replace("{{user}}", "{{opened_for}}");
    } else if (record.sys_class_name.toString() === "sn_hr_core_task") {
      docBody = docBody.replace("{{user}}", "{{opened_for}}");
    }

    // I'm going to find a string that I then need to make into gr.something.something.something.getDisplayValue();

    // Find any instance of {{fieldnamehere.someotherfieldnamehere}}
    var re;
    var match;
    var field;
    var el;
    var val;

    var startingLength = 1;
    var newLength = 0;

    while (newLength !== startingLength) {
      re = /\{\{([^}]+)}}/gim;

      startingLength = parseInt(String(docBody.length), 10);
      // eslint-disable-next-line no-cond-assign
      while ((match = re.exec(docBody)) !== null) {
        if (match.index === re.lastIndex) {
          re.lastIndex++;
        }

        // For each desired field found, cast it to lower case, and then try to get that element.
        field = match[1]
          .toLowerCase()
          .replace(/<([^>]*)>/gim, "")
          .replace("current.", "");
        if (field === "signature") {
          continue;
        }

        el = record.getElement(field);
        if (typeof el == "undefined" || el == null) {
          el = record.getElement("u_hr_case." + field);
          if (typeof el == "undefined" || el == null) {
            if (showErrors) {
              docBody = docBody.replace(match[0], "[[ERROR: Did not find field: " + field + ".]]");
            }
          } else {
            val = this.grabTranslation(field, "sn_hr_core_case", this.language, record);
            docBody = docBody.replace(match[0], val);
          }
        } else {
          val = this.grabTranslation(field, record.getTableName(), this.language, record);
          docBody = docBody.replace(match[0], val);
        }
      }

      newLength = parseInt(String(docBody.length), 10);
    }

    return docBody;
  },

  /**
   * Gets translated value for a field by checking choice tables and translation records
   * @param {string} field - The field name to translate
   * @param {string} table - The table name containing the field
   * @param {string} language - The language code to translate to
   * @param {GlideRecord} record - The record containing the field
   * @returns {string} The translated field value
   */
  grabTranslation: function (field, table, language, record) {
    this.log("Translating: " + table + "." + field);

    var text = "";

    var el = record.getElement(field);
    var ed = el.getED();

    if (ed.isChoiceTable()) {
      text = el.toString();
      this.log("Field: " + field + " is a choice field.");
      var ch = new GlideRecord("sys_choice");
      ch.addQuery("name", table);
      ch.addQuery("element", field);
      ch.addQuery("language", language);
      ch.addQuery("value", text);
      ch.addQuery("inactive", false);
      ch.setLimit(1);
      ch.query();
      gs.info("Field: " + field + " -- " + ch.getEncodedQuery());
      if (ch.next()) {
        return ch.label.toString();
      }
    } else {
      this.log("Field: " + field + " was not a choice field.");
    }

    text = el.getDisplayValue();

    var tt = new GlideRecord("sys_translated_text");
    tt.addQuery("tablename", table);
    tt.addQuery("documentkey", record.getUniqueValue());
    tt.addQuery("fieldname", field);
    tt.addQuery("language", language);
    tt.setLimit(1);
    tt.query();
    if (tt.next()) {
      return tt.value.toString();
    }

    var tn = new GlideRecord("sys_translated_text");
    tn.addQuery("name", table);
    tn.addQuery("id", record.getUniqueValue());
    tn.addQuery("element", field);
    tn.addQuery("language", language);
    tn.addQuery("value", text);
    tn.setLimit(1);
    tn.query();
    if (tn.next()) {
      return tn.label.toString();
    }

    tn = new GlideRecord("sys_translated");
    tn.addQuery("name", table);
    tn.addQuery("id", "");
    tn.addQuery("element", field);
    tn.addQuery("language", language);
    tn.addQuery("value", text);
    tn.setLimit(1);
    tn.query();
    if (tn.next()) {
      return tn.label.toString();
    }

    tn = new GlideRecord("sys_ui_message");
    tn.addQuery("key", text);
    tn.addQuery("language", language);
    tn.setLimit(1);
    tn.query();
    if (tn.next()) {
      return tn.message.toString();
    }

    return text;
  },

  /**
   * Processes an email notification script by ID and executes it against the given record
   * Emulates template.print functionality and sets up script execution environment
   * @param {string} scriptID - The sys_id of the email script to process
   * @param {GlideRecord} record - The record context to run the script against
   * @returns {string} The output generated by executing the email script
   * @private
   */
  _processScript: function (scriptID, record) {
    // For each script, run it.
    var result = "";

    // Emulate the "template.print" functionality from mail scripts.
    var template = {
      output: "",
      print: function (textToPrint) {
        result += textToPrint;
      },
      getResult: function () {
        return result;
      }
    };
    // Emulate the "template.print" functionality from mail scripts.
    var prependScript = 'var template = { output: "", print: function(textToPrint) { result  += textToPrint; }, getResult: function() { return result ; } };';

    // Emulate the "current" functionality from mail scripts
    var current = record;

    var pdfScript = new GlideRecord("sys_script_email");
    if (pdfScript.get("sys_id", scriptID)) {
      try {
        // var current = this.record;
        // var template = this.template;
        var email = this.email;
        var email_action = this.email_action;
        var event = this.event;

        if (pdfScript.script !== "") {
          pdfScript.script = prependScript + pdfScript.script.toString();

          var vars = {
            current: current,
            // 'template' : template,
            email: email,
            email_action: email_action,
            event: event,
            result: ""
          };

          this.log("Mail Script: " + pdfScript.name.getDisplayValue());
          this.log("Output Before: " + result);
          var evaluator = new GlideScopedEvaluator();
          this.log("Evaluator Result: " + evaluator.evaluateScript(pdfScript, "script", vars));
          result = evaluator.getVariable("result");
          this.log("Output After: " + result);
          // eval(pdfScript.script);
        }
      } catch (err) {
        this.error(err);
        template.print("[[ERROR: Mail Script did not compile correctly.]]");
      }
    }
    return String(template.getResult());
  },

  /**
   * Processes mail scripts embedded in document body text using {{mail_script:name}} syntax
   * Finds and executes referenced email scripts against the given record
   * Replaces script placeholders with generated output
   * @param {string} docBody - The document body text containing script references
   * @param {GlideRecord} record - The record context to run scripts against
   * @returns {string} The processed document body with script output inserted
   * @private
   */
  _processScripts: function (docBody, record) {
    // Customization: Look for Scripts and parse them out.
    // Find any instance of {{pdf_script: Name of Template Here}}

    var startingLength = 1;
    var newLength = 0;

    while (newLength !== startingLength) {
      var re = /\{\{mail_script:([^}]*)}}/gi;
      var match;

      startingLength = parseInt(String(docBody.length), 10);
      // eslint-disable-next-line no-cond-assign
      while ((match = re.exec(docBody)) !== null) {
        if (match.index === re.lastIndex) {
          re.lastIndex++;
        }
        // For each instance found, attempt to find that subtemplate.
        var script = new GlideRecord("sys_script_email");
        var qc = script.addQuery("name", match[1]);
        qc.addOrCondition("sys_id", match[1]);
        script.setLimit(1);
        script.query();
        if (script.next()) {
          // If found, generate the proper subtemplate text.
          var text = this._processScript(String(script.sys_id), record);

          // Now replace that actual instance with the resulting text
          docBody = docBody.replace(match[0], text);
        }
      }

      newLength = parseInt(String(docBody.length), 10);
    }

    return docBody;
  },

  /**
   * Sets debug mode for the logger
   * Enables/disables debug logging and console output
   * @param {boolean} debug - Whether to enable debug mode
   */
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
   * log() <br />
   * Used to log items for debugging purposes.
   */
  error: function (msg) {
    this.logger.error(msg);
  },

  /**
   * Logs timing information from the logger
   * Uses the configured logger to output timing metrics
   */
  logTiming: function () {
    this.logger.logTiming();
  },

  type: "NotificationTranslationEngine"
};
