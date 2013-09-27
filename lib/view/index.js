'use strict';

var fs = require( 'fs' );
var dot = require( 'dot' );
var async = require( 'async' );
var argstype = require( 'f0.argstype' );
var configSlicer = require( './config-slicer' );
var vidlib = require( './vid-lib' );
var pathlib = require( './path' );



var log = function() {};
if ( process.env.DEBUG ) {
	log = console.log;
}



var container = {};
var INITIALIZED;
var PROVIDER;
var SLICER;
var VIEWS;
var PATHS;
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
	var errType = checks.getTemplate( arguments );
	var template, res;

	if ( errType ) {
		return next( callback, errType );
	}

	if ( VIEWS[name] === undefined ) {
		return next( callback, myErr( 'не существует view `' + name + '`' ) );
	}

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
	['options', true, 'o', [
		['insert_user_id', true, 'b'],
		['user_id', true, 's'],
		['role', true, 's']
	]],
	['callback', true, 'f']
] );
container.find = function( name, vids, request, options, callback ) {
	var errType = checks.find( arguments );
	var rootName, requestOptions;
	var i, j, requestGroups, keys, key;
	var rootSelector, joinSelector, rootFields;
	var flexo, prop, field, path, paths = {};
	var tasks = {};

	if ( errType ) {
		return next( callback, errType );
	}

	if ( VIEWS[name] === undefined ) {
		return next( callback, myErr( 'не существует view `' + name + '`' ) );
	}

	if ( VIEWS[name].view.root === undefined ) {
		return next( callback, myErr( 'невозможно обработать запрос данных к view без корневой flexo' ) );
	}

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
						selector: []
					};
					paths[key] = PATHS[path];
				}

				// join selector
				joinSelector[key].selector.push( prop );
				joinSelector[key].selector.push( request.selector[ requestGroups[i] ][ keys[j] ] ); // TODO: parse inner structure of property
			}
		}
	}

	// add fields badly
	for ( i = 0; i < vids.length; i += 1 ) {
		path = VIEWS[ name ].vids[ vids[i] ];

		if ( path && path[0] !== rootName ) {
			// add fields
			if ( rootFields.indexOf( DOC_PATH ) === -1 ) {
				rootFields.push( DOC_PATH );
			}
			if ( rootFields.indexOf( path[2] ) === -1 ) {
				rootFields.push( path[2] );
			}
		}
	}



	// сборка заданий для сужения по джойнам
	keys = Object.keys( joinSelector );
	for ( i = 0; i < keys.length; i += 1 ) {
		// здесь надо сделать запросы к видимым/невидимым джойнам чтобы собрать шринк
		tasks[keys[i]] = PROVIDER.find.bind( PROVIDER, joinSelector[keys[i]].flexo, [DOC_ID], {selector: joinSelector[ keys[i] ].selector, options: {}}, {} );
	}



	// запуск шринков асинком
	return async.parallel( tasks, findShrinksCallback.bind( { name: name, request: request, rootSelector: rootSelector, rootFields: rootFields, requestOptions: requestOptions, vids: vids, options: options, paths: paths, callback: callback } ) );
};

