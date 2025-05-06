var GlideAjaxServer = Class.create();
GlideAjaxServer.prototype = {
    URL: "xmlhttp.do",
    initialize: function() {
        this.params = new Object();
    },
    _getRequestObject: function() {
        var req = new sn_ws.RESTMessageV2();
        req.setHttpMethod("post");
        return req;
    },
    setProcessor: function(p) {
        this.processor = p;
        this.addParam("sysparm_processor", p);
    },
    getProcessor: function() {
        return this.processor;
    },
    _makeRequest: function(async) {
        this.requestObject = this._getRequestObject();
        if (this.requestObject == null)
            return null;
        var refUrl = this._buildReferringURL();
        if (refUrl != "") { // IE6 will get an error if you try to set a blank value
            this.addParam('ni.nolog.x_referer', 'ignore');
            this.addParam('x_referer', refUrl);
        }
        this.postString = this.getQueryString();
        this.requestObject.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded; charset=UTF-8');
        this.requestObject.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded; charset=UTF-8');

        this.requestObject.open("POST", this.contextPath, async);
        this.requestObject.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded; charset=UTF-8');
        if (typeof g_ck != 'undefined' && g_ck != "")
            this.requestObject.setRequestHeader('X-UserToken', g_ck);
        this.requestObject.send(this.postString);
        if (!async || (this.callbackFunction == null))
            this._hideLoading();
        return this.requestObject;
    },
    _buildReferringURL: function() {
        return "https://"+gs.getProperty("instance_name")+".service-now.com/";
    },
    /*
     * addParam(String, String) <br />
     * Add a parameter to send to the client side code.
     * @param parameter -- Name of variable to add.
     * @param value -- Value of variable to include.
     */
    addParam: function(name, value) {
        this.params[name] = value;
    },
    getQueryString: function(additionalParams) {
        qs = this._getParamsForURL(this.params);
        qs += this._getParamsForURL(additionalParams);
        qs += this.encodedString;
        if (qs.length == 0)
            return "";
        return qs.substring(1);
    },
    _getParamsForURL: function(params) {
        if (!params)
            return "";
        var url = "";
        for (n in params) {
            if (params[n]) {
                url += "&" + n + "=";
                if (this.encode)
                    url += encodeURIComponent(params[n] + '');
                else
                    url += params[n];
            } else
                url += "&" + n + "=";
        }
        return url;
    }
};