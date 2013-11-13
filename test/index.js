'use strict';

/*
 Для запуска требуется установка `nodeunit` через `npm -g i nodeunit`
 Перед запуском провести установку зависимостей `npm install` (требуется `f0.argstype`)
 Для тестов с настоящим `rabbit`, надо ниже закомментировать строку `mock = true;` 
 Перед запуском с настоящим `rabbit` следует очистить коллекции `test` и `test_join` 

 Запуск теста:
 nodeunit test/index.js

 Очистка mongo и redis: 
 mongo --eval 'db.dropDatabase();' && redis-cli FLUSHALL
 */

var mock;
mock = true;
//process.env.DEBUG = true;
var log = function() {};
if ( process.env.DEBUG ) { log = console.log; }

var async = require( 'async' );
var INIT;

var Starter = require( 'f0.starter' );
var _ = require( 'underscore' );
var View = require( '../' );

var starterConfig = _.extend(
	{}, // empty 
	Starter.config, // initial config 
	require( './../node_modules/f0.starter/mock' ), // mocks
	{
		rabbit: mock ? require( './../node_modules/f0.starter/node_modules/f0.flexo/mock/storage' ) : require( './../node_modules/f0.starter/node_modules/f0.rabbit/' ),
		flexo: require( './../node_modules/f0.starter/node_modules/f0.flexo/' ),
		view: require( '../' ),
		flexo_path: __dirname + '/../node_modules/f0.starter/node_modules/f0.flexo/test.schemes',
		link_path: __dirname + '/../node_modules/f0.starter/node_modules/f0.flexo/test.links',
		view_path: __dirname + '/../test.views',
		template_path: __dirname + '/../test.templates',
		collection_alias: {
			testBill: 'tb',
			testAttachment: 'ta',
			testContract: 'tc',
			testCustomer: 'tr'
		}
	}
);

var provider, view;

var f1 = { scheme: 'testBill', fields: [ '_id', 'tsCreate', 'tsUpdate', 'date', 'attachment_id' ] };
var f2 = { scheme: 'testAttachment', fields: [ '_id', 'tsCreate', 'tsUpdate', 'date', 'index', 'contract_id' ] };
var f3 = { scheme: 'testContract', fields: [ '_id', 'tsCreate', 'tsUpdate', 'date', 'index', 'customer_id' ] };
var f4 = { scheme: 'testCustomer', fields: [ '_id', 'tsCreate', 'tsUpdate', 'name', 'manager_id' ] };

var name = 'test';
var allVids = [ '01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23', '24' ];
var options = { company_id: '0', user_id: '1', role: '' };

var f1data = [];
var f2data = [];
var f3data = [];
var f4data = [];

function rnd( min, max ) {
	return parseInt( Math.random() * 10000 ).toString( 10 );
}



