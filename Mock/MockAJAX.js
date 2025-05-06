var MockAJAX = Class.create();
MockAJAX.prototype = {
    initialize: function() {},
    type: 'MockAJAX'
};
MockAJAX.test = function(className, functionName, parametersObject) {
    var mock = MockAJAX.getMockObject();
    for(var x in parametersObject) {
        mock.request.setParameter(x, parametersObject[x]);
    }
    mock.request.setParameter("sysparm_name", functionName);
    var ajax = new className(mock.request, mock.responseXML, mock.gc);
    return ajax.process();
};
var MockRequest = Class.create();
MockRequest.prototype = {
    parameters: {},
    initialize: function() {
    },
    getParameter: function(name) {
        return this.parameters[name] || null;
    },
    setParameter: function(name, value) {
        this.parameters[name] = value;
    },
    type: 'MockRequest'
};
MockAJAX.getMockRequest = function() {
    return new MockRequest();
};
MockAJAX.getMockResponseXML = function() {
    return new XMLDocument2();
};
MockAJAX.getMockGC = function() {
    return {};
};
MockAJAX.getMockObject = function() {
    var mock = {};
    mock.request = MockAJAX.getMockRequest();
    mock.responseXML = MockAJAX.getMockResponseXML();
    mock.gc = MockAJAX.getMockGC();
    return mock;
};