function findShrinksCallback( err, result ) {
	var i, j, keys, path, names, subkeys;
	var pathFlexo;
	var ids, request_in;
	var request = {};
	var totalRequest = [];
	var pathRootPos, pathJoinPos;
	var rootName, usePath;

	if ( err ) {
		return this.callback( err );
	}

	rootName = VIEWS[this.name].view.root;



	// сборка шринков
	keys = Object.keys( result );
	for ( i = 0; i < keys.length; i += 1 ) {
		ids = [ '$in' ];
		for ( j = 0; j < result[keys[i]].length; j += 1 ) {
			ids.push( result[keys[i]][j][DOC_ID] );
		}

		path = PATHS[ this.paths[ keys[i] ] ];
		names = keys[i].split( '|' ); // flexo|depend_field

		pathRootPos = path.length;
		pathJoinPos = 0;
		for ( j = 0; j < path.length; j += 1 ) {
			if ( path[j][0] === rootName ) {
				pathRootPos = j;
			}
			if ( path[j][0] === names[0] ) {
				pathJoinPos = j;
			}
		}

		if ( pathRootPos - pathJoinPos > 1 ) {
			usePath = true;

			if ( !request.$and ) { request.$and = []; }
			pathFlexo = path[pathJoinPos + 1][0];

			request.$and.push( [ DOC_PATH, [ '$em', [ 'c', path[pathJoinPos + 1][0], 'f', names[1], 'o', ids ]]] );
		} else {
			if ( !request[ names[1] ] ) {
				request[ names[1] ] = [ names[1], ids ];
			} else {
				request_in = request[ names[1] ][1];

				// find common ids
				for ( j = request_in.length - 1; i > 0; i -= 1 ) { // except zero element with '$in'
					if ( ids.indexOf( request_in[j], 1 ) === -1 ) {
						request_in.splice( j, 1 );
					}
				}

				if ( request_in.length === 1 ) { // no documents
					return this.callback( null, [], 0 );
				}
			}
		}
	}



	// пересечение шринков с rootSelector
	keys = Object.keys( request );
	for ( i = 0; i < keys.length; i += 1 ) {
		if ( this.rootSelector[ keys[i] ] !== undefined ) {
			// FIX: support only '$in' request and request by value

			// make an array
			if ( !Array.isArray( this.rootSelector[ keys[i] ] ) && typeof this.rootSelector[ keys[i] ] === 'object' && this.rootSelector[ keys[i] ].$in !== undefined ) {
				// from array of ids
				this.rootSelector[ keys[i] ] = [ '$in', this.rootSelector[ keys[i] ].$in ];
			} else {
				// from value of id
				this.rootSelector[ keys[i] ] = [ '$in', [ this.rootSelector[ keys[i] ] ] ];
			}

			// find common
			for ( j = this.rootSelector[ keys[i] ][1].length - 1; j > 0; j -= 1 ) { // except zero element with '$in'
				if ( request[ keys[i] ][1].indexOf( this.rootSelector[ keys[i] ][1][j], 1 ) === -1 ) {
					this.rootSelector[ keys[i] ][1].splice( j, 1 );
				}
			}

			if ( this.rootSelector[ keys[i] ][1].length === 1 ) { // no documents
				return this.callback( null, [], 0 );
			}
		} else {
			this.rootSelector[ keys[i] ] = request[ keys[i] ];
		}
	}



	// сборка запроса-массива
	keys = Object.keys( this.rootSelector );
	for ( i = 0; i < keys.length; i += 1 ) {
		totalRequest.push( keys[i] ); // push name

		// push value
		if ( !Array.isArray( this.rootSelector[ keys[i] ] ) && typeof this.rootSelector[ keys[i] ] === 'object' ) {
			// FIX: only one level deep supported
			totalRequest.push( [] );
			subkeys = Object.keys( this.rootSelector[ keys[i] ] );
			for ( j = 0; j < subkeys.length; j += 1 ) {
				totalRequest[totalRequest.length - 1].push( subkeys[j] );
				totalRequest[totalRequest.length - 1].push( this.rootSelector[ keys[i] ][ subkeys[j] ] );
			}
		} else {
			totalRequest.push( this.rootSelector[ keys[i] ] );
		}
	}



	// сборка параметров сортировки
	if ( this.requestOptions.sort ) {
		var sort = this.requestOptions.sort;
		var sortOut = {};

		keys = Object.keys( sort );
		for ( i = 0; i < keys.length; i += 1 ) {
			if ( VIEWS[this.name].vids[keys[i]] === undefined ) { continue; }
			if ( VIEWS[this.name].vids[keys[i]][0] === undefined ) { continue; }
			if ( VIEWS[this.name].vids[keys[i]][1] === undefined ) { continue; }
			if ( VIEWS[this.name].vids[keys[i]][0] !== rootName ) { continue; }
			sortOut.push( [ VIEWS[this.name].vids[sort[i]][1], sort[keys[i]] ] );
		}

		this.requestOptions.sort = sortOut;
	}



	// теперь можно запрашивать документы
	// запрос с шринком и полями для джойнов
	return PROVIDER.find( rootName, this.rootFields, {selector: totalRequest, options: this.requestOptions}, this.requestOptions, findRootCallback.bind( this ) );
}

