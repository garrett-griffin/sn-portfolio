var OAuthGoogleHandler = Class.create();
OAuthGoogleHandler.prototype = {
	initialize: function() {
	},
	
	interceptRequestParameters : function(requestParamMap) {
		// Add/Modify request parameters if needed
		this.preprocessAccessToken(requestParamMap);
	},
	
	parseTokenResponse: function(accessTokenResponse) {
		this.postprocessAccessToken(accessTokenResponse);
	},
	
	preprocessAuthCode: function(requestParamMap) {
		requestParamMap.put('access_type', 'offline');
	},
	
	preprocessAccessToken: function(requestParamMap) {
	},
	
	postprocessAccessToken: function(accessTokenResponse) {
		var contentType = accessTokenResponse.getContentType();
		if (contentType && contentType.indexOf('application/json') != -1) {
			var tokenResponse = (new global.JSON()).decode(accessTokenResponse.getBody());
			var paramMap = accessTokenResponse.getparameters();
			for (param in tokenResponse)
				paramMap.put(param, tokenResponse[param].toString());
		}
	},
	
	type: 'OAuthGoogleHandler'
}