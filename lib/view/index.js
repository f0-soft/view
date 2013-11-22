'use strict';

var fs = require( 'fs' );
var dot = require( 'dot' );
var async = require( 'async' );
var argstype = require( 'f0.argstype' );
var configSlicer = require( './config-slicer' );
var vidlib = require( './vid-lib' );
var pathlib = require( './path' );



var log = function() {};
if ( process.env.DEBUG && process.env.DEBUG.indexOf( 'view' ) !== -1 ) {
	log = console.log;
}



var container = {};
var INITIALIZED;
var PROVIDER;
var SLICER;
var VIEWS;
var PATHS;
var PROVIDER_ALIAS;
var SETTINGS = {
	templatePath: '',
	templateTimeout: 5 * 60 * 1000, // 5 минут в миллисекундах
	templates: {}, // object of [template, timestamp]
	templateNames: [],
	configSlicer: {
		stopNames: ['_vid', '_flexo', '_title', '_description'],
		copyTypes: ['string', 'number', 'boolean']
	}
};
var DOC_ID = '_id';
var DOC_UPDATE = 'tsUpdate';
var DOC_PATH = '_path';
var VID_LINK = '_link';
var AGGREGATE_ID = '%id%';
var REPLACE_ID = '%id%';
var REPLACE_USER_ID = '%user_id%';
var REPLACE_COMPANY_ID = '%company_id%';
var ACCESS_ALL = '*';
var checks = {};



function myErr( text ) {
	return (new Error( 'f0.view: ' + text ));
}

function next( callback ) {
	return process.nextTick( Function.bind.apply( callback, arguments ) );
}



checks.getTemplate = argstype.getChecker( myErr, [
	['name', true, 's'],
	['vids', true, 'a', [
		'*', false, 's'
	]],
	['callback', true, 'f']
] );
container.getTemplate = function( name, vids, callback ) {
	log( 'View.getTemplate:', arguments );
	var errType = checks.getTemplate( arguments );
	var template, res;

	if ( errType ) { return next( callback, errType ); }
	if ( VIEWS[name] === undefined ) { return next( callback, myErr( 'не существует view `' + name + '`' ) ); }

	// slice config - get user config
	// gather remaining vids in config
	try {
		res = SLICER( VIEWS[name].view.config, vids );
	} catch ( e ) {
		return next( callback, myErr( e ) );
	}

	// load template
	// process template with config
	return loadTemplate( name, function( err, processor ) {
		if ( err ) {
			return callback( myErr( err ) );
		}

		try {
			template = processor( res.config );
		} catch ( e ) {
			return callback( myErr( 'внутренняя ошибка шаблона: ' + e ) );
		}

		return callback( null, res.vids, res.config, template );
	} );
};

function loadTemplate( name, callback ) {
	var now = Date.now();
	var min = now - SETTINGS.templateTimeout;
	var i, processor;

	// loop back search
	for ( i = SETTINGS.templateNames.length - 1; i >= 0; i -= 1 ) {
		// find processor
		if ( SETTINGS.templateNames[i] === name ) {
			processor = SETTINGS.templates[SETTINGS.templateNames[i]][0];
			SETTINGS.templates[SETTINGS.templateNames[i]][1] = now;
			continue;
		}

		// remove old
		if ( SETTINGS.templates[SETTINGS.templateNames[i]][1] < min ) {
			delete SETTINGS.templates[SETTINGS.templateNames[i]];
			SETTINGS.templateNames.splice( i, 1 );
		}
	}

	if ( processor ) {
		return next( callback, null, processor );
	}

	// load processor
	if ( VIEWS[name].view.template === undefined ) {
		processor = emptyProcessor;
		SETTINGS.templateNames.push( name );
		SETTINGS.templates[name] = [ processor, now ];

		return next( callback, null, processor );
	}

	return fs.readFile( (SETTINGS.templatePath + VIEWS[name].view.template), {encoding: 'utf8'}, function( err, template ) {
		if ( err ) {
			return callback( err );
		}

		processor = dot.template( template );
		SETTINGS.templateNames.push( name );
		SETTINGS.templates[name] = [ processor, now ];

		return callback( null, processor );
	} );
}

function emptyProcessor() {
	return '';
}