exports['setUp'] = function( callback ) {
	if ( INIT ) {
		return callback();
	}

	return async.series( [
		function( cb ) { // init storage
			Starter.init( starterConfig, function( err, c, all ) {
				if ( err ) { return console.log( err ); }

				provider = all.flexo;
				view = all.view;

				return cb();
			} );
		},
		function( cb ) { // Check `testBill` is empty
			provider.find( {name: f1.scheme, fields: f1.fields, query: {}, options: {count: true}}, function( err, data ) {
				if ( err ) { return cb( err ); }

				if ( data.result.length !== 0 ) { return cb( new Error( 'Empty DB before test' ) ); }
				if ( data.count !== 0 ) { return cb( new Error( 'Empty DB before test' ) ); }

				return cb();
			} );
		},
		function( cb ) { // Check `testAttachment` is empty
			provider.find( {name: f2.scheme, fields: f2.fields, query: {}, options: {count: true}}, function( err, data ) {
				if ( err ) { return cb( err ); }

				if ( data.result.length !== 0 ) { return cb( new Error( 'Empty DB before test' ) ); }
				if ( data.count !== 0 ) { return cb( new Error( 'Empty DB before test' ) ); }

				return cb();
			} );
		},
		function( cb ) { // Check `testContract` is empty
			provider.find( {name: f3.scheme, fields: f3.fields, query: {}, options: {count: true}}, function( err, data ) {
				if ( err ) { return cb( err ); }

				if ( data.result.length !== 0 ) { return cb( new Error( 'Empty DB before test' ) ); }
				if ( data.count !== 0 ) { return cb( new Error( 'Empty DB before test' ) ); }

				return cb();
			} );
		},
		function( cb ) { // Check `testCustomer` is empty
			provider.find( {name: f4.scheme, fields: f4.fields, query: {}, options: {count: true}}, function( err, data ) {
				if ( err ) { return cb( err ); }

				if ( data.result.length !== 0 ) { return cb( new Error( 'Empty DB before test' ) ); }
				if ( data.count !== 0 ) { return cb( new Error( 'Empty DB before test' ) ); }

				return cb();
			} );
		},
		function( cb ) { // Insert test data into `testCustomer`
			provider.insert( {name: f4.scheme, fields: f4.fields, query: [
				{ name: rnd( 101, 200 ).toString(), manager_id: [rnd( 1, 10 ).toString()] },
				{ name: rnd( 101, 200 ).toString(), manager_id: [rnd( 1, 10 ).toString()] },
				{ name: rnd( 101, 200 ).toString(), manager_id: [rnd( 1, 10 ).toString()] }
			], options: {}}, function( err, data ) {
				var i;

				if ( err ) { return cb( err ); }

				if ( data.length !== 3 ) { return cb( new Error( 'Couldn\'t insert test data into `testCustomer`' ) ); }

				for ( i = 0; i < data.length; i += 1 ) {
					f4data.push( {_id: data[i]._id, tsUpdate: data[i].tsUpdate} );
				}

				return cb();
			} );
		},
		function( cb ) { // Insert test data into `testContract`
			provider.insert( {name: f3.scheme, fields: f3.fields, query: [
				{ date: rnd( 1, 1000 ), index: rnd( 101, 200 ).toString(), customer_id: [f4data[0]._id] },
				{ date: rnd( 1, 1000 ), index: rnd( 101, 200 ).toString(), customer_id: [f4data[1]._id] },
				{ date: rnd( 1, 1000 ), index: rnd( 101, 200 ).toString(), customer_id: [f4data[2]._id] },
				{ date: rnd( 1, 1000 ), index: rnd( 101, 200 ).toString(), customer_id: [f4data[0]._id] },
				{ date: rnd( 1, 1000 ), index: rnd( 101, 200 ).toString(), customer_id: [f4data[1]._id] },
				{ date: rnd( 1, 1000 ), index: rnd( 101, 200 ).toString(), customer_id: [f4data[2]._id] }
			], options: {}}, function( err, data ) {
				var i;

				if ( err ) { return cb( err ); }

				if ( data.length !== 6 ) { return cb( new Error( 'Couldn\'t insert test data into `testContract`' ) ); }

				for ( i = 0; i < data.length; i += 1 ) {
					f3data.push( {_id: data[i]._id, tsUpdate: data[i].tsUpdate} );
				}

				return cb();
			} );
		},
		function( cb ) { // Insert test data into `testAttachment`
			provider.insert( {name: f2.scheme, fields: f2.fields, query: [
				{ date: rnd( 1, 1000 ), index: rnd( 201, 300 ).toString(), contract_id: [f3data[0]._id]},
				{ date: rnd( 1, 1000 ), index: rnd( 201, 300 ).toString(), contract_id: [f3data[1]._id]},
				{ date: rnd( 1, 1000 ), index: rnd( 201, 300 ).toString(), contract_id: [f3data[2]._id]},
				{ date: rnd( 1, 1000 ), index: rnd( 201, 300 ).toString(), contract_id: [f3data[3]._id]},
				{ date: rnd( 1, 1000 ), index: rnd( 201, 300 ).toString(), contract_id: [f3data[4]._id]},
				{ date: rnd( 1, 1000 ), index: rnd( 201, 300 ).toString(), contract_id: [f3data[5]._id]}
			], options: {}}, function( err, data ) {
				var i;

				if ( err ) { return cb( err ); }

				if ( data.length !== 6 ) { return cb( new Error( 'Couldn\'t insert test data into `testAttachment`' ) ); }

				for ( i = 0; i < data.length; i += 1 ) {
					f2data.push( { _id: data[i]._id, tsUpdate: data[i].tsUpdate } );
				}

				return cb();
			} );
		}
	], function( err ) {
		if ( err ) {
			return callback( err );
		}

		INIT = true;
		return callback();
	} );
};


exports['GetTemplate'] = function( t ) {
	catchAll( t );
	t.expect( 4 );

	view.getTemplate( name, allVids, function( err, vids, config, template ) {
		t.ifError( err );

		t.ok( vids );
		t.ok( config );
		t.ok( template );

		t.done();
	} );
};

exports['Find empty'] = function( t ) {
	catchAll( t );
	t.expect( 10 );

	view.find( name, allVids, {selector: {}, options: {count: true, sort: { '01': 1 }}}, options, function( err, data ) {
		t.ifError( err );

		t.ok( data );
		t.strictEqual( typeof data, 'object' );
		t.doesNotThrow( function() {
			t.ok( data.result );
			t.ok( Array.isArray( data.result ) );
			t.strictEqual( data.result.length, 2 );
			t.strictEqual( data.result[0].length, 0 );
			t.strictEqual( data.result[1].length, 0 );
			t.strictEqual( data.count, 0 );
		} );

		t.done();
	} );
};

