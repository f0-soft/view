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
		function( cb ) { // построение контейнера задачи
			return next( cb, null, {
				self: self,
				request: request
			} );
		},
		// tasks
		checkSelector,
		buildRootRequest,
		buildRootJoinFields,
//		buildShrinkRequest,
		buildSortOptions,
//		requestShrinks,
		buildAccessRequest,
		requestRoot,
		buildJoinQueryAndRequest,
		buildLinks,
		buildResponse
	];

	async.waterfall( tasks, function( err, job ) {
		if ( err ) { return cb( err ); }
		return cb( null, job.response );
	} );

	return next( cb, null, {} );
};

function checkSelector( job, cb ) {
	var view, id, dict;
	var self = job.self;
	var selector = job.request.request.selector;

	// селектор
	view = Object.keys( selector );
	for ( var i = 0; i < view.length; i += 1 ) {
		if ( !self._vids[ view[i] ] ) { return self._nextError( cb, 'в запросе использована несуществующая view: `{{v}}`', {v: view[i]} ); }
		if ( !self._views[ job.request.name ].aux[ view[i] ] ) { return self._nextError( cb, 'в запросе использована неразрешенная view: `{{v}}`', {v: view[i]} ); }

		id = Object.keys( selector[ view[i] ] );
		for ( var j = 0; j < id.length; j += 1 ) {
			dict = self._vids[ view[i] ][ id[j] ];
			if ( !dict ) { return self._nextError( cb, 'в запросе использован несуществующий vid: `{{v}}.{{id}}`', {v: view[i], id: id[j]} ); }
		}
	}

	// список vids
	for ( var k = 0; k < job.request.vids.length; k += 1 ) {
		dict = self._vids[ job.request.name ][ job.request.vids[i] ];
		if ( !dict ) { return self._nextError( cb, 'запрошенный vid не существует: {{id}}', {id: job.request.vids[i]} ); }
	}

	// сортировка
	id = Object.keys( (job.request.request.options || {}).sort || {} );
	for ( var z = 0; z < id.length; z += 1 ) {
		dict = self._vids[ job.request.name ][ id[z] ];
		if ( !dict ) { return self._nextError( cb, 'в параметрах сортировки использован несуществующий vid: `{{id}}`', {id: id[z]} ); }
	}

	return next( cb, null, job );
}

function buildRootRequest( job, cb ) {
	var view, id, dict;
	var field, rootField;
	var self = job.self;
	var rootRequest;
	var selector = job.request.request.selector;

	// создание пустого запроса корня
	rootRequest = {
		table: self._roots[ job.request.name ].table,
		query: {},
		fields: [ self._doc.ID ],
		options: traverse.clone( job.request.request.options || {} )
	};

	// составление запроса к корню
	view = Object.keys( selector );
	for ( var i = 0; i < view.length; i += 1 ) {

		id = Object.keys( selector[ view[i] ] );
		for ( var j = 0; j < id.length; j += 1 ) {
			dict = self._vids[ view[i] ][ id[j] ];

			rootField = dict.source.rootField;
			field = dict.source.field;

			if ( !rootField ) { // root
				rootRequest.query[field] = selector[ view[i] ][ id[j] ];
			}
		}
	}

	// результат
	job.rootRequest = rootRequest;

	return next( cb, null, job );
}

function buildRootJoinFields( job, cb ) {
	var dict;
	var service, method, table, field, rootField;
	var self = job.self;
	var rootRequest = job.rootRequest;
	var joinRequest = {}; // service.method.table.rootField = { fields: [], query: { key: value } }

	// составление необходимых полей от корня и джойнов
	for ( var k = 0; k < job.request.vids.length; k += 1 ) {
		dict = self._vids[ job.request.name ][ job.request.vids[i] ];

		service = dict.service;
		method = dict.methods[ME];
		table = dict.source.table;
		rootField = dict.source.rootField;
		field = dict.source.field;

		if ( !rootField ) { // root
			rootRequest.fields.push( field );
		} else { // join
			createEmptyJoinRequest( [service, method, table, rootField], joinRequest, { query: {}, fields: [ self._doc.ID ] } );

			// добавление rootField в список полей запроса корня 
			rootRequest.fields.push( rootField );

			joinRequest[service][method][table][rootField].fields.push( field );
		}
	}

	job.joinRequest = joinRequest;

	return next( cb, null, job );
}