checks.find = argstype.getChecker( myErr, [
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
	]],
	['callback', true, 'f']
] );
container.find = function( name, vids, request, access, callback ) {
	log( 'View.find:', arguments );
	var errType = checks.find( arguments );
	var rootName, requestOptions;
	var i, j, requestGroups, keys, key;
	var rootSelector, joinSelector, rootFields;
	var flexo, prop, field, path, paths = {};
	var tasks = {};

	if ( errType ) { return next( callback, errType ); }
	if ( VIEWS[name] === undefined ) { return next( callback, myErr( 'не существует view `' + name + '`' ) ); }
	if ( VIEWS[name].view.root === undefined ) { return next( callback, myErr( 'невозможно обработать запрос данных к view без корневой flexo' ) ); }

	rootName = VIEWS[name].view.root;
	requestOptions = request.options || {};

	rootSelector = {}; // property: value
	joinSelector = {}; // 'scheme|field': array, of [ property, value ]*



	// подготовка полей корня
	rootFields = vidlib.fieldsOfFlexo( rootName, vids, VIEWS[name].vids );



	// разбиение запроса на секции
	requestGroups = Object.keys( request.selector );
	for ( i = 0; i < requestGroups.length; i += 1 ) {
		keys = Object.keys( request.selector[ requestGroups[i] ] );
		for ( j = 0; j < keys.length; j += 1 ) {
			if ( VIEWS[ requestGroups[i] ].vids[ keys[j] ] === undefined ) {
				continue;
			}

			flexo = VIEWS[ requestGroups[i] ].vids[ keys[j] ][0];
			prop = VIEWS[ requestGroups[i] ].vids[ keys[j] ][1];
			field = VIEWS[ requestGroups[i] ].vids[ keys[j] ][2];
			path = VIEWS[ requestGroups[i] ].vids[ keys[j] ][3];

			if ( flexo === rootName ) {
				rootSelector[ prop ] = request.selector[ requestGroups[i] ][ keys[j] ];
			} else {
				key = flexo + '|' + field;

				if ( !joinSelector[key] ) {
					joinSelector[key] = {
						flexo: flexo,
						selector: {}
					};
					paths[key] = PATHS[path];
				}

				// join selector
				joinSelector[key].selector[prop] = request.selector[ requestGroups[i] ][ keys[j] ]
			}
		}
	}

	// add fields badly
	for ( i = 0; i < vids.length; i += 1 ) {
		path = VIEWS[ name ].vids[ vids[i] ];

		if ( path && path[0] !== rootName && path[2] !== undefined ) {
			// add fields
			if ( rootFields.indexOf( path[2] ) === -1 ) {
				rootFields.push( path[2] );
			}
		}
	}



	// сборка заданий для сужения по джойнам
	keys = Object.keys( joinSelector );
	for ( i = 0; i < keys.length; i += 1 ) {
		// здесь надо сделать запросы к видимым/невидимым джойнам чтобы собрать шринк
		tasks[keys[i]] = PROVIDER.find.bind( PROVIDER, {name: joinSelector[keys[i]].flexo, fields: [DOC_ID], query: joinSelector[ keys[i] ].selector, options: {}} );
	}


	// запуск шринков асинком
	return async.parallel( tasks, findShrinksCallback.bind( { name: name, request: request, rootSelector: rootSelector, rootFields: rootFields, requestOptions: requestOptions, vids: vids, access: access, paths: paths, callback: callback } ) );
};

function findShrinksCallback( err, data ) {
	var i, j, keys, path, names;
	var ids, request_in;
	var request = {};
	var rootName;
	var root_in;
	var sortOption;

	if ( err ) { return this.callback( err ); }

	rootName = VIEWS[this.name].view.root;



	// сборка шринков
	keys = Object.keys( data );
	for ( i = 0; i < keys.length; i += 1 ) {
		ids = [];
		for ( j = 0; j < data[ keys[i] ].result.length; j += 1 ) {
			ids.push( data[ keys[i] ].result[j][DOC_ID] );
		}

		path = PATHS[ this.paths[ keys[i] ] ];
		names = keys[i].split( '|' ); // flexo|depend_field

		if ( !request[names[1]] ) {
			request[names[1]] = {$in: ids};
		} else {
			request_in = request[names[1]].$in;

			for ( j = request_in.length - 1; j >= 0; j -= 1 ) {
				if ( ids.indexOf( request_in[j] ) === -1 ) {
					request_in.splice( j, 1 );
				}
			}

			if ( request_in.length === 0 ) { // no documents
				return this.callback( null, {result: [
					[],
					[]
				], count: 0} );
			}
		}
	}



	// пересечение шринков с rootSelector
	keys = Object.keys( request );
	for ( i = 0; i < keys.length; i += 1 ) {
		if ( this.rootSelector[ keys[i] ] === undefined ) {
			this.rootSelector[ keys[i] ] = request[ keys[i] ];
		} else {
			request_in = request[ keys[i] ].$in;
			root_in = this.rootSelector[ keys[i] ].$in;
			// FIX: support only '$in' request and request by value

			// make an array
			if ( typeof this.rootSelector[ keys[i] ] !== 'object' ) {
				// from value of id
				this.rootSelector[ keys[i] ] = {$in: [ this.rootSelector[ keys[i] ] ]};
			} else {
				return this.callback( myErr( 'не удается объединить запрос пользователя с запросом от шринков: ' + JSON.stringify( [this.rootSelector, request] ) ) );
			}

			// find common
			for ( j = root_in.length - 1; j > 0; j -= 1 ) { // except zero element with '$in'
				if ( request_in.indexOf( root_in[j], 1 ) === -1 ) {
					root_in.splice( j, 1 );
				}
			}

			// no documents
			if ( root_in.length === 0 ) {
				return this.callback( null, {result: [
					[],
					[]
				], count: 0} );
			}
		}
	}



	// сужение по пользователю/компании
	if ( VIEWS[this.name].view.access && VIEWS[this.name].view.access.find ) {
		var my_access = VIEWS[this.name].view.access.find[this.access.role] || VIEWS[this.name].view.access.find[ACCESS_ALL] || {};

		keys = Object.keys( my_access );
		for ( i = 0; i < keys.length; i += 1 ) {
			if ( my_access[ keys[i] ] === REPLACE_USER_ID || my_access[ keys[i] ] === REPLACE_COMPANY_ID ) {
				this.rootSelector[ keys[i] ] = my_access[ keys[i] ].replace( REPLACE_USER_ID, this.access.user_id ).replace( REPLACE_COMPANY_ID, this.access.company_id );
			} else {
				this.rootSelector[ keys[i] ] = my_access[ keys[i] ]
			}
		}
	}



	var options = this.request.options || {};

	if ( options.sort ) {
		keys = Object.keys( options.sort );

		if ( keys.length === 1 ) {
			if ( VIEWS[this.name].vids[keys[0]] === undefined ) { return this.callback( myErr( 'заданного ключа сортировки не существует' ) ); }
			if ( VIEWS[this.name].vids[keys[0]][0] === undefined ) { return this.callback( myErr( 'заданный ключ сортировки не имеет связанной схемы flexo' ) ); }
			if ( VIEWS[this.name].vids[keys[0]][1] === undefined ) { return this.callback( myErr( 'заданный ключ сортировки не имеет связанного поля flexo' ) ); }

			var sort_vid = VIEWS[this.name].vids[keys[0]];

			sortOption = [
				sort_vid[0], // collection
				(sort_vid[0] === rootName) ? sort_vid[1] : sort_vid[2], // dependent field
				{} // sort
			];
			sortOption[2][ sort_vid[1] ] = options.sort[ keys[0] ];
		}
	}


	var requestOptions = {};
	keys = Object.keys( options );
	for ( i = 0; i < keys.length; i += 1 ) {
		requestOptions[keys[i]] = options[keys[i]];
	}
	requestOptions.sort = sortOption;



	// теперь можно запрашивать документы
	// запрос с шринком и полями для джойнов
	return PROVIDER.find( {name: rootName, fields: this.rootFields, query: this.rootSelector, options: requestOptions}, findRootCallback.bind( this ) );
}


