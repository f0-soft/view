'use strict';

// осуществляет запуск клиентов сервисов
// предоставляет возможность вызова произвольного метода произволльного сервиса

var next = require( 'nexttick' );


// config = [] - массив сервисов
// config.*.name - строка
// config.*.pkg - строка
// config.*.config - объект
var Proxy = function( config ) {
	var name, pkg, cfg;
	var services = {};

	for ( var i = 0; i < config.length; i += 1 ) {
		name = config[i].name;
		pkg = require( config[i].pkg );
		cfg = config[i].cfg;
		
		//TODO: уточнить как запускаются клиенты сервисов
		services[ name ] = new pkg( cfg );
	}

	this._services = services;
};

Proxy.request = function( request, cb ) {
	var self = this;
	var service = request.service || 'flexo';
	var method = request.method;

	if ( !self._services[service] ) { return next( cb, new Error( 'нет такого сервиса: ' + service ) ); }
	if ( !self._services[service][method] ) { return next( cb, new Error( 'нет такого метода: ' + method ) ); }

	return self._services[service][method]( request.request, function( err, res ) {
		if ( err ) { return cb( err ); }

		return cb( null, res );
	} );
};



module.exports = exports = Proxy;
