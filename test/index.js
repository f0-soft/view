'use strict';

/*
 Для запуска требуется установка `nodeunit` через `npm -g i nodeunit`
 Перед запуском провести установку зависимостей `npm install` (требуется `f0.argstype`)
 Для тестов с настоящим `rabbit`, надо ниже закомментировать строку `mock = true;` 
 Перед запуском с настоящим `rabbit` следует очистить коллекции `test` и `test_join` 

 Запуск теста:
 nodeunit test/index.js

 Очистка mongo и redis: 
 mongo --eval 'db.testBill.remove(); db.testAttachment.remove(); db.testContract.remove();' && redis-cli FLUSHALL
 */

var mock;
mock = true;
//process.env.DEBUG = true;
var log = function() {};
if ( process.env.DEBUG ) { log = console.log; }

var async = require( 'async' );
var INIT;

var Rabbit = mock ? require( '../node_modules/f0.flexo/mock/storage' ) : require( 'f0.rabbit' );
var Flexo = require( 'f0.flexo' );
var View = require( '../' );

var storageConfig = {
	gPath: {
		'bill-contract': [
			[ 'testContract', '_id' ],
			[ 'testAttachment', 'contract_id' ]
		]
	},
	gFieldDepPath: {
		testBill: {
			attachment_id: [ 'bill-contract', 'testAttachment' ]
		}
	}
};
var provider, providerConfig = {
	storage: undefined,
	schemes: {
		testBill: {
			scheme: require( '../node_modules/f0.flexo/test.schemes/testBill' ),
			dict: {
				all: [ '_id', 'tsCreate', 'tsUpdate', 'date', 'attachment_id', '_path' ],
				mutable: [ 'date', 'attachment_id' ],
				joinProperties: [],
				joins: [],
				types: {
					_id: { type: 'id' },
					tsCreate: { type: 'number' },
					tsUpdate: { type: 'number' },
					date: { type: 'number' },
					attachment_id: { type: 'array', of: 'id', from: 'testAttachment', link: 'bill-manager' },
					_path: { type: 'array' }
				}
			}
		},
		testAttachment: {
			scheme: require( '../node_modules/f0.flexo/test.schemes/testAttachment' ),
			dict: {
				all: [ '_id', 'tsCreate', 'tsUpdate', 'date', 'index', 'contract_id', '_path' ],
				mutable: [ 'date', 'index', 'contract_id' ],
				joinProperties: [],
				joins: [],
				types: {
					_id: { type: 'id' },
					tsCreate: { type: 'number' },
					tsUpdate: { type: 'number' },
					date: { type: 'number' },
					index: { type: 'string' },
					contract_id: { type: 'id', from: 'testContract', link: 'bill-manager' },
					_path: { type: 'array' }
				}
			}
		},
		testContract: {
			scheme: require( '../node_modules/f0.flexo/test.schemes/testContract' ),
			dict: {
				all: [ '_id', 'tsCreate', 'tsUpdate', 'date', 'index', 'customer_id', '_path' ],
				mutable: [ 'date', 'index', 'customer_id' ],
				joinProperties: [],
				joins: [],
				types: {
					_id: { type: 'id' },
					tsCreate: { type: 'number' },
					tsUpdate: { type: 'number' },
					date: { type: 'number' },
					index: { type: 'string' },
					customer_id: { type: 'id', from: 'testCustomer', link: 'bill-manager' },
					_path: { type: 'array' }
				}
			}
		}
	}
};

var view, viewConfig = {
	provider: undefined,
	views: {
		test: {
			view: require( '../test.views/test.js' ),
			vids: {
				'01': [ 'testBill', '_id' ],
				'02': [ 'testBill', 'tsCreate' ],
				'03': [ 'testBill', 'tsUpdate' ],
				'04': [ 'testBill', 'date' ],
				'05': [ 'testBill', 'attachment_id' ],
				'06': [ 'testAttachment', '_id', 'attachment_id' ],
				'07': [ 'testAttachment', 'tsCreate', 'attachment_id' ],
				'08': [ 'testAttachment', 'tsUpdate', 'attachment_id' ],
				'09': [ 'testAttachment', 'date', 'attachment_id' ],
				'10': [ 'testAttachment', 'index', 'attachment_id' ],
				'11': [ 'testAttachment', 'contract_id', 'attachment_id' ],
				'12': [ 'testContract', '_id', 'attachment_id', 'bill-contract' ],
				'13': [ 'testContract', 'tsCreate', 'attachment_id', 'bill-contract' ],
				'14': [ 'testContract', 'tsUpdate', 'attachment_id', 'bill-contract' ],
				'15': [ 'testContract', 'date', 'attachment_id', 'bill-contract' ],
				'16': [ 'testContract', 'index', 'attachment_id', 'bill-contract' ],
				'17': [ 'testContract', 'customer_id', 'attachment_id', 'bill-contract' ]
			},
			aggr: {
				'18': {
					name: 'attachmentAggregation',
					group: { $sum: '$date' }
				},
				'19': {
					name: 'attachmentAggregation',
					selector: 'tsCreate'
				}
			}
		}
	},
	paths: {
		'bill-contract': [
			[ 'testContract', '_id' ],
			[ 'testAttachment', 'contract_id' ]
		]
	},
	templatePath: __dirname + '/../test.templates/',
	templateTimeout: 100
};