function findRootCallback( err, data ) {
	if ( err ) { return this.callback( err ); }

	if ( data.result.length === 0 ) {
		return this.callback( null, {result: [
			[],
			[]
		], count: data.count} );
	}

	this.count = data.count;
	this.dep = data.dep;
	this.documents = data.result;
	this.idFields = data.idFields;

	var taskContainer = {};

	// gather grouping
	for ( var i = 0; i < this.vids.length; i += 1 ) {
		if ( VIEWS[ this.name ].aggr[ this.vids[i] ] === undefined ) { continue; }

		var aggr = VIEWS[ this.name ].aggr[ this.vids[i] ];
		if ( taskContainer[ aggr.name ] === undefined ) {
			taskContainer[ aggr.name ] = {
				group: { _id: '0' },
				match: {}
			};
		}
		if ( aggr.group ) {
			taskContainer[ aggr.name ].group[ this.vids[i] ] = aggr.group;
		}
	}

	// gather selectors
	var keys = Object.keys( this.request.selector );
	for ( i = 0; i < keys.length; i += 1 ) {
		if ( VIEWS[keys[i]] === undefined ) { continue; }

		var subkeys = Object.keys( this.request.selector[keys[i]] );
		for ( j = 0; j < subkeys.length; j += 1 ) {
			if ( VIEWS[keys[i]].aggr[subkeys[j]] === undefined ) { continue; }

			aggr = VIEWS[ keys[i] ].aggr[ keys[i] ];
			if ( taskContainer[ aggr.name ] !== undefined ) {
				taskContainer[ aggr.name ].match[ aggr.selector ] = this.request.selector[keys[i]][subkeys[j]];
			}
		}
	}

	// create requests
	var tasks = [];
	keys = Object.keys( taskContainer );
	for ( i = 0; i < keys.length; i += 1 ) {
		var task = taskContainer[keys[i]];

		var match_keys = Object.keys( task.match );
		var group_keys = Object.keys( task.group );

		var link = VIEWS[this.name].view.aggregate[keys[i]].link;
		var link_key = Object.keys( link )[0];

		// TODO: make a composite aggregation via match-unwind-match-group
		for ( var j = 0; j < data.result.length; j += 1 ) {
			var coll = VIEWS[this.name].view.aggregate[keys[i]].flexo;
			var match = {};

			// make match
			for ( var k = 0; k < match_keys.length; k += 1 ) {
				match[match_keys[k]] = task.match[match_keys[k]];
			}

			match[link_key] = data.result[j][DOC_ID];

			// make group
			var group = {};
			for ( k = 0; k < group_keys.length; k += 1 ) {
				group[group_keys[k]] = task.group[group_keys[k]];
			}
			group[DOC_ID] = data.result[j][DOC_ID];

			var pipeline = [];
			// будет обработан rabbit'ом до нужного вида
			pipeline.push( { $match: match } );
			// получится результат в сыром виде, как он хранился в базе данных (например, money*100)
			pipeline.push( { $group: group } );

			tasks.push( {name: coll, pipeline: pipeline} );
		}
	}



	return async.map( tasks, PROVIDER.aggregate, findAggregateCallback.bind( this ) );
}