function buildShrinkRequest( job, cb ) {
	var view, id, dict, key;
	var service, method, table, field, rootField;
	var self = job.self;
	var selector = job.request.request.selector;
	var shrinkRequest = {};
	var shrinks = {};
	var shrinkTasks = []; // * = { info: [service,method,table,rootField], request: { fields: [], query: { key: value } }


	// составление запроса к шринкам
	view = Object.keys( selector );
	for ( var i = 0; i < view.length; i += 1 ) {

		id = Object.keys( selector[ view[i] ] );
		for ( var j = 0; j < id.length; j += 1 ) {
			dict = self._vids[ view[i] ][ id[j] ];

			service = dict.service;
			method = dict.methods[ME];
			table = dict.source.table;
			rootField = dict.source.rootField;
			field = dict.source.field;

			if ( rootField ) { // shrink
				createEmptyJoinRequest( [service, method, table, rootField], shrinkRequest, {
					table: table,
					query: {},
					fields: [ self._doc.ID ]
				} );

				// field
				shrinkRequest[service][method][table][rootField].query[field] = selector[ view[i] ][ id[j] ];

				// shrink
				key = [service, method, table, rootField]; // предотвращение множественных вхождений посредством ключей объекта
				shrinks[ key.join( '/' ) ] = key;
			}
		}
	}

	// перегруппировка запросов к шринкам
	key = Object.keys( shrinks );
	for ( var z = 0; z < key.length; z += 1 ) {
		service = shrinks[ key[z] ][0];
		method = shrinks[ key[z] ][1];
		table = shrinks[ key[z] ][2];
		rootField = shrinks[ key[z] ][3];

		shrinkTasks[z] = {
			info: shrinks[ key[z] ],
			request: shrinkRequest[service][method][table][rootField]
		};
	}

	// результат
	job.shrinkRequest = shrinkTasks;

	return next( cb, null, job );
}

function buildSortOptions( job, cb ) {
	var self = job.self;
	var id, dict, out;
	var options = job.rootRequest.options;

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
	var shrinkRequest = job.shrinkRequest;

	if ( !shrinkRequest.length ) { return next( cb, null, job ); }

	return async.map( shrinkRequest, function( task, cb ) {
		var request = {
			service: task.info[0],
			method: task.info[1],
			request: task.request
		};
		self._provider.request( request, function( err, res ) {
			if ( err ) { return cb( err ); }
			return cb( null, res );
		} );
	}, function( err, res ) {
		if ( err ) { return cb( err ); }
		//TODO: сделать сужение запроса корня
		return cb( null, job );
	} );
}

function buildAccessRequest( job, cb ) {
	var self = job.self;
	var rules, access, reqAccess, keys, val;

	if ( !self._views[ job.request.name ].access.find ) { return next( cb, null, job ); }

	rules = self._views[ job.request.name ].access.find;
	reqAccess = job.request.access;
	access = rules[reqAccess.role] || rules[self._access.ALL] || {};

	keys = Object.keys( access );
	for ( var i = 0; i < keys.length; i += 1 ) {
		val = access[ keys[i]];
		if ( access[ keys[i] ] === self._access.USER || access[ keys[i] ] === self._access.COMPANY ) {
			val = val
				.replace( self._access.USER, reqAccess.user_id )
				.replace( self._access.COMPANY, reqAccess.company_id );
		}
		job.rootRequest.query[ keys[i] ] = val;
	}

	return next( cb, null, job );
}

function requestRoot( job, cb ) {
	var self = job.self;
	var request = {
		service: self._roots[ job.request.name ].service,
		method: self._roots[ job.request.name ].methods[ME],
		request: job.rootRequest
	};
	request.request.fields = unique( request.request.fields );

	self._provider.request( request, function( err, res ) {
		if ( err ) { return cb( err ); }
		//TODO: преобразовать результат если надо
		job.rootResult = res;

		return cb( null, job )
	} );
}

