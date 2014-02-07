'use strict';
// пример конфига подключения сервиса к универсальному клиенту



// название под которым сервис будет фигурировать в схемах view
exports.name = 'mock';



// перечень методов, которые должны быть доступны через универсальный клиент
// может быть пустым
exports.subscribe = {
	edit: true
};



// функция запуска клиента
// индивидуальна для каждого сервиса
exports.init = function( cb ) {
	var lib = require( './../test.client/MockClient' );

	lib.init( {
		host: 'localhost',
		port: 1337
	}, function( err, client ) {
		if ( err ) { return cb( err ); }
		return cb( null, client );
	} );
};



var check = [
	['config', true, 'o', [
		['name', true, 's'],
		['subscribe', true, 'o', [
			'*', false, 'b'
		]],
		['init', true, 'f']
	]]
];
