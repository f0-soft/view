'use strict';

var fs = require( 'fs' );
var dot = require( 'dot' );
var next = require( 'nexttick' );



var ME = '_loadTemplate';

exports.check = [
	['name', true, 's'],
	['callback', true, 'f']
];

exports.method = function( name, cb ) {
	var self = this;

	self._log( ME, arguments );
	var errType = self._check[ME]( arguments );
	var now = Date.now();
	var min = now - self._templateTimeout;
	var i, processor;

	if ( errType ) { return next( cb, errType ); }

	// back search
	for ( i = self._templateNames.length - 1; i >= 0; i -= 1 ) {
		// find processor
		if ( self._templateNames[i] === name ) {
			processor = self._templates[ self._templateNames[i] ][0];
			self._templates[ self._templateNames[i] ][1] = now;
			continue;
		}

		// remove old
		if ( self._templates[ self._templateNames[i] ][1] < min ) {
			delete self._templates[ self._templateNames[i] ];
			self._templateNames.splice( i, 1 );
		}
	}

	if ( processor ) {
		return next( cb, null, processor );
	}

	// load processor
	if ( self._views[name].view.template === undefined ) {
		processor = emptyProcessor;
		self._templateNames.push( name );
		self._templates[name] = [ processor, now ];

		return next( cb, null, processor );
	}

	return fs.readFile(
		(self._templatePath + self._views[name].view.template),
		{encoding: 'utf8'},
		function( err, template ) {
			if ( err ) {
				return cb( err );
			}

			processor = dot.template( template );
			self._templateNames.push( name );
			self._templates[name] = [ processor, now ];

			return cb( null, processor );
		}
	);
};

function emptyProcessor() {
	return '';
}
