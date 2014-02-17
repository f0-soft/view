'use strict';

var next = require( 'nexttick' );



var Provider = function() {
	// init
};

Provider.prototype.request = function( request, cb ) {
	if ( request.method === 'find' ) {
		return next( cb, null, {
			data:[]
		} );
	}

	return next( cb, null, {} );
};

module.exports = exports = Provider;
