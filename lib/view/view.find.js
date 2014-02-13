'use strict';

var async = require( 'async' );
var next = require( 'nexttick' );
var traverse = require( 'traverse' );



var ME = 'find';

exports.check = [
	['request', true, 'o', [
		['name', true, 's'],
		['vids', true, 'a', 's'],
		['request', true, 'o', [
			['selector', true, 'o', [
				'*', true, 'o'
			]],
			['options', false, 'o', [
				['count', false, 'b'],
				['sort', false, 'o', 'n'],
				['skip', false, 'n'],
				['limit', false, 'n']
			]]
		]],
		['access', true, 'o', [
			['company_id', true, 's'],
			['user_id', true, 's'],
			['role', true, 's']
		]]
	]],
	['callback', true, 'f']
];

exports.method = function( request, cb ) {
	this._log( 'find', arguments );
	var self = this;
	var errType = self._check[ME]( arguments );
	var tasks;

	if ( errType ) { return next( cb, errType ); }
	if ( !self._views[request.name] ) { return self._nextError( cb, 'запрошенная view не существует: `{{v}}`', {v: request.name} ); }

	tasks = [
		function( cb ) { //init job
			return next( cb, null, {
				self: self,
				request: request
			} );
		},
		// tasks
		buildRequestByServiceMethodTable,
		buildSortOptions,
		requestShrinks
	];

	async.waterfall( tasks, function( err, job ) {
		if ( err ) { return cb( err ); }
		return cb( null, job.res );
	} );

	return next( cb, null, {} );
};

function buildRequestByServiceMethodTable( job, cb ) {
	var view, id, dict, key;
	var service, method, table, field, rootField;
	var self = job.self;
	var request = {}; // service.method.table = { fields: [], request: { key: value } }
	var shrinks = {};
	var selector = job.request.request.selector;
	var root = self._roots[ job.request.name ];

	// создание пустого запроса корня
	request[ root.service ] = {};
	request[ root.service ][ root.methods[ME] ] = {};
	request[ root.service ][ root.methods[ME] ][ root.table ] = {
		fields: [],
		request: {},
		options: traverse.clone( job.request.request.options || {} )
	};

	// разбиение селекторов
	view = Object.keys( selector );
	for ( var i = 0; i < view.length; i += 1 ) {
		if ( !self._vids[ view[i] ] ) { return self._nextError( cb, 'в запросе использована несуществующая view: `{{v}}`', {v: view[i]} ); }
		if ( !self._views[ job.request.name ].aux[ view[i] ] ) { return self._nextError( cb, 'в запросе использована неразрешенная view: `{{v}}`', {v: view[i]} ); }

		id = Object.keys( selector[ view[i] ] );
		for ( var j = 0; j < id.length; j += 1 ) {
			dict = self._vids[ view[i] ][ id[j] ];
			if ( !dict ) { return self._nextError( cb, 'в запросе использован несуществующий vid: `{{v}}.{{id}}`', {v: view[i], id: id[j]} ); }

			// service
			service = dict.service;
			if ( !request[ service ] ) { request[ service ] = {}; }

			// method
			method = dict.methods[ME];
			if ( !request[ service ][ method ] ) { request[ service ][ method ] = {}; }

			// table
			table = dict.source.table;
			if ( !request[ service ][ method ][ table ] ) { request[ service ][ method ][ table ] = { fields: [], request: {} }; }

			// shrink info
			key = [service, method, table]; // предотвращение множественных вхождений посредством объекта
			if ( service !== root.service || method !== root.methods[ME] || table !== root.table ) { shrinks[ key.join( '/' ) ] = key; }

			// field
			field = dict.source.field;
			request[ service ][ method ][ table ].request[ field ] = selector[ view[i] ][ id[j] ];

			// добавление rootField в список полей запроса корня 
			rootField = dict.source.rootField;
			if ( rootField ) { request[ root.service ][ root.methods[ME] ][ root.table ].fields.push( rootField ); }
		}
	}

	// добавление полей в запросы компонентов
	for ( var k = 0; k < job.request.vids.length; k += 1 ) {
		dict = self._vids[ job.request.name ][ job.request.vids[i] ];
		if ( !dict ) { return self._nextError( cb, 'запрошенный vid не существует: {{id}}', {id: job.request.vids[i]} ); }

		if ( !request[ dict.service ] ) { request[ dict.service ] = {}; }
		if ( !request[ dict.service ][ dict.methods[ME] ] ) { request[ dict.service ][ dict.methods[ME] ] = {}; }
		if ( !request[ dict.service ][ dict.methods[ME] ][ dict.table ] ) { request[ dict.service ][ dict.methods[ME] ][ dict.table ] = { request: {}, fields: [], options: {} }; }

		request[ dict.service ][ dict.methods[ME] ][ dict.table ].fields.push( dict.source.field );
	}

	// результат
	job.requestBySMT = request;
	job.shrinks = shrinks;
	return next( cb, null, job );
}

function buildSortOptions( job, cb ) {
	var self = job.self;
	var id, dict, out;
	var root = self._roots[ job.request.name ];
	var options = job.requestBySMT[ root.service ][ root.methods[ME] ][ root.table ];

	if ( !options.sort ) { return next( cb, null, job ); }

	id = Object.keys( options.sort );
	if ( !id.length ) { return next( cb, null, job ); }

	// конструирование параметра сортировки
	//FIXME: только для корня
	out = {};
	for ( var i = 0; i < id.length; i += 1 ) {
		dict = self._vids[ job.request.name ][ id[i] ];
		if ( !dict ) { return self._nextError( cb, 'в параметрах сортировки использован несуществующий vid: `{{id}}`', {id: id[i]} ); }

		out[ dict.source.field ] = options.sort[ id[i] ];
	}

	options.sort = out;
	return next( cb, null, job );
}

function requestShrinks( job, cb ) {
	var self = job.self;
	var tasks;
	var keys = Object.keys( job.shrinks );

	if ( !keys.length ) { return next( cb, null, job ); }

	tasks = [];
	for ( var i = 0; i < keys.length; i += 1 ) {
		tasks[i] = job.shrinks[ keys[i] ];
	}

	return async.map( tasks, function( task, cb ) {
		var node = job.requestBySMT[ task[0] ][ task[1] ][ task[2] ];
		var request = {
			service: task[0],
			method: task[1],
			request: {
				table: task[2],
				query: node.request,
				fields: node.fields,
				options: node.options
			}
		};
		self._provider.request( request, function( err, res ) {
			//TODO: continue
		} );
	}, function( err, res ) {
		if ( err ) { return cb( err ); }
		return cb( null, job );
	} );
}