exports['Insert `test` view documents'] = function( t ) {
	catchAll( t );
	t.expect( 8 );

	view.insert( name, allVids, [
		{ '04': rnd( 1, 1000 ), '05': [ f2data[0]._id, f2data[3]._id ] },
		{ '04': rnd( 1, 1000 ), '05': [ f2data[1]._id, f2data[4]._id ] },
		{ '04': rnd( 1, 1000 ), '05': [ f2data[2]._id, f2data[5]._id ] }
	], options, function( err, data ) {
		var i, dataVids = [];
		t.ifError( err );

		t.ok( data );
		t.ok( Array.isArray( data ) );
		t.doesNotThrow( function() {
			t.strictEqual( data.length, 3 );
			dataVids = Object.keys( data[0] );
		} );

		// returns root properties
		t.notStrictEqual( dataVids.indexOf( '01' ), -1 );
		t.notStrictEqual( dataVids.indexOf( '02' ), -1 );
		// doesn't return join properties
		t.strictEqual( dataVids.indexOf( '06' ), -1 );

		for ( i = 0; i < data.length; i += 1 ) {
			f1data.push( {'01': data[i]['01'], '03': data[i]['03'] } );
		}

		t.done();
	} );
};

exports['Find inserted `test` view documents'] = function( t ) {
	catchAll( t );
	t.expect( 11 );

	view.find( name, allVids, {selector: {}, options: {count: true}}, options, function( err, data ) {
		t.ifError( err );

		t.ok( data );
		t.strictEqual( typeof data, 'object' );
		t.doesNotThrow( function() {
			t.ok( data.result );
			t.strictEqual( data.count, 3 );
			t.ok( Array.isArray( data.result ) );
			t.strictEqual( data.result.length, 2 );
			t.strictEqual( data.result[0].length, 3 );
			t.strictEqual( data.result[1].length, 15 );
			t.strictEqual( Object.keys( data.result[0][0] ).length, 7 );
		} );

		t.done();
	} );
};

exports['Modify `test` view document'] = function( t ) {
	catchAll( t );
	t.expect( 6 );

	view.modify( name, [
		{ selector: f1data[0], properties: {'04': -999}}
	], options, function( err, data ) {
		t.ifError( err );


		t.ok( data );
		t.ok( Array.isArray( data ) );
		t.doesNotThrow( function() {
			t.strictEqual( data.length, 1 );
			t.notStrictEqual( data[0]['03'], f1data[0]['03'] );
		} );

		t.done();
	} )
};

exports['Find modified `test` view documents'] = function( t ) {
	catchAll( t );
	t.expect( 11 );

	view.find( name, allVids, {selector: {test: {'01': f1data[0]['01']}}, options: {count: true}}, options, function( err, data ) {
		t.ifError( err );

		t.ok( data );
		t.strictEqual( typeof data, 'object' );
		t.doesNotThrow( function() {
			t.ok( data.result );
			t.strictEqual( data.count, 1 );
			t.ok( Array.isArray( data.result ) );
			t.strictEqual( data.result.length, 2 );
			t.strictEqual( data.result[0].length, 1 );
			t.strictEqual( data.result[1].length, 5 );
			t.strictEqual( Object.keys( data.result[0][0] ).length, 7 );
		} );

		t.done();
	} );
};

exports['Delete `test` view document'] = function( t ) {
	catchAll( t );
	t.expect( 7 );

	view.delete( name, [ f1data[1] ], options, function( err, data ) {
		t.ifError( err );

		t.ok( data );
		t.ok( Array.isArray( data ) );
		t.doesNotThrow( function() {
			t.strictEqual( data.length, 1 );
			t.ok( data[0] );
			t.strictEqual( data[0]['01'], f1data[1]['01'] );
		} );

		t.done();
	} );
};

exports['Find deleted `test` view document'] = function( t ) {
	catchAll( t );
	t.expect( 11 );

	view.find( name, allVids, {selector: {}, options: {count: true}}, options, function( err, data ) {
		t.ifError( err );

		t.ok( data );
		t.strictEqual( typeof data, 'object' );
		t.doesNotThrow( function() {
			t.ok( data.result );
			t.strictEqual( data.count, 2 );
			t.ok( Array.isArray( data.result ) );
			t.strictEqual( data.result.length, 2 );
			t.strictEqual( data.result[0].length, 2 );
			t.strictEqual( data.result[1].length, 10 );
			t.strictEqual( Object.keys( data.result[0][0] ).length, 7 );
		} );

		t.done();
	} );
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
