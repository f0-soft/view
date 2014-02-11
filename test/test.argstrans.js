'use strict';

var tr = require( '../lib/view/argstrans' );



exports['Create output'] = function( t ) {
	catchAll( t );
	t.expect( 4 );

	t.doesNotThrow( function() {
		var rules = {};
		var req = [];
		var tpl = [];
		var out = tr( rules, req );

		t.ok( out );
		t.ok( Array.isArray( out ) );
		t.strictEqual( out.length, 0 );
	} );

	t.done();
};

exports['Clone template'] = function( t ) {
	catchAll( t );
	t.expect( 3 );

	t.doesNotThrow( function() {
		var rules = {};
		var req = [];
		var tpl = [];
		var out = tr( rules, req, tpl );

		t.ok( out );
		t.notStrictEqual( out, tpl );
	} );

	t.done();
};

exports['Swap'] = function( t ) {
	catchAll( t );
	t.expect( 3 );

	t.doesNotThrow( function() {
		var rules = {
			'0': '1',
			'1': '0'
		};
		var req = [1, 2];
		var tpl = [];
		var out = tr( rules, req, tpl );

		t.strictEqual( out[0], req[1] );
		t.strictEqual( out[1], req[0] );
	} );

	t.done();
};

exports['Clone'] = function( t ) {
	catchAll( t );
	t.expect( 6 );

	t.doesNotThrow( function() {
		var rules = {
			'0': '0',
			'1': '1'
		};
		var req = [
			{a: 1},
			['b', 1]
		];
		var tpl = [];
		var out = tr( rules, req, tpl );

		t.notStrictEqual( out[0], req[0] );
		t.strictEqual( out[0].a, req[0].a );

		t.notStrictEqual( out[1], req[1] );
		t.strictEqual( out[1][0], req[1][0] );
		t.strictEqual( out[1][1], req[1][1] );
	} );

	t.done();
};

exports['Sort rules by depth, delete node'] = function( t ) {
	catchAll( t );
	t.expect( 3 );

	t.doesNotThrow( function() {
		var rules = {
			'0.a': '@del',
			'0': '0'
		};
		var req = [
			{a: 1, b: 2}
		];
		var tpl = [];
		var out = tr( rules, req, tpl );

		t.strictEqual( out[0].a, undefined );
		t.strictEqual( out[0].b, req[0].b );
	} );

	t.done();
};

exports['Set JSON value'] = function( t ) {
	catchAll( t );
	t.expect( 3 );

	t.doesNotThrow( function() {
		var rules = {
			'0': '#{"a":1}',
			'1': '1'
		};
		var req = [
			{a: 0},
			{b: 1}
		];
		var tpl = [];
		var out = tr( rules, req, tpl );

		t.strictEqual( out[0].a, 1 );
		t.strictEqual( out[1].b, req[1].b );
	} );

	t.done();
};

exports['Throw on empty key'] = function( t ) {
	catchAll( t );
	t.expect( 1 );

	t.throws( function() {
		var rules = {
			'': '0'
		};
		var req = [1];
		var tpl = [];
		var out = tr( rules, req, tpl );
	} );

	t.done();
};

exports['Throw on empty value'] = function( t ) {
	catchAll( t );
	t.expect( 1 );

	t.throws( function() {
		var rules = {
			'0': ''
		};
		var req = [1];
		var tpl = [];
		var out = tr( rules, req, tpl );
	} );

	t.done();
};

exports['Throw on empty command'] = function( t ) {
	catchAll( t );
	t.expect( 1 );

	t.throws( function() {
		var rules = {
			'0': '#'
		};
		var req = [1];
		var tpl = [];
		var out = tr( rules, req, tpl );
	} );

	t.done();
};

exports['---'] = function( t ) {
	catchAll( t );
	t.expect( 1 );

	t.doesNotThrow( function() {
		var rules = {};
		var req = [];
		var tpl = [];
		var out = tr( rules, req, tpl );

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