var f1 = { scheme: 'testBill', fields: [ '_id', 'tsCreate', 'tsUpdate', 'date', 'attachment_id', '_path' ] };
var f2 = { scheme: 'testAttachment', fields: [ '_id', 'tsCreate', 'tsUpdate', 'date', 'index', 'contract_id', '_path' ] };
var f3 = { scheme: 'testContract', fields: [ '_id', 'tsCreate', 'tsUpdate', 'date', 'index', 'customer_id', '_path' ] };

var name = 'test';
var allVids = [ '01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13', '14', '15', '16', '17', '18' ];
var options = { insert_user_id: false, user_id: '1', role: 'manager' };

var f1data = [];
var f2data = [];
var f3data = [];

function rnd( min, max ) {
	return Math.floor( Math.random() * (max - min) + min );
}



exports['setUp'] = function( callback ) {
	if ( INIT ) {
		return callback();
	}

	return async.series( [
		function( cb ) { // init storage
			Rabbit.init( storageConfig, function( err ) {
				if ( err ) { return cb( err ); }

				providerConfig.storage = {
					find: Rabbit.find,
					aggregate: Rabbit.aggregate,
					insert: Rabbit.insert,
					modify: Rabbit.modify,
					delete: Rabbit.delete
				};

				return cb();
			} );
		},
		function( cb ) { // init provider
			Flexo.init( providerConfig, function( err, module ) {
				if ( err ) { return cb( err ); }

				viewConfig.provider = module;
				provider = module;

				return cb();
			} );
		},
		function( cb ) { // Check `testBill` is empty
			provider.find( f1.scheme, f1.fields, { selector: [] }, {count: true}, function( err, data, count ) {
				if ( err ) { return cb( err ); }

				if ( data.length !== 0 ) { return cb( new Error( 'Empty DB before test' ) ); }
				if ( count !== 0 ) { return cb( new Error( 'Empty DB before test' ) ); }

				return cb();
			} );
		},
		function( cb ) { // Check `testAttachment` is empty
			provider.find( f2.scheme, f2.fields, { selector: [] }, {count: true}, function( err, data, count ) {
				if ( err ) { return cb( err ); }

				if ( data.length !== 0 ) { return cb( new Error( 'Empty DB before test' ) ); }
				if ( count !== 0 ) { return cb( new Error( 'Empty DB before test' ) ); }

				return cb();
			} );
		},
		function( cb ) { // Check `testContract` is empty
			provider.find( f3.scheme, f3.fields, { selector: [] }, {count: true}, function( err, data, count ) {
				if ( err ) { return cb( err ); }

				if ( data.length !== 0 ) { return cb( new Error( 'Empty DB before test' ) ); }
				if ( count !== 0 ) { return cb( new Error( 'Empty DB before test' ) ); }

				return cb();
			} );
		},
		function( cb ) { // Insert test data into `testContract`
			provider.insert( f3.scheme, f3.fields, [
				{ date: rnd( 1, 1000 ), index: rnd( 101, 200 ).toString(), customer_id: rnd( 1, 10 ).toString() },
				{ date: rnd( 1, 1000 ), index: rnd( 101, 200 ).toString(), customer_id: rnd( 1, 10 ).toString() },
				{ date: rnd( 1, 1000 ), index: rnd( 101, 200 ).toString(), customer_id: rnd( 1, 10 ).toString() },
				{ date: rnd( 1, 1000 ), index: rnd( 101, 200 ).toString(), customer_id: rnd( 1, 10 ).toString() },
				{ date: rnd( 1, 1000 ), index: rnd( 101, 200 ).toString(), customer_id: rnd( 1, 10 ).toString() },
				{ date: rnd( 1, 1000 ), index: rnd( 101, 200 ).toString(), customer_id: rnd( 1, 10 ).toString() }
			], {}, function( err, data ) {
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
			provider.insert( f2.scheme, f2.fields, [
				{ date: rnd( 1, 1000 ), index: rnd( 201, 300 ).toString(), contract_id: f3data[0]._id},
				{ date: rnd( 1, 1000 ), index: rnd( 201, 300 ).toString(), contract_id: f3data[1]._id},
				{ date: rnd( 1, 1000 ), index: rnd( 201, 300 ).toString(), contract_id: f3data[2]._id},
				{ date: rnd( 1, 1000 ), index: rnd( 201, 300 ).toString(), contract_id: f3data[3]._id},
				{ date: rnd( 1, 1000 ), index: rnd( 201, 300 ).toString(), contract_id: f3data[4]._id},
				{ date: rnd( 1, 1000 ), index: rnd( 201, 300 ).toString(), contract_id: f3data[5]._id}
			], {}, function( err, data ) {
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
		INIT = true;
		return callback( err );
	} );
};


exports['Init View'] = function( t ) {
	t.expect( 1 );

	View.init( viewConfig, function( err, module ) {
		t.ifError( err );
		view = module;
		t.done();
	} );
};

exports['GetTemplate'] = function( t ) {
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
	t.expect( 6 );

	view.find( name, allVids, {selector: {}, options: {count: true}}, options, function( err, data, count ) {
		t.ifError( err );

		t.ok( data );
		t.ok( Array.isArray( data ) );
		t.doesNotThrow( function() {
			t.strictEqual( data.length, 0 );
		} );
		t.strictEqual( count, 0 );

		t.done();
	} );
};

exports['Insert `test` view documents'] = function( t ) {
	t.expect( 8 );

	view.insert( name, allVids, [
		{ '04': rnd( 1, 1000 ), '05': [ f2data[0]._id, f2data[2]._id, f2data[4]._id ] },
		{ '04': rnd( 1, 1000 ), '05': [ f2data[1]._id, f2data[3]._id, f2data[5]._id ] },
		{ '04': rnd( 1, 1000 ), '05': [ f2data[2]._id, f2data[4]._id, f2data[0]._id ] }
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
	t.expect( 10 );

	view.find( name, allVids, {selector: {}, options: {count: true}}, options, function( err, data, count ) {
		t.ifError( err );

		t.ok( data );
		t.ok( Array.isArray( data ) );
		t.doesNotThrow( function() {
			t.strictEqual( data.length, 4 );
			t.strictEqual( data[0].length, 3 );
			t.strictEqual( data[1].length, 6 );
			t.strictEqual( data[2].length, 6 );
			t.strictEqual( data[3].length, 3 );
		} );
		t.strictEqual( count, 3 );

		t.done();
	} );
};

exports['Modify `test` view document'] = function( t ) {
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
	t.expect( 13 );

	view.find( name, allVids, { selector: {test: {'01': f1data[0]['01']}}, options: {count: true}}, options, function( err, data, count ) {
		t.ifError( err );

		t.ok( data );
		t.ok( Array.isArray( data ) );
		t.doesNotThrow( function() {
			t.strictEqual( data.length, 4 );
			t.strictEqual( data[0].length, 1 );
			t.strictEqual( data[1].length, 3 );
			t.strictEqual( data[2].length, 3 );
			t.strictEqual( data[3].length, 1 );
			t.strictEqual( data[0][0]['01'], f1data[0]['01'] );
			t.notStrictEqual( data[0][0]['03'], f1data[0]['03'] );
			t.strictEqual( data[0][0]['04'], -999 );
		} );
		t.strictEqual( count, 1 );

		t.done();
	} );
};

exports['Delete `test` view docment'] = function( t ) {
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
	t.expect( 12 );

	view.find( name, allVids, {selector: {}, options: {count: true}}, options, function( err, data, count ) {
		t.ifError( err );

		t.ok( data );
		t.ok( Array.isArray( data ) );
		t.doesNotThrow( function() {
			t.strictEqual( data.length, 4 );
			t.strictEqual( data[0].length, 2 );
			t.strictEqual( data[1].length, 3 );
			t.strictEqual( data[2].length, 3 );
			t.strictEqual( data[3].length, 2 );
			t.notDeepEqual( data[0][0]['01'], f1data[1]['01'] );
			t.notDeepEqual( data[0][1]['01'], f1data[1]['01'] );
		} );
		t.strictEqual( count, 2 );

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