function findAggregateCallback( err, results ) {
	// this.name
	// this.vids
	// this.request
	// this.options
	// this.callback
	var elem;
	var ids;
	var rootName;
	var i, j, k;
	var flexo, prop, field, path;
	var joinProps, tasks = [], tasks_dict = [];

	if ( err ) { return this.callback( err ); }



	// parse aggregate
	this.aggregate = [];
	for ( i = 0; i < results.length; i += 1 ) {
		if ( results[i].length > 0 && results[i][0][DOC_ID] !== undefined ) {
			this.aggregate = this.aggregate.concat( results[i] );
		}
	}



	rootName = VIEWS[ this.name ].view.root;

	// подготовка настроек джойнов
	joinProps = {};
	for ( i = 0; i < this.vids.length; i += 1 ) {
		if ( !VIEWS[ this.name ].vids[ this.vids[i] ] || !VIEWS[ this.name ].vids[ this.vids[i] ][1] ) { continue; }

		flexo = VIEWS[ this.name ].vids[ this.vids[i] ][0];
		prop = VIEWS[ this.name ].vids[ this.vids[i] ][1];
		field = VIEWS[ this.name ].vids[ this.vids[i] ][2];
		path = VIEWS[ this.name ].vids[ this.vids[i] ][3];

		var key = '' + flexo + '|' + field;

		if ( flexo !== rootName ) {
			if ( !joinProps[key] ) {
				joinProps[key] = {
					view: this.name,
					flexo: flexo,
					field: field,
					fields: [],
					vids: [],
					documents: this.documents
				};
			}

			// vids per join
			joinProps[key].vids.push( this.vids[i] );

			// fields per join
			if ( joinProps[key].fields.indexOf( prop ) === -1 ) {
				joinProps[key].fields.push( prop );
			}
		}
	}

	var keys = Object.keys( joinProps );
	for ( i = 0; i < keys.length; i += 1 ) {
		elem = joinProps[keys[i]];
		var alias = PROVIDER_ALIAS.c2p[elem.flexo];
		var isarray = false;

		if ( this.documents.length ) {
			isarray = Array.isArray( this.documents[0][elem.field] )
		}
		ids = [];
		for ( j = 0; j < this.documents.length; j += 1 ) {
			if ( isarray ) {
				for ( k = 0; k < this.documents[j][elem.field].length; k += 1 ) {
					if ( this.documents[j][elem.field][k].substr( 0, alias.length ) === alias ) {
						ids.push( this.documents[j][elem.field][k].split( '_', 1 )[0] );
					}
				}
			} else {
				if ( this.documents[j][elem.field] !== undefined ) {
					ids.push( this.documents[j][elem.field] );
				}
			}
		}

		// не предотвращать поиск, чтобы получить пустые результаты, чтобы сделать пустышки джойнов
//		if ( !ids.length ) { continue; }

		ids = pathlib.removeDuplicates( ids );

		var query = {};
		query[DOC_ID] = { $in: ids };

		tasks_dict.push( keys[i] );
		tasks.push( {name: elem.flexo, fields: elem.fields, query: query, options: {}} );
	}

	this.tasks_dict = tasks_dict;

	// run tasks with async
	return async.map( tasks, PROVIDER.find, findJoinsCallback.bind( this ) );
}

