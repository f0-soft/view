'use strict';

var Proxy, proxy;
var Provider, provider;
var View, view;

exports['Proxy'] = function( t ) {
	catchAll( t );
	t.expect( 2 );

	t.doesNotThrow( function() {
		Proxy = require( '../lib/view/proxy' );
	} );

	t.doesNotThrow( function() {
		proxy = new Proxy( [] );
	} );

	t.done();
};


exports['Provider'] = function( t ) {
	catchAll( t );
	t.expect( 2 );

	t.doesNotThrow( function() {
		Provider = require( '../lib/view/provider' );
	} );

	t.doesNotThrow( function() {
		provider = new Provider( { proxy: proxy } );
	} );

	t.done();
};

exports['View'] = function( t ) {
	catchAll( t );
	t.expect( 2 );

	t.doesNotThrow( function() {
		View = require( '../lib/view/view' );
	} );

	t.doesNotThrow( function() {
		view = new View( { provider: provider } );
	} );

	t.done();
};



/**
 * Available test methods
 */
var t = {
	expect: function( number ) { return number; },
	ok: function( value, message ) {
		if ( message ) {}
		return value;
	},
	deepEqual: function( actual, expected, message ) {
		if ( expected || message ) {}
		return actual;
	},
	notDeepEqual: function( actual, expected, message ) {
		if ( expected || message ) {}
		return actual;
	},
	strictEqual: function( actual, expected, message ) {
		if ( expected || message ) {}
		return actual;
	},
	notStrictEqual: function( actual, expected, message ) {
		if ( expected || message ) {}
		return actual;
	},
	throws: function( block, error, message ) {
		if ( error || message ) {}
		return block;
	},
	doesNotThrow: function( block, error, message ) {
		if ( error || message ) {}
		return block;
	},
	ifError: function( value ) { return value; },
	done: function() { return true;}
};

function catchAll( test ) {
	process.removeAllListeners( 'uncaughtException' );
	process.on( 'uncaughtException', test.done );
}
