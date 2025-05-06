var GoogleDrive = Class.create();
GoogleDrive.prototype = {
  boundary: '',
  delimiter: '',
  close_delim: '',

  initialize: function() {
    this.boundary = '-------314159265358979323846';
    this.delimiter = '\r\n--' + this.boundary + '\r\n';
    this.close_delim = '\r\n--' + this.boundary + '--';
  },

  createFolder: function(folderName, parentFolder) {
    var contentType = 'application/vnd.google-apps.folder';
    var metaData = {
      name: folderName,
      mimeType: contentType
    };
    if (typeof parentFolder !== 'undefined' && parentFolder !== '') {
      metaData.parents = [parentFolder];
    }
    var data = '';
    var result = this._multipartUpload(metaData, contentType, data);

    var id = false;
    try {
      result = JSON.parse(result);
      id = result.id;
    } catch (e) {
      this.error(e);
      return false;
    }
    return id;
  },

  uploadAttachment: function(attachmentID, parentFolder) {
    var attachment = new GlideRecord('sys_attachment');
    if (typeof attachmentID === 'undefined' || attachmentID == null || attachmentID === '' || !attachment.get('sys_id', attachmentID)) {
      this.error('uploadToGoogleDrive: Attachment ID  not valid.');
      return false;
    }

    this.log('Attachment Name: ' + attachment.file_name.toString());
    this.log('Attachment Type: ' + attachment.content_type.toString());

    var sa = new GlideSysAttachment();
    var binData = sa.getBytes(attachment);
    var encData = GlideStringUtil.base64Encode(binData);

    var metaData = {
      name: attachment.file_name.toString(),
      mimeType: attachment.content_type.toString()
    };
    if (typeof parentFolder !== 'undefined' && parentFolder !== '') {
      metaData.parents = [parentFolder];
    }
    this.log('Uploading Attachment: ' + attachment.file_name.toString());

    var result = this._multipartUpload(metaData, attachment.content_type.toString(), encData);

    this.log('Uploading Result: ' + result);

    return result;
  },

  _multipartUpload: function(metaData, contentType, data) {
    var status;
    var responseBody;

    var multipartRequestBody = this.delimiter + 'Content-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(metaData) + this.delimiter + 'Content-Type: ' + contentType + '\r\nContent-Transfer-Encoding: base64\r\n\r\n' + data + this.close_delim;

    try {
      var msg = new sn_ws.RESTMessageV2('Google Drive Upload', 'Multipart');
      // msg.setRequestHeader('Content-Type', attachment.content_type.toString());
      // msg.setRequestHeader('Content-Length', attachment.size_bytes.toString());
      // msg.setRequestHeader('Content-Transfer-Encoding', 'base64');
      // msg.setQueryParameter("title", attachment.file_name.toString());
      msg.setRequestBody(multipartRequestBody);
      msg.setHttpTimeout(100000); // In milliseconds. Wait at most 10 seconds for response from http request.
      var response = msg.execute(); // Might throw exception if http connection timed out or some issue with sending request itself because of encryption/decryption of password.
      responseBody = response.haveError() ? response.getErrorMessage() : response.getBody();
      status = response.getStatusCode();
      // gs.print(status);
      // gs.print(responseBody);
    } catch (ex) {
      // gs.print("Error: "+ex);
      responseBody = ex.getMessage();
      status = '500';
      this.error('Could not upload file: \nStatus: ' + status + '\nError Message:\n' + responseBody);
      // gs.print(responseBody);
      return false;
    } finally {
      // gs.print("-------------------\n"+requestBody);
    }
    return responseBody;
  },

  trimLeft: function(str) {
    return str.replace(/^\s+/gi, '');
  },

  trimRight: function(str) {
    return str.replace(/\s+$/gi, '');
  },

  trim: function(str) {
    str = this.trimLeft(str);
    str = this.trimRight(str);
    return str;
  },

  setDebug: function(debug) {
    this.debugFlag = !!debug;
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
        gs.info('(' + this.prefix + ' -- ' + this.logPad.substring(0, this.logPad.length - str.length) + str + ')  - ' + msg);
      } else {
        // eslint-disable-next-line servicenow/minimize-gs-log-print
        gs.log('(' + this.prefix + ' -- ' + this.logPad.substring(0, this.logPad.length - str.length) + str + ')  - ' + msg, this.type);
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
        gs.error('(' + this.prefix + ' -- ' + this.logPad.substring(0, this.logPad.length - str.length) + str + ')  - ' + msg);
      } else {
        gs.logError('(' + this.prefix + ' -- ' + this.logPad.substring(0, this.logPad.length - str.length) + str + ')  - ' + msg, this.type);
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
  theBeginTime: 0,
  theLastTime: 0,
  type: 'GoogleDrive'
};
