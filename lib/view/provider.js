'use strict';

var argstrans = require( './argstrans' );

var Provider = function( config ) {
	this._proxy = config.proxy;
};

//TODO: принять настройки перекодирования запросов и ответов
Provider.request = function( request, cb ) {
	var self = this;
	var proxyRequest;
	var requestRules;
	var requestTemplate;

	requestRules = []; //FIXME
	requestTemplate = {}; //FIXME
	proxyRequest = argstrans( requestRules, request.request, requestTemplate );

	self._proxy.request( {
		service: request.service,
		method: request.method,
		request: proxyRequest
	}, function( err, res ) {
		var proxyResponse;
		var responseRules;
		var responseTemplate;
		if ( err ) { return cb( err ); }

		responseRules = []; //FIXME
		responseTemplate = {}; //FIXME
		proxyResponse = argstrans( responseRules, res, responseTemplate );

		return cb( null, proxyResponse );
	} );
};



module.exports = exports = Provider;
