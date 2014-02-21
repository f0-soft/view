'use strict';

// осуществляет запуск клиентов сервисов
// предоставляет возможность вызова произвольного метода произволльного сервиса

var next = require( 'nexttick' );


// config = [] - массив сервисов
// config.*.name - строка
// config.*.pkg - строка
// config.*.config - объект
var Connector = function( config ) {
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

Connector.request = function( request, cb ) {
	var self = this;
	var service = request.service || 'flexo';
	var method = request.method;
	var svc, args;

	if ( !self._services[service] ) { return next( cb, new Error( 'нет такого сервиса: ' + service ) ); }
	if ( !self._services[service][method] ) { return next( cb, new Error( 'нет такого метода: ' + method ) ); }

	// копия контейнера
	svc = self._services[service];
	args = request.request.slice();

	// наш коллбек последним аргументом
	args[args.length] = function( err, res ) {
		if ( err ) { return cb( err ); }

		return cb( null, res );
	};

	// запуск метода сервиса
	return svc[method].apply( svc, args );
};



module.exports = exports = Connector;
