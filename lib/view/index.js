'use strict';

var fs = require( 'fs' );
var dot = require( 'dot' );
var async = require( 'async' );



var log = process.env.DEBUG ? console.log : function() {};



var methodMap, findTask;
var SETTINGS = {
	ok: false,

	views: {},
	viewNames: [],

	templatePath: '',
	templateTimeout: 60 * 60 * 1000, // 1 hour in ms
	templates: {}, // object of [template, timestamp]
	templateNames: []
};



function GetTemplate( name, access, options, callback ) {
	var arg, template, config;
	if ( !SETTINGS.ok ) { throw new Error( 'View initialization required' ); }

	if ( SETTINGS.viewNames.indexOf( name ) === -1 ) {
		callback( new Error( 'There\'s no template' + name ) );
		return;
	}

	arg = { access: access, options: options };

	try {
		template = loadTemplate( name )( arg );
		config = SETTINGS.views[name].config ? SETTINGS.views[name].config( arg ) : {};
	} catch ( e ) {
		callback( e );
		return;
	}

	callback( null, template, config );
}

function loadTemplate( name ) {
	var now = Date.now();
	var min = now - SETTINGS.templateTimeout;
	var i, template;

	if ( !SETTINGS.ok ) { throw new Error( 'View initialization required' ); }
	if ( !SETTINGS.views[name].template ) { throw new Error( 'No template in view file' ); }

	// loop back search
	for ( i = SETTINGS.templateNames.length - 1; i >= 0; i -= 1 ) {
		// find template
		if ( SETTINGS.templateNames[i] === name ) {
			template = SETTINGS.templates[SETTINGS.templateNames[i]][0];
			SETTINGS.templates[SETTINGS.templateNames[i]][1] = now;
			continue;
		}

		// remove old
		if ( SETTINGS.templates[SETTINGS.templateNames[i]][1] < min ) {
			delete SETTINGS.templates[SETTINGS.templateNames[i]];
			SETTINGS.templateNames.splice( i, 1 );
		}
	}

	// load template
	if ( !template ) {
		template = dot.template( fs.readFileSync( SETTINGS.templatePath + SETTINGS.views[name].template, {encoding: 'utf8'} ) );
		SETTINGS.templateNames.push( name );
		SETTINGS.templates[name] = [ template, now ];
	}

	return template;
}



function ProcessRequest( name, method, request, flexes, fields, options, callback ) {
	if ( !SETTINGS.ok ) { throw new Error( 'View initialization required' ); }

	if ( SETTINGS.viewNames.indexOf( name ) === -1 ) {
		callback( new Error( 'There\'s no view ' + name ) );
		return;
	}

	methodMap[method]( name, request, flexes, fields, options, callback );
}

