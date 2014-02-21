'use strict';

// осуществляет трансформацию запросов и ответов от клиентов сервисов в соответствии с правилами трансформациии
// предоставляет возможность вызова произвольного метода произволльного сервиса

var argstrans = require( './argstrans' );



var Provider = function( config ) {
	this._connector = config.connector;
	this._dict = config.dict
};

Provider.prototype._dict = {
//	'%service%':{
//		'%method%':{
//			request:{
//				rules:[],
//				template:{}
//			},
//			response:{
//	 			rules:[],
//	 			template:{}
//			}
//		}
//	}
};

Provider.request = function( request, cb ) {
	var self = this;
	var proxyRequest;
	var requestRules;
	var requestTemplate;

	requestRules = [];
	requestTemplate = {};
	if ( self._dict[request.service]
		&& self._dict[request.service][request.method]
		&& self._dict[request.service][request.method].request
		&& self._dict[request.service][request.method].request.rules ) {
		requestRules = self._dict[request.service][request.method].request.rules;
	}
	if ( self._dict[request.service]
		&& self._dict[request.service][request.method]
		&& self._dict[request.service][request.method].request
		&& self._dict[request.service][request.method].request.template ) {
		requestTemplate = self._dict[request.service][request.method].request.template;
	}
	proxyRequest = argstrans( requestRules, request.request, requestTemplate );

	self._connector.request( {
		service: request.service,
		method: request.method,
		request: proxyRequest
	}, function( err, res ) {
		var proxyResponse;
		var responseRules;
		var responseTemplate;
		if ( err ) { return cb( err ); }

		responseRules = [];
		responseTemplate = {};
		if ( self._dict[request.service]
			&& self._dict[request.service][request.method]
			&& self._dict[request.service][request.method].response
			&& self._dict[request.service][request.method].response.rules ) {
			responseRules = self._dict[request.service][request.method].response.rules;
		}
		if ( self._dict[request.service]
			&& self._dict[request.service][request.method]
			&& self._dict[request.service][request.method].response
			&& self._dict[request.service][request.method].response.template ) {
			responseTemplate = self._dict[request.service][request.method].response.template;
		}
		proxyResponse = argstrans( responseRules, res, responseTemplate );

		return cb( null, proxyResponse );
	} );
};



module.exports = exports = Provider;
