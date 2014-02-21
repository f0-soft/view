'use strict';

// осуществляет запуск клиентов сервисов
// предоставляет возможность вызова произвольного метода произволльного сервиса

var next = require( 'nexttick' );
var async = require( 'async' );


// config = [] - массив сервисов
// config.*.name - строка
// config.*.pkg - строка
// config.*.config - объект
var Connector = function( config ) {
	//TODO: проверить конфиг по argstype

	this._services = {};
	this._config = config;
};

Connector.prototype.start = function( cb ) {
	var self = this;
	async.map( self._config, function( item, cb ) {
		//FIXME: поймать исключение
		var name = item.name;
		var pkg = require( item.pkg );
		var cfg = item.config;

		//TODO: уточнить как запускаются клиенты сервисов
		pkg.init( cfg, function( err, client ) {
			if ( err ) { return cb( err ); }

			self._services[name] = client;
			return cb( null );
		} );
	}, cb );
};

Connector.prototype.request = function( request, cb ) {
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