function findRootCallback( err, results, count ) {
	if ( err ) {
		return this.callback( err );
	}

	if ( results.length === 0 ) {
		return this.callback( null, [], count );
	}

	this.count = count;
	this.documents = [];
	this.documents[0] = results;

	var taskContainer = {};

	// gather grouping
	for ( var i = 0; i < this.vids.length; i += 1 ) {
		if ( VIEWS[ this.name ].aggr[ this.vids[i] ] !== undefined ) {
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
		var link_subkeys = (link_key === DOC_PATH) ? Object.keys( link[link_key] ) : [];

		for ( var j = 0; j < results.length; j += 1 ) {
			var coll = VIEWS[this.name].view.aggregate[keys[i]].flexo;
			var match = {};

			// make match
			for ( var k = 0; k < match_keys.length; k += 1 ) {
				match[match_keys[k]] = task.match[match_keys[k]];
			}
			if ( link_key === DOC_PATH ) {
				match[link_key] = {};
				for ( k = 0; k < link_subkeys.length; k += 1 ) {
					match[link_key][link_subkeys[k]] = link[link_key][link_subkeys[k]];
					if ( link[link_key][link_subkeys[k]] === AGGREGATE_ID ) {
						match[link_key][link_subkeys[k]] = results[j][DOC_ID];
					}
				}
			} else {
				match[link_key] = results[j][DOC_ID];
			}

			// make group
			var group = {};
			for ( k = 0; k < group_keys.length; k += 1 ) {
				group[group_keys[k]] = task.group[group_keys[k]];
			}
			group[DOC_ID] = results[j][DOC_ID];

			tasks.push( PROVIDER.aggregate.bind( PROVIDER, coll, match, group ) );
		}
	}

	return async.parallel( tasks, findAggregateCallback.bind( this ) );
}

function findAggregateCallback( err, results ) {
	// this.name
	// this.vids
	// this.request
	// this.options
	// this.callback
	var elem;
	var ids;
	var k, z;
	var rootName;
	var i, j;
	var flexo, prop, field, path, pathRootPos, pathJoinPos;
	var joinProps, tasks = {};
	if ( err ) {
		return this.callback( err );
	}



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
		if ( VIEWS[ this.name ].vids[ this.vids[i] ] === undefined ) {
			continue;
		}

		flexo = VIEWS[ this.name ].vids[ this.vids[i] ][0];
		prop = VIEWS[ this.name ].vids[ this.vids[i] ][1];
		field = VIEWS[ this.name ].vids[ this.vids[i] ][2];
		path = VIEWS[ this.name ].vids[ this.vids[i] ][3];

		if ( flexo !== rootName ) {
			if ( !joinProps[flexo] ) { joinProps[flexo] = {}; }
			if ( !joinProps[flexo][field] ) {
				joinProps[flexo][field] = {
					flexo: flexo,
					view: this.name,
					field: field,
					fields: [],
					vids: [],
					documents: this.documents,
					pathFlexo: undefined
				};

				if ( path !== undefined ) {
					path = PATHS[path];

					pathRootPos = path.length;
					pathJoinPos = undefined;
					for ( j = 0; j < path.length; j += 1 ) {
						if ( path[j][0] === rootName ) {
							pathRootPos = j;
						}
						if ( path[j][0] === flexo ) {
							pathJoinPos = j;
						}
					}

					if ( pathRootPos > pathJoinPos + 1 ) {
						joinProps[flexo][field].pathFlexo = path[pathJoinPos + 1][0];
					}
				}
			}

			// vids per join
			joinProps[flexo][field].vids.push( this.vids[i] );

			// fields per join
			if ( joinProps[flexo][field].fields.indexOf( prop ) === -1 ) {
				joinProps[flexo][field].fields.push( prop );
			}
		}
	}

	flexo = Object.keys( joinProps );
	for ( i = 0; i < flexo.length; i += 1 ) {
		field = Object.keys( joinProps[flexo[i]] );
		for ( j = 0; j < field.length; j += 1 ) {
			elem = joinProps[ flexo[i] ][ field[j] ];

			ids = ['$in'];

			// create selector
			if ( elem.pathFlexo === undefined ) {
				for ( k = 0; k < this.documents[0].length; k += 1 ) {
					ids = ids.concat( this.documents[0][k][elem.field] );
				}
			} else {
				for ( k = 0; k < this.documents[0].length; k += 1 ) {
					ids = ids.concat( pathlib.findInPathO( this.documents[0][k][DOC_PATH], elem.pathFlexo, elem.field ) );
				}
			}

			ids = pathlib.removeDuplicates( ids );

			tasks[ (elem.flexo + '|' + elem.field)] = PROVIDER.find.bind( PROVIDER, elem.flexo, elem.fields, {selector: [ DOC_ID, ids ]}, {} );
		}
	}

	// run tasks with async
	return async.parallel( tasks, findJoinsCallback.bind( this ) );
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
	var allPaths;
	var docPath;
	var nice;
	var pathField;
	var old_ids, new_ids;
	var pathPosition;
	var resultPosition;
	var path, field, coll, link;
	var usedPaths;
	var rootName, vids, usedJoins;
	var i, j, k, x, keys, key;
	if ( err ) {
		return this.callback( err );
	}

	rootName = VIEWS[this.name].view.root;



	// TODO: check if starter may provide dependent fields
	// get used paths and dependent fields
	usedPaths = [];
	pathField = {};
	for ( i = 0; i < this.vids.length; i += 1 ) {
		if ( VIEWS[this.name].vids[this.vids[i]] && VIEWS[this.name].vids[this.vids[i]][3] !== undefined ) {
			usedPaths.push( VIEWS[this.name].vids[this.vids[i]][3] );
			pathField[ VIEWS[this.name].vids[this.vids[i]][3] ] = VIEWS[this.name].vids[this.vids[i]][2];
		}
	}
	usedPaths = pathlib.removeDuplicates( usedPaths );


	allPaths = [];
	for ( i = 0; i < this.documents[0].length; i += 1 ) {
		if ( this.documents[0][i][DOC_PATH] !== undefined ) {
			for ( j = 0; j < this.documents[0][i][DOC_PATH].length; j += 1 ) {
				nice = true;
				docPath = this.documents[0][i][DOC_PATH][j];

				for ( k = 0; k < allPaths.length; k += 1 ) {
					if ( allPaths[k].c === docPath.c && allPaths[k].f === docPath.f && allPaths[k].i === docPath.i && allPaths[k].o === docPath.o ) {
						nice = false;
						break;
					}
				}

				if ( nice ) {
					allPaths.push( docPath );
				}
			}
		}
	}


	var roots = this.documents[0];

	// pack into array of arrays with links between
	// iter over present paths
	// join path joins
	usedJoins = [];
	for ( i = 0; i < usedPaths.length; i += 1 ) {
		field = pathField[usedPaths[i]];
		path = PATHS[usedPaths[i]];

		resultPosition = 0; // position of block to write into
		pathPosition = findPathPos( rootName, path );

		// gather starting ids
		old_ids = [];
		for ( j = 0; j < roots.length; j += 1 ) {
			old_ids[j] = Array.isArray( roots[j][field] ) ? roots[j][field] : [ roots[j][field] ];
		}

		for ( j = pathPosition - 1; j >= 0; j -= 1 ) {
			coll = path[j][0];
			key = coll + '|' + field;

			if ( result[ key ] === undefined ) {
				// gather required ids
				new_ids = [];
				for ( k = 0; k < old_ids.length; k += 1 ) {
					new_ids[k] = [];
					for ( x = 0; x < old_ids[k].length; x += 1 ) {
						new_ids[k] = new_ids[k].concat( pathlib.findInPathOByI( allPaths, coll, field, old_ids[k][x] ) );
					}
					new_ids[k] = pathlib.removeDuplicates( new_ids[k] );
				}
			} else {
				usedJoins.push( key );
				// join
				for ( k = 0; k < this.documents[resultPosition].length; k += 1 ) {
					if ( this.documents[resultPosition][k][VID_LINK] === undefined ) {
						this.documents[resultPosition][k][VID_LINK] = {};
					}

					link = this.documents[resultPosition][k][VID_LINK][this.documents.length] = [];
					for ( x = 0; x < old_ids[k].length; x += 1 ) {
						link.push( findDoc( old_ids[k][x], result[key][0] ) );
					}
				}

				resultPosition = this.documents.length;

				// add translated result array
				vids = vidlib.vidsOfFlexo( VIEWS[this.name].vids, this.vids, coll, field );
				this.documents.push( vidlib.nestVidsFromData( vids, VIEWS[this.name].vids, result[key][0] ) );

				// make new old_ids
				new_ids = [];
				for ( k = 0; k < result[key][0].length; k += 1 ) {
					new_ids.push( pathlib.findInPathOByI( allPaths, coll, field, result[key][0][k][DOC_ID] ) );
				}
			}

			old_ids = new_ids;
		}
	}



	// join free joins
	keys = Object.keys( result );
	for ( i = 0; i < keys.length; i += 1 ) {
		if ( usedJoins.indexOf( keys[i] ) !== -1 ) { continue; }

		coll = keys[i].split( '|' )[0];
		field = keys[i].split( '|' )[1];

		for ( j = 0; j < roots.length; j += 1 ) {
			if ( roots[j][VID_LINK] === undefined ) {
				roots[j][VID_LINK] = {};
			}

			link = roots[j][VID_LINK][this.documents.length] = [];

			old_ids = Array.isArray( roots[j][field] ) ? roots[j][field] : [ roots[j][field] ];
			for ( k = 0; k < old_ids.length; k += 1 ) {
				link.push( findDoc( old_ids[k], result[keys[i]][0] ) );
			}
		}

		resultPosition = this.documents.length;
		vids = vidlib.vidsOfFlexo( VIEWS[this.name].vids, this.vids, coll, field );
		this.documents.push( vidlib.nestVidsFromData( vids, VIEWS[this.name].vids, result[keys[i]][0] ) );
	}



	// join aggregates
	resultPosition = this.documents.length;
	if ( this.aggregate.length !== 0 ) {
		this.documents.push( this.aggregate );
		var aggr = this.documents[resultPosition];
		for ( i = 0; i < aggr.length; i += 1 ) {
			for ( j = 0; j < roots.length; j += 1 ) {
				if ( roots[j][DOC_ID] === aggr[i][DOC_ID] ) {
					if ( roots[j][VID_LINK][resultPosition] === undefined ) {
						roots[j][VID_LINK][resultPosition] = [];
					}
					// link
					roots[j][VID_LINK][resultPosition].push( i );
					// clean aggregation
					delete aggr[i][DOC_ID];
					break;
				}
			}
		}
	}



	// translate documents into vids + _link
	var rootVids = vidlib.vidsOfFlexo( VIEWS[this.name].vids, this.vids, rootName );
	this.documents[0] = vidlib.nestVidsFromData( rootVids, VIEWS[this.name].vids, roots );



	return this.callback( null, this.documents, this.count );
}

