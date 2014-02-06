'use strict';

var next = require( 'nexttick' );



function noop( req, cb ) { return next( cb, null, {} ); }



var Service = function( cfg ) {};
Service.prototype.find = noop;
Service.prototype.insert = noop;
Service.prototype.modify = noop;
Service.prototype.delete = noop;
Service.prototype.edit = noop;
Service.prototype.close = function() {};



var ServiceInfo = {
	edit: { // название метода
		user: { // описание сужения по пользователю
			path: 'req.*.user', // путь по аргументу вызова по которому должен быть указан параметр в запросе
			required: true // обязательно ли указание параметра
		},
		company: { // такое же описание для компании
			path: 'req.*.company'
		}
	}
};



exports.init = function( cfg, cb ) {
	var server = new Service( cfg );
	
	return next( cb, null, {
		methods: server,
		info: ServiceInfo,
		close: function() {}
	} );
};