function findJoinsCallback( err, result ) {
	// this.name
	// this.vids
	// this.request
	// this.options
	// this.callback
	// this.rootName
	// this.rootVids
	// this.count
	// this.documents
	var field, flexo, rootName;
	var i, j, k, z, x, keys, key, index, roots, chains, target, res = [];

	if ( err ) { return this.callback( err ); }



	rootName = VIEWS[this.name].view.root;
	roots = this.documents;
	res[0] = vidlib.nestVidsFromData(
		vidlib.vidsOfFlexo( VIEWS[this.name].vids, this.vids, rootName ),
		VIEWS[this.name].vids,
		removePaths( this.documents, this.idFields )
	);
	res[1] = [];



	var usedPaths = {};
	for ( i = 0; i < this.vids.length; i += 1 ) {
		if ( VIEWS[this.name].vids[this.vids[i]] && VIEWS[this.name].vids[this.vids[i]][3] !== undefined ) {
			usedPaths[ VIEWS[this.name].vids[this.vids[i]][3] ] = VIEWS[this.name].vids[this.vids[i]][2];
		}
	}

	// join paths
	var usedJoins = {};
	var paths = Object.keys( usedPaths );
	for ( i = 0; i < paths.length; i += 1 ) {
		field = usedPaths[paths[i]];

		// init nearest link
		for ( j = 0; j < roots.length; j += 1 ) {

			// выбор и разбор самых длинных путей
			var max = 0;
			chains = [];
			for ( k = 0; k < roots[j][ field ].length; k += 1 ) {
				var splt = roots[j][ field ][k].split( '_' );
				if ( splt.length > max ) {
					max = splt.length;
					chains = [];
				}
				chains.push( splt );
			}

			if ( !chains.length ) {
				// взять путь
				var path = PATHS[ paths[i] ];

				// пройтись по пути
				writeInJoin = false;
				for ( k = path.length - 1; k >= 0; k -= 1 ) {
					key = '' + path[k][0] + '|' + field;
					index = this.tasks_dict.indexOf( key );
					if ( index !== -1 ) {
						// создать пустышку
						if ( result[index].empty === undefined ) {
							cont = {};
							for ( z = 0; z < this.vids.length; z += 1 ) {
								if ( VIEWS[this.name].vids[this.vids[z]] && VIEWS[this.name].vids[this.vids[z]][0] === path[k][0] && VIEWS[this.name].vids[this.vids[z]][1] !== undefined && VIEWS[this.name].vids[this.vids[z]][2] === field ) {
									cont[this.vids[z]] = '';
								}
							}
							result[index].empty = res[1].length;
							res[1].push( cont );
						}

						// подключить пустышку
						target = ( writeInJoin === false ) ? res[0][j] : res[1][writeInJoin];
						writeInJoin = result[index].empty;

						if ( !target[VID_LINK] ) { target[VID_LINK] = []; }
						if ( target[VID_LINK].indexOf( result[index].empty ) === -1 ) {
							target[VID_LINK].push( result[index].empty );
						}
					}
				}
			}

			for ( k = 0; k < chains.length; k += 1 ) {
				var chain = chains[k];

				var writeInJoin = false;
				for ( x = chain.length - 1; x >= 0; x -= 1 ) {
					var alias = chain[x].substr( 0, 2 );
					flexo = PROVIDER_ALIAS.p2c[alias];
					key = '' + flexo + '|' + field;
					index = this.tasks_dict.indexOf( key );

					if ( index !== -1 ) {
						usedJoins[key] = true;

						var found = false;
						var resultDocs = removePaths( result[index].result, result[index].idFields );
						for ( var y = 0; y < result[index].result.length; y += 1 ) {
							if ( result[index].result[y][DOC_ID] === chain[x] ) {
								if ( result[index].result[y][VID_LINK] === undefined ) {
									// конвертация в vid
									var cont = {};
									for ( z = 0; z < this.vids.length; z += 1 ) {
										if ( VIEWS[this.name].vids[this.vids[z]] && VIEWS[this.name].vids[this.vids[z]][0] === flexo && VIEWS[this.name].vids[this.vids[z]][1] !== undefined && VIEWS[this.name].vids[this.vids[z]][2] === field ) {
											cont[this.vids[z]] = resultDocs[y][ VIEWS[this.name].vids[this.vids[z]][1] ];
										}
									}

									result[index].result[y][VID_LINK] = res[1].length;
									res[1].push( cont );
								}

								target = ( writeInJoin === false ) ? res[0][j] : res[1][writeInJoin];
								writeInJoin = result[index].result[y][VID_LINK];

								if ( !target[VID_LINK] ) { target[VID_LINK] = []; }
								if ( target[VID_LINK].indexOf( result[index].result[y][VID_LINK] ) === -1 ) {
									target[VID_LINK].push( result[index].result[y][VID_LINK] );
								}

								found = true;
								break;
							}
						}

						// связь с пустышкой
						if ( !found ) {
							// создание пустышки
							if ( result[index].empty === undefined ) {
								cont = {};
								for ( z = 0; z < this.vids.length; z += 1 ) {
									if ( VIEWS[this.name].vids[this.vids[z]] && VIEWS[this.name].vids[this.vids[z]][0] === flexo && VIEWS[this.name].vids[this.vids[z]][1] !== undefined && VIEWS[this.name].vids[this.vids[z]][2] === field ) {
										cont[this.vids[z]] = '';
									}
								}
								result[index].empty = res[1].length;
								res[1].push( cont );
							}

							target = ( writeInJoin === false ) ? res[0][j] : res[1][writeInJoin];
							writeInJoin = result[index].result[y][VID_LINK];

							if ( !target[VID_LINK] ) { target[VID_LINK] = []; }
							if ( target[VID_LINK].indexOf( result[index].empty ) === -1 ) {
								target[VID_LINK].push( result[index].empty );
							}
						}


					}
				}
			}
		}
	}


	// join free
	for ( i = 0; i < this.tasks_dict.length; i += 1 ) {
		if ( usedJoins[this.tasks_dict[i]] === undefined ) {
			flexo = this.tasks_dict[i].split( '|' )[0];
			field = this.tasks_dict[i].split( '|' )[1];
			for ( j = 0; j < roots.length; j += 1 ) {

				var ids = [];
				for ( k = 0; k < roots[j][field].length; k += 1 ) {
					ids = ids.concat( roots[j][field][k].split( '_' ) );
				}
				ids = pathlib.removeDuplicates( ids );

				// поиск джойна
				found = false;
				resultDocs = removePaths( result[i].result, result[i].idFields );
				for ( k = 0; k < result[i].result.length; k += 1 ) {
					if ( ids.indexOf( result[i].result[k][DOC_ID] ) !== -1 ) {
						if ( result[i].result[k][VID_LINK] === undefined ) {
							// конвертация в vid
							cont = {};
							for ( z = 0; z < this.vids.length; z += 1 ) {
								if ( VIEWS[this.name].vids[this.vids[z]] && VIEWS[this.name].vids[this.vids[z]][0] === flexo && VIEWS[this.name].vids[this.vids[z]][1] !== undefined && VIEWS[this.name].vids[this.vids[z]][2] === field ) {
									cont[this.vids[z]] = resultDocs[k][ VIEWS[this.name].vids[this.vids[z]][1] ];
								}
							}

							result[i].result[k][VID_LINK] = res[1].length;
							res[1].push( cont );
						}

						target = res[0][j];

						if ( !target[VID_LINK] ) { target[VID_LINK] = []; }
						if ( target[VID_LINK].indexOf( result[i].result[k][VID_LINK] ) === -1 ) {
							target[VID_LINK].push( result[i].result[k][VID_LINK] );
						}

						found = true;
					}
				}

				// связь с пустышкой
				if ( !found ) {
					// создание пустышки
					if ( result[i].empty === undefined ) {
						cont = {};
						for ( z = 0; z < this.vids.length; z += 1 ) {
							if ( VIEWS[this.name].vids[this.vids[z]] && VIEWS[this.name].vids[this.vids[z]][0] === flexo && VIEWS[this.name].vids[this.vids[z]][1] !== undefined && VIEWS[this.name].vids[this.vids[z]][2] === field ) {
								cont[this.vids[z]] = '';
							}
						}
						result[i].empty = res[1].length;
						res[1].push( cont );
					}

					target = res[0][j];

					if ( !target[VID_LINK] ) { target[VID_LINK] = []; }
					if ( target[VID_LINK].indexOf( result[i].empty ) === -1 ) {
						target[VID_LINK].push( result[i].empty );
					}
				}


			}
		}
	}


	// join aggregates
	if ( this.aggregate.length !== 0 ) {
		for ( i = 0; i < roots.length; i += 1 ) {
			for ( j = 0; j < this.aggregate.length; j += 1 ) {
				if ( roots[i][DOC_ID] === this.aggregate[j][DOC_ID] ) {
					keys = Object.keys( this.aggregate[j] );
					for ( k = 0; k < keys.length; k += 1 ) {
						if ( keys[k] !== DOC_ID ) {
							res[0][i][keys[k]] = this.aggregate[j][keys[k]];
						}
					}
				}
			}
		}
	}



	return this.callback( null, {result: res, count: this.count, dep: this.dep} );
}