function findPathPos( collection, path ) {
	var i;
	for ( i = 0; i < path.length; i += 1 ) {
		if ( path[i][0] === collection ) {
			return i;
		}
	}

	return path.length;
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
	['options', true, 'o', [
		['insert_user_id', true, 'b'],
		['user_id', true, 's'],
		['role', true, 's']
	]],
	['callback', true, 'f']
] );
container.insert = function( name, vids, request, options, callback ) {
	var i, j, keys;
	var rootName, myVids, rootFields, documents = [];
	var errType = checks.insert( arguments );

	if ( errType ) {
		return next( callback, errType );
	}

	if ( VIEWS[name] === undefined ) {
		return next( callback, myErr( 'не существует view `' + name + '`' ) );
	}

	if ( VIEWS[name].view.root === undefined ) {
		return next( callback, myErr( 'невозможно обработать запрос данных к view без корневой flexo' ) );
	}

	rootName = VIEWS[name].view.root;
	rootFields = vidlib.fieldsOfFlexo( rootName, vids, VIEWS[name].vids );
	myVids = vidlib.vidsOfFlexo( VIEWS[name].vids, vids, rootName );

	for ( i = 0; i < request.length; i += 1 ) {
		documents[i] = {};
		keys = Object.keys( request[i] );
		for ( j = 0; j < keys.length; j += 1 ) {
			if ( VIEWS[name].vids[ keys[j] ][0] === rootName ) {
				documents[i][ VIEWS[name].vids[ keys[j] ][1] ] = request[i][ keys[j] ];
			}
		}
	}

	return PROVIDER.insert( rootName, rootFields, documents, {}, insertCallback.bind( {name: name, vids: myVids, callback: callback} ) );
};

