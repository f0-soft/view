'use strict';

var fs = require( 'fs' );
var dot = require( 'dot' );
var next = require( 'nexttick' );



exports.check = [
	['name', true, 's'],
	['vids', true, 'a', [
		'*', false, 's'
	]],
	['callback', true, 'f']
];
module.exports = exports = function( name, vids, callback ) {
	this._log( 'View.getTemplate:', arguments );
	var errType = this._check.getTemplate( arguments );
	var template, res;

	if ( errType ) { return this._next( callback, errType ); }
	if ( this._VIEWS[name] === undefined ) { return this._nextErr( callback, 'не существует view `{{n}}`', {n: name} ); }

	// slice config - get user config
	// gather remaining vids in config
	try {
		res = this._SLICER( this._VIEWS[name].view.config, vids );
	} catch ( e ) {
		return this._nextErr( callback, e.message );
	}

	// load template
	// process template with config
	return loadTemplate( name, function( err, processor ) {
		if ( err ) {
			return this._nextErr( callback, 'не удалось загрузить шаблон `{{n}}`: {{e}}', {n: name, e: err.message} );
		}

		try {
			template = processor( res.config );
		} catch ( e ) {
			return this._nextErr( callback, 'внутренняя ошибка шаблона: {{e}}', {e: e.message} );
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
			processor = SETTINGS.templates[ SETTINGS.templateNames[i] ][0];
			SETTINGS.templates[ SETTINGS.templateNames[i] ][1] = now;
			continue;
		}

		// remove old
		if ( SETTINGS.templates[ SETTINGS.templateNames[i] ][1] < min ) {
			delete SETTINGS.templates[ SETTINGS.templateNames[i] ];
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

	return fs.readFile(
		(SETTINGS.templatePath + VIEWS[name].view.template),
		{encoding: 'utf8'},
		function( err, template ) {
			if ( err ) {
				return callback( err );
			}

			processor = dot.template( template );
			SETTINGS.templateNames.push( name );
			SETTINGS.templates[name] = [ processor, now ];

			return callback( null, processor );
		}
	);
}

function emptyProcessor() {
	return '';
}