function findDoc( id, data ) {
	var i;
	for ( i = 0; i < data.length; i += 1 ) {
		if ( data[i][DOC_ID] === id ) {
			return i;
		}
	}
	return -1;
}



checks.insert = argstype.getChecker( myErr, [
	['name', true, 's'],
	['vids', true, 'a', 's'],
	['request', true, 'a', 'o'],
	['access', true, 'o', [
		['company_id', true, 's'],
		['user_id', true, 's'],
		['role', true, 's']
	]],
	['callback', true, 'f']
] );
container.insert = function( name, vids, request, access, callback ) {
	log( 'View.insert:', arguments );
	var my_access;
	var insertion = [];
	var i, j, keys;
	var rootName, myVids, rootFields, documents = [];
	var errType = checks.insert( arguments );

	if ( errType ) { return next( callback, errType ); }
	if ( VIEWS[name] === undefined ) { return next( callback, myErr( 'не существует view `' + name + '`' ) ); }
	if ( VIEWS[name].view.root === undefined ) { return next( callback, myErr( 'невозможно обработать запрос данных к view без корневой flexo' ) ); }

	rootName = VIEWS[name].view.root;
	rootFields = vidlib.fieldsOfFlexo( rootName, vids, VIEWS[name].vids );
	myVids = vidlib.vidsOfFlexo( VIEWS[name].vids, vids, rootName );

	// вставка принадлежности к пользователю/компании
	if ( VIEWS[name].view.access && VIEWS[name].view.access.insert ) {
		my_access = VIEWS[name].view.access.insert[access.role] || VIEWS[name].view.access.insert[ACCESS_ALL] || {data: {}};

		keys = Object.keys( my_access.data );
		for ( i = 0; i < keys.length; i += 1 ) {
			if ( my_access.data[keys[i]] === REPLACE_USER_ID || my_access.data[keys[i]] === REPLACE_COMPANY_ID ) {
				insertion.push( [
					my_access.lazy || false, // lazy
					keys[i], // key
					my_access.data[keys[i]].replace( REPLACE_USER_ID, access.user_id ).replace( REPLACE_COMPANY_ID, access.company_id ) // value
				] );
			}
		}
	}

	for ( i = 0; i < request.length; i += 1 ) {
		documents[i] = {};
		keys = Object.keys( request[i] );
		for ( j = 0; j < keys.length; j += 1 ) {
			if ( VIEWS[name].vids[ keys[j] ][0] === rootName ) {
				documents[i][ VIEWS[name].vids[ keys[j] ][1] ] = request[i][ keys[j] ];
			}
		}
		for ( j = 0; j < insertion.length; j += 1 ) {
			if ( !insertion[j][0] || (insertion[j][0] && documents[i][ insertion[j][1] ] === undefined) ) {
				documents[i][ insertion[j][1] ] = [ insertion[j][2] ];
			}
		}
	}

	return PROVIDER.insert( {name: rootName, fields: rootFields, query: documents, options: {}}, insertCallback.bind( {name: name, vids: myVids, callback: callback} ) );
};

