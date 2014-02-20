'use strict';

var next = require( 'nexttick' );



var Service = function( cfg ) {};
Service.prototype.noop = function noop( req, cb ) {
	return next( cb, null, [] );
};



module.exports = exports = Service;
