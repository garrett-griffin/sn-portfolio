/**
 * Created by Garrett on 3/09/2016.
 * Enhanced by Garrett on 10/25/2019.
 */
var ConfigurationBackup = Class.create();
ConfigurationBackup.prototype = {
  initialize: function() {
    var debug = gs.getProperty('configuration_backup.debug', 'false');
    this.debugFlag = debug === 'true';
    this.googleDrive = gs.getProperty('configuration_backup.google_drive', 'false') === 'true';
  },
  backupData: function(tempLocalUpdateSet) {
    this.log('Testing Login Credentials');
    var credentialsValid = this.testLoginCredentials();
    if (!credentialsValid) {
      this.error('Exiting because Credentials are invalid and therefore script will eventually fail.');
      return false;
    }

    var incremental = gs.getProperty('configuration_backup.incremental_data', false);
    incremental = incremental === 'true';
    var lastRunDate = gs.daysAgoStart(1);
    var instanceStartTime = false;
    var tablesToIgnore = gs.getProperty('configuration_backup.data_tables_to_ignore', '');
    this.log('Fetched properties.');

    // Grab the first date in the upgrade log
    var up = new GlideRecord('syslog');
    up.addQuery('source', 'Upgrade');
    up.orderBy('sys_created_on');
    up.query();
    if (up.next()) {
      instanceStartTime = up.sys_created_on.toString();
    }

    this.log('Fetched first date.');

    // Grab the list of all tables
    var table = new GlideRecord('sys_dictionary');
    // Ignore the table if it has the attributes update_sync or update_sync, or it's some other system/configuration table we know of
    table.addEncodedQuery(
      'elementISEMPTY^ORelement=NULL^attributesNOT LIKEupdate_sync=true^ORattributesISEMPTY^attributesNOT LIKEupdate_synch=true^ORattributesISEMPTY^nameDOES NOT CONTAINclone^nameDOES NOT CONTAINecc_queue^nameDOES NOT CONTAINimport_log^nameDOES NOT CONTAINsysevent^nameDOES NOT CONTAINsyslog^nameDOES NOT CONTAINts_^nameDOES NOT CONTAINwf_^nameDOES NOT CONTAINv_^nameDOES NOT CONTAINsysauto^nameDOES NOT CONTAINsysrule^nameDOES NOT CONTAINvtb_^nameDOES NOT CONTAINtext_search^nameDOES NOT CONTAINjrobin^nameDOES NOT CONTAINpa_diagnostic^nameDOES NOT CONTAINlive_^nameDOES NOT CONTAINcmdb^nameDOES NOT CONTAINcert_^nameDOES NOT CONTAINast_^nameDOES NOT CONTAINua_^nameDOES NOT CONTAINdiagnostic_event^nameDOES NOT CONTAINpaf_^nameDOES NOT CONTAINoutbound_request_^nameNOT INfx_currency_instance,label_history,report_executions,report_stats,usageanalytics_count^ORDERBYname'
    );
    table.addQuery('name', 'NOT IN', tablesToIgnore);
    table.orderBy('name');
    this.log('Data Table Query: ' + table.getEncodedQuery());
    table.query();
    while (table.next()) {
      var data = new GlideRecord(table.name.toString());
      if (incremental && lastRunDate !== false) {
        data.addQuery('sys_updated_on', '>=', lastRunDate);
      } else if (instanceStartTime !== false) {
        data.addQuery('sys_updated_on', '>=', instanceStartTime);
      }
      data.orderByDesc('sys_updated_on');
      var query = data.getEncodedQuery();
      data.setLimit(1);
      data.query();
      if (data.next()) {
        this.log('Data Backup: ' + table.name.toString() + ' -- ' + data.sys_updated_on);
        var name = new GlideDate().getDisplayValue() + '_' + table.name.toString();
        name = name.replace(/(?:[\.\s\/\\]+)/gi, '_');
        this.fetchXMLAsAttachment(table.name.toString(), query, tempLocalUpdateSet, name);
      }
    }

    return true;
  },

  prepAllUpdateSets: function() {
    var preppedSets = [];
    var preppedUpdateSetID;
    var updateSets = new GlideRecord('sys_update_set');
    var backupIgnored = gs.getProperty('configuration_backup.backup_ignored', 'false');
    if (backupIgnored != 'true') {
      updateSets.addQuery('state', '!=', 'ignore');
    } else {
      updateSets.addQuery('name', 'DOES NOT CONTAIN', 'Export Update Sets on');
    }
    // Omit the Default Update Set for Now
    var qc = updateSets.addQuery('name', '!=', 'Default');
    qc.addOrCondition('application', '!=', 'global');
    // --Done Omitting
    // Limit Update sets by created by?
    var users = gs.getProperty('configuration_backup.restrict_to.users', '');
    if (String(users).trim() != '') {
      updateSets.addQuery('sys_created_by', 'IN', String(users).trim());
    }
    // Limit update sets by title?
    var title = gs.getProperty('configuration_backup.restrict_to.title', '');
    if (String(title).trim() != '') {
      updateSets.addQuery('name', 'CONTAINS', String(title).trim());
    }
    // Limit to update Sets with an update on today
    if (gs.getProperty('configuration_backup.restrict_to.include_only_24hrs', 'false') == 'true') {
      var updatesArr = [];
      var updates = new GlideAggregate('sys_update_xml');
      updates.addEncodedQuery('sys_updated_onRELATIVEGE@hour@ago@24^update_set.name!=default');
      updates.addAggregate('COUNT', 'update_set');
      updates.query();
      while (updates.next()) {
        updatesArr.push(updates.update_set + '');
      }
      updateSets.addQuery('sys_id', 'IN', updatesArr);
    }
    updateSets.query();
    while (updateSets.next()) {
      this.log('Prepping Update Set: ' + updateSets.getDisplayValue());
      preppedUpdateSetID = this.prepSingleUpdateSetForExport(updateSets.sys_id);
      if (preppedUpdateSetID !== false) {
        preppedSets.push(String(preppedUpdateSetID));
      }
    }
    if (gs.getProperty('configuration_backup.include_default', 'false') == 'true') {
      preppedUpdateSetID = this.prepDefaultUpdateSet();
      if (preppedUpdateSetID !== false) {
        preppedSets.push(String(preppedUpdateSetID));
      }
    }
    var globalScopedApps = this.prepGlobalScopedApps();
    for (var i = 0; i < globalScopedApps.length; i++) {
      if (globalScopedApps[i] !== false) {
        preppedSets.push(String(globalScopedApps[i]));
      }
    }
    return preppedSets;
  },

  prepDefaultUpdateSet: function() {
    var updateSet = new GlideRecord('sys_update_set');
    updateSet.addQuery('name', 'Default');
    updateSet.addQuery('application', 'global');
    updateSet.query();
    if (!updateSet.next()) {
      return false;
    }
    // We've got the update set, so now we're going to check out all the records, determine our earliest date to use, and temporarily move these records into an update set of their own.

    // Create a temporary local update set
    var tempLocalUpdateSet = new GlideRecord('sys_update_set');
    tempLocalUpdateSet.initialize();
    tempLocalUpdateSet.application = 'global';
    tempLocalUpdateSet.state = 'in progress';
    tempLocalUpdateSet.name = 'Default Updates thru ' + gs.now();
    tempLocalUpdateSet.description = 'Default Updates thru ' + gs.nowDateTime();
    var tempLocalUpdateSetID = tempLocalUpdateSet.insert();
    this.updateCreatedAndUpdatedBy('sys_update_set', tempLocalUpdateSetID);

    var updates = new GlideRecord('sys_update_xml');
    updates.addQuery('update_set', updateSet.sys_id);
    updates.addQuery('application', '').addOrCondition('application.name', 'Global');
    // Limit to update Sets with an update on today
    if (gs.getProperty('configuration_backup.restrict_to.include_only_24hrs', 'false') == 'true') {
      updates.addEncodedQuery('sys_updated_onRELATIVEGE@hour@ago@24^update_set.name!=default');
    }
    updates.query();
    while (updates.next()) {
      updates.update_set = tempLocalUpdateSetID;
      updates.autoSysFields(false);
      updates.update();
    }

    // Now we're going to prep this update set for export...
    var sysid = this.prepSingleUpdateSetForExport(tempLocalUpdateSetID);

    // Now we're going to move everything back...
    updates = new GlideRecord('sys_update_xml');
    updates.addQuery('update_set', tempLocalUpdateSetID);
    updates.query();
    while (updates.next()) {
      updates.update_set = String(updateSet.sys_id);
      updates.autoSysFields(false);
      updates.update();
    }

    // Now delete our temporary update set.
    tempLocalUpdateSet = new GlideRecord('sys_update_set');
    if (tempLocalUpdateSet.get('sys_id', tempLocalUpdateSetID)) {
      tempLocalUpdateSet.deleteRecord();
    }

    return sysid;
  },

  prepGlobalScopedApps: function() {
    // Use GlideAggregate to grab the name of the global applications that actually have sys_update_xml records for us to backup.
    // Group by application
    // Query: update_set.name=Default^applicationISNOTEMPTY^application!=global^application.scopeSTARTSWITHglobal^update_set.application=global

    var sets = [];
    var ga = new GlideAggregate('sys_update_xml');
    ga.addEncodedQuery('update_set.name=Default^applicationISNOTEMPTY^application!=global^application.scopeSTARTSWITHglobal^update_set.application=global');
    // Limit to update Sets with an update on today
    if (gs.getProperty('configuration_backup.restrict_to.include_only_24hrs', 'false') == 'true') {
      ga.addEncodedQuery('sys_updated_onRELATIVEGE@hour@ago@24^update_set.name!=default');
    }
    ga.addAggregate('COUNT');
    ga.groupBy('application');
    ga.query();
    // loop through every app
    // this.prepRecordsForSingleGlobalScopedApp(gr.application.getDisplayValue(), gr.application.toString());
    while (ga.next()) {
      sets.push(this.prepRecordsForSingleGlobalScopedApp(ga.application.getDisplayValue(), ga.application.toString()));
    }

    // now go up into thecode where "prepDefaultUpdateSet" is called, and also call this prepGlobalScopedApps function.
    // BUT make it do it regardless whether they said they wanted to backup the default update set or not.

    return sets;
  },

  //--------------------
  prepRecordsForSingleGlobalScopedApp: function(appName, appID) {
    var updateSet = new GlideRecord('sys_update_set');
    updateSet.addQuery('name', 'Default');
    updateSet.addQuery('application', 'global');
    updateSet.query();
    if (!updateSet.next()) {
      return false;
    }
    // We've got the update set, so now we're going to check out all the records, determine our earliest date to use, and temporarily move these records into an update set of their own.

    // Create a temporary local update set
    var tempLocalUpdateSet = new GlideRecord('sys_update_set');
    tempLocalUpdateSet.initialize();
    tempLocalUpdateSet.application = 'global';
    tempLocalUpdateSet.state = 'in progress';
    tempLocalUpdateSet.name = 'Global App ' + appName + ' Updates thru ' + gs.now();
    tempLocalUpdateSet.description = 'Global Scoped App ' + appName + ' Updates thru ' + gs.nowDateTime();
    var tempLocalUpdateSetID = tempLocalUpdateSet.insert();
    this.updateCreatedAndUpdatedBy('sys_update_set', tempLocalUpdateSetID);

    var updates = new GlideRecord('sys_update_xml');
    updates.addQuery('update_set', updateSet.sys_id);
    updates.addQuery('application', appID);
    updates.query();
    while (updates.next()) {
      updates.update_set = tempLocalUpdateSetID;
      updates.autoSysFields(false);
      updates.update();
    }

    // Now we're going to prep this update set for export...
    var sysid = this.prepSingleUpdateSetForExport(tempLocalUpdateSetID);

    // Now we're going to move everything back...
    updates = new GlideRecord('sys_update_xml');
    updates.addQuery('update_set', tempLocalUpdateSetID);
    updates.query();
    while (updates.next()) {
      updates.update_set = String(updateSet.sys_id);
      updates.autoSysFields(false);
      updates.update();
    }

    // Now delete our temporary update set.
    tempLocalUpdateSet = new GlideRecord('sys_update_set');
    if (tempLocalUpdateSet.get('sys_id', tempLocalUpdateSetID)) {
      tempLocalUpdateSet.deleteRecord();
    }

    return sysid;
  },

  markUpdateSetComplete: function(updateSetID) {
    var updateSet = new GlideRecord('sys_update_set');
    if (!updateSet.get('sys_id', updateSetID)) {
      return false;
    }

    if (updateSet.name == 'Default' && updateSet.application == 'global') {
      return false;
    }

    updateSet.state = 'complete';
    updateSet.autoSysFields(false);
    updateSet.update();

    updateSet = new GlideRecord('sys_update_set');
    if (!updateSet.get('sys_id', updateSetID)) {
      return false;
    }

    return updateSet;
  },

  markUpdateSetInProgress: function(updateSetID) {
    var updateSet = new GlideRecord('sys_update_set');
    if (!updateSet.get('sys_id', updateSetID)) {
      return false;
    }

    if (updateSet.name == 'Default' && updateSet.application == 'global') {
      return false;
    }

    updateSet.state = 'in progress';
    updateSet.autoSysFields(false);
    updateSet.update();

    updateSet = new GlideRecord('sys_update_set');
    if (!updateSet.get('sys_id', updateSetID)) {
      return false;
    }

    return updateSet;
  },

  prepSingleUpdateSetForExport: function(updateSetID) {
    var updateSet = new GlideRecord('sys_update_set');
    if (!updateSet.get('sys_id', updateSetID)) {
      return false;
    }

    if (updateSet.name == 'Default' && updateSet.application == 'global') {
      return false;
    }

    if (updateSet.state == 'ignore') {
      return false;
    }

    var setBackToInProgress = false;

    if (updateSet.state == 'in progress') {
      updateSet = this.markUpdateSetComplete(updateSet.sys_id);
      if (updateSet === false) {
        return false;
      }
      setBackToInProgress = true;
    }

    var retrievedUpdateSet = new GlideRecord('sys_remote_update_set');
    retrievedUpdateSet.initialize();

    retrievedUpdateSet.description = updateSet.description;
    retrievedUpdateSet.name = updateSet.name;
    retrievedUpdateSet.release_date = updateSet.release_date;
    retrievedUpdateSet.remote_sys_id = updateSet.sys_id;
    retrievedUpdateSet.application = updateSet.application;

    var scopeGr = new GlideRecord('sys_scope');
    scopeGr.get(updateSet.application);
    if (scopeGr.isValid()) {
      retrievedUpdateSet.application_name = scopeGr.name;
      retrievedUpdateSet.application_scope = scopeGr.scope;
      retrievedUpdateSet.application_version = scopeGr.version;
    }

    retrievedUpdateSet.state = 'loaded';

    var sysid = retrievedUpdateSet.insert();
    this.updateCreatedAndUpdatedBy('sys_remote_update_set', sysid);

    var update = new GlideRecord('sys_update_xml');
    update.addQuery('update_set', updateSet.sys_id);
    update.query();

    while (update.next()) {
      update.remote_update_set = retrievedUpdateSet.sys_id;
      update.update_set = '';
      var theID = update.insert();
      this.updateCreatedAndUpdatedBy('sys_update_xml', theID);
    }

    if (setBackToInProgress) {
      updateSet = this.markUpdateSetInProgress(updateSet.sys_id);
      if (updateSet === false) {
        return false;
      }
    }

    return sysid;
  },

  updateCreatedAndUpdatedBy: function(table, sysID) {
    var record = new GlideRecord(table);
    if (record.get('sys_id', sysID)) {
      record.sys_updated_by = gs.getProperty('configuration_backup.username');
      record.sys_created_by = gs.getProperty('configuration_backup.username');
      record.autoSysFields(false);
      record.update();
    }
  },

  fetchUpdateSetAsAttachment: function(remoteUpdateSetID, saveToRecord) {
    var remoteUpdateSet = new GlideRecord('sys_remote_update_set');
    if (!remoteUpdateSet.get('sys_id', remoteUpdateSetID)) {
      return false;
    }

    var domain = 'https://' + gs.getProperty('instance_name') + '.service-now.com/';
    var remoteFile = domain + 'export_update_set.do?sysparm_sys_id=' + remoteUpdateSetID + '&sysparm_delete_when_done=false';
    var contentType = 'text/xml';

    var client = new GlideHTTPClient();
    var pass = new GlideEncrypter().decrypt(gs.getProperty('configuration_backup.password'));
    client.setBasicAuth(gs.getProperty('configuration_backup.username'), pass);
    var get = new Packages.org.apache.commons.httpclient.methods.GetMethod(remoteFile);

    client.executeMethod(get);

    var is = get.getResponseBodyAsString();

    var sa = new GlideSysAttachment();
    var finalFileName = gs.now() + ' - ' + gs.getProperty('instance_name') + ' - ' + remoteUpdateSet.name;
    if (remoteUpdateSet.application != 'global') {
      finalFileName = remoteUpdateSet.application.getDisplayValue() + ' - ' + finalFileName;
    }
    if (gs.getProperty('configuration_backup.obscure_filetype', 'false') == 'true') {
      finalFileName += '.txt';
      contentType = 'text/plain';
    } else {
      finalFileName += '.xml';
    }

    sa.write(saveToRecord, finalFileName, contentType, is);
    get.releaseConnection();

    return true;
  },

  fetchXMLAsAttachment: function(table, query, saveToRecord, name) {
    var domain = 'https://' + gs.getProperty('instance_name') + '.service-now.com/';
    var remoteFile = domain + table + '_list.do?XML&sysparm_query=' + GlideStringUtil.urlEncode(query);
    var contentType = 'text/xml';

    var client = new GlideHTTPClient();
    var pass = new GlideEncrypter().decrypt(gs.getProperty('configuration_backup.password'));
    client.setBasicAuth(gs.getProperty('configuration_backup.username'), pass);
    this.log('About to Fetch Remote XML File: ' + remoteFile);
    var get = new Packages.org.apache.commons.httpclient.methods.GetMethod(remoteFile);

    client.executeMethod(get);

    var is = get.getResponseBodyAsString();
    var sa = new GlideSysAttachment();

    var finalFileName = name;
    if (gs.getProperty('configuration_backup.obscure_filetype', 'false') == 'true') {
      finalFileName += '.txt';
      contentType = 'text/plain';
    } else {
      finalFileName += '.xml';
    }

    sa.write(saveToRecord, finalFileName, contentType, is);
    get.releaseConnection();

    return true;
  },

  prepAndSend: function() {
    this.log('Testing Login Credentials');
    var credentialsValid = this.testLoginCredentials();
    if (!credentialsValid) {
      this.error('Exiting because Credentials are invalid and therefore script will eventually fail.');
      return false;
    }
    this.log('Past credential check.');
    var updateSets = this.prepAllUpdateSets();
    this.log('Finished prepping Update Sets');
    // Create an update set to store the records on.
    var tempLocalUpdateSet = new GlideRecord('sys_update_set');
    tempLocalUpdateSet.initialize();
    tempLocalUpdateSet.application = 'global';
    tempLocalUpdateSet.state = 'ignore';
    tempLocalUpdateSet.name = 'Export Update Sets on ' + gs.now();
    tempLocalUpdateSet.description = 'Export Update Sets on ' + gs.nowDateTime();
    var tempLocalUpdateSetID = tempLocalUpdateSet.insert();
    this.updateCreatedAndUpdatedBy('sys_update_set', tempLocalUpdateSetID);
    tempLocalUpdateSet = new GlideRecord('sys_update_set');
    if (!tempLocalUpdateSet.get('sys_id', tempLocalUpdateSetID)) {
      return false;
    }
    this.log('Temp Local Update Set Created');

    var minimize = gs.getProperty('configuration_backup.minimize_files', 'false');

    if (minimize == 'true') {
      this.log('Minimizing Files');
      // Now we'll grab each record and stick it on this update set record.
      this.minimizeFiles(updateSets, tempLocalUpdateSet);
    } else {
      this.log('Attaching Update Sets');
      this.attachUpdateSets(updateSets, tempLocalUpdateSet);
    }

    if (gs.getProperty('configuration_backup.data', 'false') === 'true') {
      this.log('Starting Data Backup');
      this.backupData(tempLocalUpdateSet);
      this.log('Data Backup Complete');
    }

    // Now fire off the email event
    if (this.googleDrive) {
      this.log('Backing up to Google Drive');
      this.uploadAllToGoogleDrive(tempLocalUpdateSet);
    } else {
      this.log('Backing up via Email');
      gs.eventQueue('configuration_backup.email', tempLocalUpdateSet, gs.getProperty('configuration_backup.send_email_to'));
    }

    // Now delete those temporary update sets...
    if (updateSets.join(',') != '') {
      var remoteUpdateSets = new GlideRecord('sys_remote_update_set');
      remoteUpdateSets.addQuery('sys_id', 'IN', updateSets.join(','));
      remoteUpdateSets.query();
      while (remoteUpdateSets.next()) {
        remoteUpdateSets.deleteRecord();
      }
    }
    this.log('Temporary Update Sets Removed.');

    // Fire off event in future to delete this temporary update set and all the attachments (cleanup)
    var scheduledGlideDateTime = new GlideDateTime();
    scheduledGlideDateTime.addMinutes(5);
    gs.eventQueueScheduled('configuration_backup.cleanup', tempLocalUpdateSet, '', '', scheduledGlideDateTime);
    return true;
  },

  uploadAllToGoogleDrive: function(tempLocalUpdateSet) {
    var attachments = new GlideRecord('sys_attachment');
    attachments.addQuery('table_name', tempLocalUpdateSet.getTableName());
    attachments.addQuery('table_sys_id', tempLocalUpdateSet.getUniqueValue());
    attachments.orderBy('sys_created_on');
    attachments.query();
    while (attachments.next()) {
      var result = this.uploadToGoogleDrive(attachments.sys_id.toString());
      if (result === false) {
        return result;
      }
    }
    return true;
  },

  uploadToGoogleDrive: function(attachmentID) {
    var gd = new global.GoogleDrive();
    var folder = this._gdGetBackupFolder();

    if (folder === false) {
      return false;
    }

    return gd.uploadAttachment(attachmentID, folder);
  },

  _gdGetParentFolder: function() {
    var fid = gs.getProperty('configuration_backup.google_drive.folderID', '');
    if (fid === '') {
      fid = this._gdCreateParentFolder();
    }
    if (fid === false) {
      return false;
    }

    return fid;
  },

  _gdCreateParentFolder: function() {
    var gd = new global.GoogleDrive();
    var name = gs.getProperty('configuration_backup.google_drive.folderName', 'ServiceNow Backup Files');

    var result = gd.createFolder(name);
    if (result !== false) {
      gs.setProperty('configuration_backup.google_drive.folderID', result);
    }

    return result;
  },

  _gdGetBackupFolder: function() {
    if (typeof this.gdBackupFolder !== 'undefined' && this.gdBackupFolder !== false && this.gdBackupFolder !== '') {
      return this.gdBackupFolder;
    }

    var gd = new global.GoogleDrive();
    var parent = this._gdGetParentFolder();
    if (parent === false) {
      return false;
    }

    var date = new GlideDate();
    var name = date.getDisplayValueInternal();
    var result = gd.createFolder(name, parent);
    if (result !== false) {
      this.gdBackupFolder = result;
    }

    return result;
  },

  checkNumberOfRecords: function(table, query) {
    var ga = new GlideAggregate(table);
    ga.addEncodedQuery(query);
    ga.addAggregate('COUNT');
    ga.query();
    if (ga.next()) {
      this.log('Checking number of records: (' + ga.getAggregate('COUNT') + ') - ' + table + '_list.do?sysparm_query=' + query + ' ');
      return parseInt(String(ga.getAggregate('COUNT')), 10);
    }
    return false;
  },

  getUpdateSource: function() {
    var timestamp = gs.nowDateTime();
    timestamp = timestamp
      .replace(/:/g, '_')
      .replace(/\-/g, '_')
      .replace(/\s/g, '_');
    return 'CB_' + Math.floor(Math.random() * 10001) + '_' + timestamp;
  },

  setUpdateSource: function(updateSetID, updateSource) {
    var updateSet = new GlideRecord('sys_remote_update_set');
    if (updateSet.get('sys_id', updateSetID)) {
      updateSet.origin_sys_id = updateSource;
      updateSet.autoSysFields(false);
      updateSet.update();
    }
  },

  minimizeFiles: function(updateSets, recordToSaveTo) {
    this.log('Preparing to Minimize Update Sets');
    // build a query to use for grabbing the update sets themselves
    var i = 0;
    var query = '';
    var tempUS;
    var numFiles = 0;
    var updateSource = '';
    while (i < updateSets.length) {
      updateSource = this.getUpdateSource();
      tempUS = [];
      var j;
      for (j = i; j < i + 10000 && j < updateSets.length; j++) {
        this.setUpdateSource(updateSets[j], updateSource);
      }
      i = j;
      query = 'origin_sys_id=' + updateSource;

      numFiles += 1;
      this.log('Fetching Update Set ' + numFiles + '.');
      this.fetchXMLAsAttachment('sys_remote_update_set', query, recordToSaveTo, 'UpdateSets_' + numFiles);
      this.log('DONE Fetching Update Set ' + numFiles + '.');
    }
    this.log('Preparing to Minimize Update XML');

    // Now get the Update Set XML files
    numFiles = 0;
    var toCopy = updateSets.slice(0);
    while (toCopy.length > 0) {
      tempUS = [];
      var numRecords = 0;
      updateSource = this.getUpdateSource();
      while (numRecords < 10000 && toCopy.length > 0) {
        var singleUS = toCopy.pop();
        var singleUSRecords = this.checkNumberOfRecords('sys_update_xml', 'remote_update_set=' + singleUS);
        this.log('Length of Batch: ' + tempUS.length + ' - Single US Records: ' + singleUSRecords + ' + numRecords: ' + numRecords);
        if (singleUSRecords + numRecords > 10000) {
          numRecords = 10001;
          toCopy.push(singleUS);
        } else {
          this.setUpdateSource(singleUS, updateSource);
          tempUS.push(singleUS);
          numRecords += singleUSRecords;
        }
      }
      query = 'remote_update_set.origin_sys_id=' + updateSource;
      numFiles += 1;
      this.log('Fetching Update XML Batch ' + numFiles + '.');
      this.fetchXMLAsAttachment('sys_update_xml', query, recordToSaveTo, 'UpdateXML_' + numFiles);
      this.log('DONE Fetching Update XML Batch ' + numFiles + '.');
    }
    return true;
  },

  attachUpdateSets: function(updateSets, recordToSaveTo) {
    // Now we'll grab each record and stick it on this update set record.
    for (var i = 0; i < updateSets.length; i++) {
      this.fetchUpdateSetAsAttachment(updateSets[i], recordToSaveTo);
    }
    return true;
  },

  prepAndLink: function() {
    this.log('Testing Login Credentials');
    var credentialsValid = this.testLoginCredentials();
    if (!credentialsValid) {
      this.error('Exiting because Credentials are invalid and therefore script will eventually fail.');
      return false;
    }
    this.log('Preparing Update Sets for Linking');
    var updateSets = this.prepAllUpdateSets();
    this.log('Update Sets Prepared.');
    // Create an update set to store the records on.
    var tempLocalUpdateSet = new GlideRecord('sys_update_set');
    tempLocalUpdateSet.initialize();
    tempLocalUpdateSet.application = 'global';
    tempLocalUpdateSet.state = 'ignore';
    tempLocalUpdateSet.name = 'Export Update Sets on ' + gs.now();
    tempLocalUpdateSet.description = 'Export Update Sets on ' + gs.nowDateTime();

    var tempLocalUpdateSetID = tempLocalUpdateSet.insert();
    this.updateCreatedAndUpdatedBy('sys_update_set', tempLocalUpdateSetID);
    tempLocalUpdateSet = new GlideRecord('sys_update_set');

    if (!tempLocalUpdateSet.get('sys_id', tempLocalUpdateSetID)) {
      return false;
    }

    var minimize = gs.getProperty('configuration_backup.minimize_files', 'false');

    if (minimize == 'true') {
      // Now we'll grab each record and stick it on this update set record.
      this.minimizeFiles(updateSets, tempLocalUpdateSet);
    } else {
      this.attachUpdateSets(updateSets, tempLocalUpdateSet);
    }
    // eslint-disable-next-line servicenow/minimize-gs-log-print
    gs.log('Go to this record and download all the attachments within the next 25 minutes:  https://' + gs.getProperty('instance_name') + '.service-now.com/' + tempLocalUpdateSet.getLink(), 'ConfigurationBackup');

    // Now delete those temporary update sets...
    if (updateSets.join(',') != '') {
      var remoteUpdateSets = new GlideRecord('sys_remote_update_set');
      remoteUpdateSets.addQuery('sys_id', 'IN', updateSets.join(','));
      remoteUpdateSets.query();
      while (remoteUpdateSets.next()) {
        remoteUpdateSets.deleteRecord();
      }
    }

    // Fire off event in future to delete this temporary update set and all the attachments (cleanup)
    // var sgdt = new GlideDateTime();
    // sgdt.addMinutes(25);
    // gs.eventQueueScheduled("configuration_backup.cleanup", tempLocalUpdateSet, "", "", sgdt);

    return tempLocalUpdateSet.getLink();
  },

  testLoginCredentials: function() {
    var domain = 'https://' + gs.getProperty('instance_name') + '.service-now.com/';
    var remoteFile = domain + 'sys_properties_list.do?XML&sysparm_query=name=instance_name';

    var client = new GlideHTTPClient();
    var pass = new GlideEncrypter().decrypt(gs.getProperty('configuration_backup.password'));
    client.setBasicAuth(gs.getProperty('configuration_backup.username'), pass);
    var get = new Packages.org.apache.commons.httpclient.methods.GetMethod(remoteFile);

    client.executeMethod(get);
    var is = get.getResponseBodyAsString();

    get.releaseConnection();

    if (typeof is === 'undefined' || is == '') {
      this.error('Error: Credentials not correct: Username: ' + gs.getProperty('configuration_backup.username'));
      return false;
    }
    this.log('Credentials Succeeded: ' + gs.getProperty('configuration_backup.username'));
    return true;
  },

  manualTestLoginCredentials: function(username, password) {
    var domain = 'https://' + gs.getProperty('instance_name') + '.service-now.com/';
    var remoteFile = domain + 'sys_properties_list.do?XML&sysparm_query=name=instance_name';

    var client = new GlideHTTPClient();
    client.setBasicAuth(username, password);
    var get = new Packages.org.apache.commons.httpclient.methods.GetMethod(remoteFile);

    client.executeMethod(get);
    var is = get.getResponseBodyAsString();

    get.releaseConnection();

    if (typeof is === 'undefined' || is == '') {
      this.error('Error: Credentials not correct: Username: ' + username);
      return false;
    }
    this.log('Credentials Succeeded: ' + username);
    return true;
  },

  setLogPrefix: function(prefix) {
    this.logPrefix = prefix + ' - ';
  },

  /*
   * log() <br />
   * Used to log items for debugging purposes.
   */
  log: function(msg, override) {
    if (this.prefix === '') {
      this.prefix = '' + Math.floor(Math.random() * 1001);
    }
    if (this.debugFlag || (typeof override !== 'undefined' && override)) {
      this.logCounter++;
      var str = '' + this.logCounter;
      if (this.scoped) {
        gs.info('(' + this.prefix + ' -- ' + this.logPad.substring(0, this.logPad.length - str.length) + str + ')  - ' + this.logPrefix + msg);
      } else {
        // eslint-disable-next-line servicenow/minimize-gs-log-print
        gs.log('(' + this.prefix + ' -- ' + this.logPad.substring(0, this.logPad.length - str.length) + str + ')  - ' + this.logPrefix + msg, this.type);
      }
    }
  },

  /*
   * log() <br />
   * Used to log items for debugging purposes.
   */
  error: function(msg) {
    if (this.prefix === '') {
      this.prefix = '' + Math.floor(Math.random() * 101);
    }
    if (this.errorFlag) {
      this.logCounter++;
      var str = '' + this.logCounter;
      if (this.scoped) {
        gs.error('(' + this.prefix + ' -- ' + this.logPad.substring(0, this.logPad.length - str.length) + str + ')  - ' + this.logPrefix + msg);
      } else {
        // eslint-disable-next-line servicenow/minimize-gs-log-print
        gs.log('(' + this.prefix + ' -- ' + this.logPad.substring(0, this.logPad.length - str.length) + str + ')  - ERROR:  ' + this.logPrefix + msg, this.type);
      }
    }
  },

  logTiming: function() {
    var end = new Date().getTime();
    if (this.theLastTime === 0) {
      this.theLastTime = end;
    }
    if (this.theBeginTime === 0) {
      this.theBeginTime = end;
    }
    var sectionTime = end - this.theLastTime;
    var totalTime = end - this.theBeginTime;
    this.log('Section Time: ' + sectionTime + '\nTotal Time: ' + totalTime, true);
    this.theLastTime = end;
  },

  errorFlag: true,
  debugFlag: true,
  scoped: false,
  logCounter: 0,
  logPad: '00000',
  prefix: '',
  logPrefix: '',
  theBeginTime: 0,
  theLastTime: 0,
  type: 'ConfigurationBackup'
};