function insertCallback( err, data ) {
	// this.name
	// this.vids
	// this.callback
	var documents;
	if ( err ) { return this.callback( err ); }

	documents = removePaths( data.result, data.idFields );
	documents = vidlib.nestVidsFromData( this.vids, VIEWS[this.name].vids, documents );

	return this.callback( null, documents );
}

function removePaths( docs, idFields ) {
	var i, j, k, tmp, rem, fields = [], out = [];
	if ( docs.length ) {
		fields = Object.keys( docs[0] );
	}

	for ( i = 0; i < docs.length; i += 1 ) {
		out[i] = {};
	}

	for ( i = 0; i < fields.length; i += 1 ) {
		rem = ( idFields.indexOf( fields[i] ) !== -1 );
		for ( j = 0; j < docs.length; j += 1 ) {
			if ( rem ) {
				tmp = [];
				for ( k = 0; k < docs[j][ fields[i] ].length; k += 1 ) {
					if ( docs[j][ fields[i] ][k].split( '_', 2 ).length === 1 ) {
						tmp.push( docs[j][ fields[i] ][k] );
					}
				}
				out[j][ fields[i] ] = tmp;
			} else {
				out[j][ fields[i] ] = docs[j][ fields[i] ];
			}
		}
	}
	return out;
}



checks.modify = argstype.getChecker( myErr, [
	['name', true, 's'],
	['request', true, 'a', [
		'*', true, 'o', [
			['selector', true, 'o'],
			['properties', true, 'o']
		]
	]],
	['access', true, 'o', [
		['company_id', true, 's'],
		['user_id', true, 's'],
		['role', true, 's']
	]],
	['callback', true, 'f']
] );
container.modify = function( name, request, access, callback ) {
	log( 'View.modify:', arguments );
	var errType = checks.modify( arguments );
	var rootName, flexoQuery;
	var vid_id, vid_update;
	var i, j, keys;

	if ( errType ) { return next( callback, errType ); }
	if ( VIEWS[name] === undefined ) { return next( callback, myErr( 'не существует view `' + name + '`' ) ); }
	if ( VIEWS[name].view.root === undefined ) { return next( callback, myErr( 'невозможно обработать запрос данных к view без корневой flexo' ) ); }

	rootName = VIEWS[ name ].view.root;
	flexoQuery = [];

	keys = Object.keys( request[0].selector );
	vid_id = vidlib.vidByProp( DOC_ID, keys, VIEWS[name].vids );
	vid_update = vidlib.vidByProp( DOC_UPDATE, keys, VIEWS[name].vids );

	if ( !vid_id || !vid_update ) {
		return next( callback, myErr( 'request.0 - vids with `_id` and `tsUpdate` required' ) );
	}

	for ( i = 0; i < request.length; i += 1 ) {
		flexoQuery[i] = {
			selector: {},
			properties: {}
		};

		flexoQuery[i].selector[DOC_ID] = request[i].selector[vid_id];
		flexoQuery[i].selector[DOC_UPDATE] = request[i].selector[vid_update];

		keys = Object.keys( request[i].properties );
		for ( j = 0; j < keys.length; j += 1 ) {
			if ( VIEWS[ name ].vids[ keys[j] ] && VIEWS[ name ].vids[ keys[j] ][0] === rootName ) {
				flexoQuery[i].properties[ VIEWS[ name ].vids[ keys[j] ][1] ] = request[i].properties[ keys[j] ];
			}
		}
	}

	return PROVIDER.modify( {name: rootName, query: flexoQuery, options: {}}, modifyCallback.bind( { name: name, vids: [vid_id, vid_update], callback: callback} ) );
};

function modifyCallback( err, data ) {
	// this.view
	// this.vids
	// this.callback
	var documents;

	if ( err ) { return this.callback( err ); }

	documents = vidlib.nestVidsFromData( this.vids, VIEWS[this.name].vids, data );

	return this.callback( null, documents );
}



checks.delete = argstype.getChecker( myErr, [
	['name', true, 's'],
	['request', true, 'a', [
		['*', true, 'o']
	]],
	['access', true, 'o', [
		['company_id', true, 's'],
		['user_id', true, 's'],
		['role', true, 's']
	]],
	['callback', true, 'f']
] );
container.delete = function( name, request, access, callback ) {
	log( 'View.delete:', arguments );
	var vid_id, vid_update;
	var errType = checks.delete( arguments );
	var rootName, flexoQuery;
	var i, keys;

	if ( errType ) { return next( callback, errType ); }
	if ( VIEWS[name] === undefined ) { return next( callback, myErr( 'не существует view `' + name + '`' ) ); }
	if ( VIEWS[name].view.root === undefined ) { return next( callback, myErr( 'невозможно обработать запрос данных к view без корневой flexo' ) ); }

	rootName = VIEWS[ name ].view.root;
	flexoQuery = [];

	keys = Object.keys( request[0] );
	vid_id = vidlib.vidByProp( DOC_ID, keys, VIEWS[name].vids );
	vid_update = vidlib.vidByProp( DOC_UPDATE, keys, VIEWS[name].vids );

	if ( !vid_id || !vid_update ) {
		return next( callback, myErr( 'request.0 - необходимо указать значения `_id` и `tsUpdate` в виде `vid`' ) );
	}

	for ( i = 0; i < request.length; i += 1 ) {
		flexoQuery[i] = {};

		flexoQuery[i][DOC_ID] = request[i][vid_id];
		flexoQuery[i][DOC_UPDATE] = request[i][vid_update];
	}

	return PROVIDER.delete( {name: rootName, query: flexoQuery, options: {}}, deleteCallback.bind( { view: name, vids: [ vid_id ], callback: callback } ) );
};