function insertCallback( err, results ) {
	// this.name
	// this.vids
	// this.callback
	var documents;
	if ( err ) {
		return this.callback( err );
	}

	documents = vidlib.nestVidsFromData( this.vids, VIEWS[this.name].vids, results );

	return this.callback( null, documents );
}



checks.modify = argstype.getChecker( myErr, [
	['name', true, 's'],
	['request', true, 'a', [
		'*', true, 'o', [
			['selector', true, 'o'],
			['properties', true, 'o']
		]
	]],
	['options', true, 'o', [
		['insert_user_id', true, 'b'],
		['user_id', true, 's'],
		['role', true, 's']
	]],
	['callback', true, 'f']
] );
container.modify = function( name, request, options, callback ) {
	var errType = checks.modify( arguments );
	var rootName, flexoQuery;
	var vid_id, vid_update;
	var i, j, keys;

	if ( errType ) {
		return next( callback, errType );
	}

	if ( VIEWS[name] === undefined ) {
		return next( callback, myErr( 'не существует view `' + name + '`' ) );
	}

	if ( VIEWS[name].view.root === undefined ) {
		return next( callback, myErr( 'невозможно обработать запрос данных к view без корневой flexo' ) );
	}

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

	return PROVIDER.modify( rootName, flexoQuery, options, modifyCallback.bind( { view: name, vids: [vid_id, vid_update], callback: callback} ) );
};

