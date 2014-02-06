'use strict';
// пример конфига подключения сервиса к универсальному клиенту



// название под которым сервис будет фигурировать в схемах view
exports.name = 'mock';



// перечень методов, которые должны быть доступны через универсальный клиент
exports.subscribe = {
	edit: true
};



// функция запуска клиента
// индивидуальна для каждого сервиса на всякий случай
exports.init = function( cb ) {
	var lib = require( './../test.client/MockServiceClient' );

	lib.init( {
		host: 'localhost',
		port: 1337
	}, function( err, client ) {
		if ( err ) { return cb( err ); }
		return cb( null, client );
	} );
};