function deleteCallback( err, data ) {
	// this.view
	// this.vids
	// this.callback
	var documents;

	if ( err ) {
		return this.callback( err );
	}

	documents = vidlib.nestVidsFromData( this.vids, VIEWS[this.view].vids, data );

	return this.callback( null, documents );
}



function selectorObjectToArray( selector ) {
	var i, j, keys, node;
	var res = [];
	var queue = [];

	queue.push( {elem: selector, out: res} );
	while ( queue.length > 0 ) {
		node = queue.shift();

		keys = Object.keys( node.elem );

		for ( i = 0; i < keys.length; i += 1 ) {
			// key
			if ( keys[i] !== '*' ) {
				if ( keys[i] === '$elemMatch' ) {
					node.out.push( '$em' );
				} else {
					node.out.push( keys[i] );
				}
			}

			// value
			if ( keys[i] === '$in' ) {
				for ( j = 0; j < node.elem[keys[i]].length; j += 1 ) {
					node.out.push( node.elem[keys[i]][j] );
				}
				continue;
			}

			if ( Array.isArray( node.elem[keys[i]] ) ) {
				node.out.push( [] );
				for ( j = 0; j < node.elem[keys[i]].length; j += 1 ) {
					queue.push( { elem: {'*': node.elem[keys[i]][j]}, out: node.out[node.out.length - 1]} );
				}
			} else if ( typeof node.elem[keys[i]] === 'object' ) {
				node.out.push( [] );
				queue.push( { elem: node.elem[keys[i]], out: node.out[node.out.length - 1]} );
			} else {
				node.out.push( node.elem[keys[i]] );
			}
		}
	}

	return res;
}



checks.init = argstype.getChecker( myErr, [
	['options', true, 'o', [
		['provider', true, 'o', [
			['find', true, 'f'],
			['aggregate', true, 'f'],
			['insert', true, 'f'],
			['modify', true, 'f'],
			['delete', true, 'f']
		]],
		['providerAlias', true, 'o', [
			['c2p', true, 'o', [
				'*', false, 's'
			]],
			['c2p', true, 'o', [
				'*', false, 's'
			]]
		]],
		['views', true, 'o', [
			'*', false, 'o', [
				['view', true, 'o', [
					['name', true, 's'],
					['template', false, 's'],
					['config', true, 'o'],
					['root', false, 's'],
					['join', false, 'o', [
						'*', false, 'o'
					]],
					['aggregate', false, 'o', [
						'*', false, 'o', [
							['flexo', true, 's'],
							['link', true, 'o']
						]
					]],
					['access', false, 'o', [
						['find', false, 'o', [
							'*', false, 'o'
						]],
						['insert', false, 'o', [
							'*', false, 'o', [
								['data', true, 'o'],
								['lazy', false, 'b']
							]
						]]
					]]
				]],
				['vids', true, 'o', [
					'*', false, 'a', [
						['flexo', true, 's'], // название схемы flexo
						['property', true, 's'], // название поля, к которому осуществляется доступ
						['field', false, 's'], // название поля, по которому осуществляется связь
						['path', false, 's']
					]
				]],
				['aggr', true, 'o', [
					'*', false, 'o', [
						['name', true, 's'],
						['group', false, 'o'],
						['selector', false, 's']
					]
				]]
			]
		]],
		['paths', true, 'o', [
			'*', false, 'a', [
				'*', true, 'a', [
					['flexo', true, 's'],
					['depend_field', true, 's']
				]
			]
		]],
		['templatePath', true, 's'],
		['templateTimeout', false, 'n']
	]],
	['callback', true, 'f']
] );
function init( options, callback ) {
	var errType = checks.init( arguments );

	if ( errType ) { return next( callback, errType ); }
	if ( INITIALIZED ) { return next( callback, myErr( 'повторная инициализация запрещена' ) ); }

	PROVIDER = options.provider;
	PROVIDER_ALIAS = options.providerAlias;
	VIEWS = options.views;
	PATHS = options.paths;
	SETTINGS.templatePath = options.templatePath;
	if ( SETTINGS.templatePath[SETTINGS.templatePath.length - 1] !== '/' ) {
		SETTINGS.templatePath += '/';
	}
	if ( options.templateTimeout !== undefined ) {
		SETTINGS.templateTimeout = options.templateTimeout;
	}

	try {
		SLICER = configSlicer.getSlicer( SETTINGS.configSlicer );
	} catch ( e ) {
		return next( callback, e );
	}

	INITIALIZED = true;
	return next( callback, null, container );
}



module.exports = {
	init: init
};