function buildJoinQueryAndRequest( job, cb ) {
	var self = job.self;
	var serviceKeys, methodKeys, tableKeys, rootFieldKeys;
	var service, method, table, rootField;
	var tasks = [];
	var root = job.rootResult;
	var req = job.joinRequest;

	if ( !root.length ) { return next( cb, null, job ); }
	
	serviceKeys = Object.keys( req );
	for ( var i = 0; i < serviceKeys.length; i += 1 ) {
		service = serviceKeys[i];

		methodKeys = Object.keys( req[service] );
		for ( var j = 0; j < methodKeys.length; j += 1 ) {
			method = methodKeys[j];

			tableKeys = Object.keys( req[service][method] );
			for ( var k = 0; k < tableKeys.length; k += 1 ) {
				table = tableKeys[k];

				rootFieldKeys = Object.keys( req[service][method][table] );
				for ( var m = 0; m < rootFieldKeys.length; m += 1 ) {
					rootField = rootFieldKeys[m];

					tasks.push( {
						smtr: [service, method, table, rootField].join( '/' ),
						service: service,
						method: method,
						table: table,
						rootField: rootField,
						request: req[service][method][table][rootField]
					} );
				}
			}
		}
	}

	if ( !tasks.length ) { return next( cb, null, job ); }

	return async.map( tasks, function( task, cb ) {
		var request = {
			service: task.service,
			method: task.method,
			request: task.request
		};
		request.request.fields = unique( request.request.fields );
		self._provider.request( request, function( err, res ) {
			if ( err ) { return cb( err ); }
			//TODO: преобразовать результат если надо
			return cb( null, res );
		} )
	}, function( err, res ) {
		if ( err ) { return cb( err ); }

		job.joinResult = {};
		for ( var i = 0; i < res.length; i += 1 ) {
			job.joinResult[ tasks[i].smtr ] = res[i];
		}

		return cb( null, job );
	} );
}

function buildLinks( job, cb ) {
	return next( cb, null, job );
}

function buildResponse( job, cb ) {
	return next( cb, null, job );
}



// TOOLS
function createEmptyJoinRequest( path, request, template ) {
	var node = request;

	for ( var i = 0; i < path.length - 1; i += 1 ) {
		if ( !node[ path[i] ] ) { node[ path[i] ] = {}; }
		node = node[ path[i] ];
	}

	if ( !node[ path[path.length - 1] ] ) {
		node[ path[path.length - 1] ] = traverse.clone( template );
	}
}

function unique( arr ) {
	var out = [];

	for ( var i = 0; i < arr.length; i += 1 ) {
		if ( out.indexOf( arr[i] ) === -1 ) {
			out.push( arr[i] );
		}
	}

	return out;
}

// ids = ['00id', '01id_00id', '02id_01id_00id']
// path = [
//     ['service', 'method', 'table', 'field'],
//     ['service', 'method', 'table', 'field']
// ]
// root = ['service', 'method', 'table', 'field']
// join = ['service', 'method', 'table', 'field'] - искомые id

function getIdsByPath( ids, path, root, join ) {
	var chainLength;
	var chain;
	var out = [];

	var rootPosition = getPathPosition( path, root );
	var joinPosition = getPathPosition( path, join );

	chainLength = rootPosition - joinPosition;

	if ( chainLength < 1 || chainLength > path.length ) { throw new Error( 'не удалось вычислить расстояние между источниками' ); }

	for ( var j = 0; j < ids.length; j += 1 ) {
		chain = ids[j].split( '_' );
		if ( chain.length === chainLength ) {
			out.push( chain[0] );
		}
	}

	return out;
}

function getPathPosition( path, elem ) {
	for ( var i = 0; i < path.length; i += 1 ) {
		if ( path[i][0] !== elem[0] ) { continue; }
		if ( path[i][1] !== elem[1] ) { continue; }
		if ( path[i][2] !== elem[2] ) { continue; }
		if ( path[i][3] !== elem[3] ) { continue; }
		return i;
	}
	return i;
}