methodMap = {
	'find': function( name, request, flexes, fields, options, callback ) {
		var view = SETTINGS.views[name];
		var rootName, node, queue, tasks = {};
		var keys, i;

		rootName = Object.keys( view.view )[0];

		// prepare async requests
		queue = [];
		queue.push( { depend: [], name: rootName, content: view.view[rootName] } );

		while ( queue.length > 0 ) {
			node = queue.shift();

			if ( fields[node.name] === undefined || fields[node.name].length === 0 ) { continue; }

			if ( node.content.join ) {
				keys = Object.keys( node.content.join );
				for ( i = 0; i < keys.length; i += 1 ) {
					queue.push( { depend: [node.name], name: keys[i], content: node.content.join[keys[i]] } );
				}
			}

			tasks[node.name] = node.depend.concat( findTask.bind( {
				depend: { name: node.depend[0], property: node.content.on},
				query: request.queries[node.name],
				flexo: flexes[node.name],
				fields: fields[node.name],
				count: (node.name === rootName) ? request.count : false
			} ) );
		}

		// run requests
		async.auto( tasks, function( error, results ) {
			var i, keys, res, count, node, queue = [];
			if ( error ) {
				callback( error );
				return;
			}

			count = results[rootName][1];

			// if request.inline - make inlines
			if ( request.inline ) {
				callback( new Error( 'Option `inline` not yet supported' ) );
				return;

				// TODO: go over view to inline required documents
				res = [];

				queue.push( { parent: undefined, name: rootName, content: view.view[rootName] } );
				while ( queue.length > 0 ) {
					node = queue.shift();

					if ( !node.parent ) {
						res = results[node.name];
					}

					if ( node.content.join ) {
						keys = Object.keys( node.content.join );
						for ( i = 0; i < keys.length; i += 1 ) {
							queue.push( { } );
						}
					}
				}

				callback( null, res, count );
				return;
			}

			// clean up results from count values
			res = {};
			keys = Object.keys( results );
			for ( i = 0; i < keys.length; i += 1 ) {
				res[keys[i]] = results[keys[i]][0];
			}

			callback( null, res, count );
		} );
	},
	'insert': function( name, request, flexes, fields, options, callback ) {
		var flexo, i, keys, tasks = {};

		// make tasks
		keys = Object.keys( request.queries );
		for ( i = 0; i < keys.length; i += 1 ) {
			flexo = flexes[keys[i]];
			tasks[keys[i]] = flexo.insert.bind( flexo, request.queries[keys[i]], {fields: fields[keys[i]]} );
		}

		// run in series to catch error as soon as possible
		// TODO: make validation of everything, if ok - run tasks in parallel
		async.series( tasks, function( error, results ) {
			if ( error ) {
				callback( error );
				return;
			}

			callback( null, results );
		} );
	},
	'modify': function( name, request, flexes, fields, options, callback ) {
		var flexo, i, keys, tasks = {};

		// make tasks
		keys = Object.keys( request.queries );
		for ( i = 0; i < keys.length; i += 1 ) {
			flexo = flexes[keys[i]];
			tasks[keys[i]] = flexo.modify.bind( flexo, request.queries[keys[i]] );
		}

		// run in series to catch error as soon as possible
		// TODO: make validation of everything, if ok - run tasks in parallel
		async.series( tasks, function( error, results ) {
			if ( error ) {
				callback( error );
				return;
			}

			callback( null, results );
		} );
	},
	'delete': function( name, request, flexes, fields, options, callback ) {
		var flexo, i, keys, tasks = {};

		// make tasks
		keys = Object.keys( request.queries );
		for ( i = 0; i < keys.length; i += 1 ) {
			flexo = flexes[keys[i]];
			tasks[keys[i]] = flexo.delete.bind( flexo, request.queries[keys[i]] );
		}

		// run in series to catch error as soon as possible
		// TODO: make validation of everything, if ok - run tasks in parallel
		async.series( tasks, function( error, results ) {
			if ( error ) {
				callback( error );
				return;
			}

			callback( null, results );
		} );
	}
};

findTask = function( callback, results ) { // async call to flexo find
	var query = this.query;
	var depend = this.depend;
	var i;

	// nothing to depend on
	if ( depend.name !== undefined && results[depend.name][0].length === 0 ) {
		callback( null, [] );
		return;
	}

	if ( !query ) { query = {}; }
	if ( !query.selector ) { query.selector = {}; }

	if ( depend.name !== undefined ) {
		if ( !query.selector._id ) { query.selector._id = {}; }
		if ( !query.selector._id.$in ) { query.selector._id.$in = []; }

		for ( i = 0; i < results[depend.name][0].length; i += 1 ) {

			// join property or array of properties
			query.selector._id.$in = query.selector._id.$in.concat( results[depend.name][0][i][depend.property] );
		}
	}

	this.flexo.find( query, {all: true, fields: this.fields, count: this.count}, callback );
};



function init( config, callback ) {
	if ( !config.views || typeof config.views !== 'object' ) {
		callback( new Error( 'Config must have `views` object' ) );
		return;
	}

	SETTINGS.views = config.views;
	SETTINGS.viewNames = Object.keys( SETTINGS.views );

	if ( !config.templatePath || typeof config.templatePath !== 'string' ) {
		callback( new Error( 'Config must have `templatePath` string' ) );
		return;
	}

	SETTINGS.templatePath = config.templatePath;
	if ( SETTINGS.templatePath[SETTINGS.templatePath.length - 1] !== '/' ) {
		SETTINGS.templatePath += '/';
	}

	if ( config.templateTimeout ) {
		if ( typeof config.templateTimeout !== 'number' ) {
			callback( new Error( 'Config property `templateTimeout` must be a number' ) );
			return;
		}

		SETTINGS.templateTimeout = config.templateTimeout;
	}

	SETTINGS.ok = true;

	callback( null, module.exports );
}



module.exports = {
	init: init,
	GetTemplate: GetTemplate,
	ProcessRequest: ProcessRequest
};