function modifyCallback( err, data ) {
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



checks.delete = argstype.getChecker( myErr, [
	['name', true, 's'],
	['request', true, 'a', [
		['*', true, 'o']
	]],
	['options', true, 'o', [
		['insert_user_id', true, 'b'],
		['user_id', true, 's'],
		['role', true, 's']
	]],
	['callback', true, 'f']
] );
container.delete = function( name, request, options, callback ) {
	var vid_id, vid_update;
	var errType = checks.delete( arguments );
	var rootName, flexoQuery;
	var i, keys;

	if ( errType ) {
		return next( callback, errType );
	}

	if ( VIEWS[name] === undefined ) {
		return next( callback, myErr( 'не существует view `' + name + '`' ) );
	}

	if ( VIEWS[name].view.root === undefined ) {
		return next( callback, myErr( 'невозможно обработать запрос данных к view без корневой flexo' ) );
	}

	rootName = VIEWS[ name ].view.root;
	flexoQuery = [];

	keys = Object.keys( request[0] );
	vid_id = vidlib.vidByProp( DOC_ID, keys, VIEWS[name].vids );
	vid_update = vidlib.vidByProp( DOC_UPDATE, keys, VIEWS[name].vids );

	if ( !vid_id || !vid_update ) {
		return next( callback, myErr( 'request.0 - необходимо указать значения `_id` и `tsUpdate` в виде `vid`' ) );
	}

	for ( i = 0; i < request.length; i += 1 ) {
		flexoQuery[i] = {
			selector: {}
		};

		flexoQuery[i].selector[DOC_ID] = request[i][vid_id];
		flexoQuery[i].selector[DOC_UPDATE] = request[i][vid_update];
	}

	return PROVIDER.delete( rootName, flexoQuery, options, deleteCallback.bind( { view: name, vids: [ vid_id ], callback: callback } ) );
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



checks.init = argstype.getChecker( myErr, [
	['options', true, 'o', [
		['provider', true, 'o', [
			['find', true, 'f'],
			['aggregate', true, 'f'],
			['insert', true, 'f'],
			['modify', true, 'f'],
			['delete', true, 'f']
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

	if ( errType ) {
		return next( callback, errType );
	}

	if ( INITIALIZED ) {
		return next( callback, myErr( 'повторная инициализация запрещена' ) );
	}

	PROVIDER = options.provider;
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
