'use strict';

var Connector = require( '../lib/view/connector' );
var Provider = require( '../lib/view/provider' );
var View = require( '../lib/view/view' );
var Starter = require( 'f0.starter' );
var underscore = require( 'underscore' );



var connector, provider, view;
var starterConfig = underscore.extend(
	{},
	Starter.config,
	{
		'flexo-client': Starter.mock['flexo-client'],
		view: Starter.mock.view,
		controller: Starter.mock.controller,
		flexo_path: __dirname + '/../test.scheme',
		type_path: __dirname + '/../node_modules/f0.starter/scheme/types',
		link_path: __dirname + '/../test.other',
		view_path: __dirname + '/../test.other',
		template_path: __dirname + '/../test.other',
		collection_alias: require( '../test.alias' )
	}
);
var connectorConfig = [
	{name: 'flexo', pkg: 'f0.flexo-client', config: {
		host: 'localhost',
		port: 35396
	}}
];
var providerConfig = {
	connector: undefined,
	dict: {
		flexo: {
			find: {
				request: { rules: {
					'0': '0',
					'0.table': '@del',
					'0.name': '0.table'
				} },
				response: { rules: {
					'0': '0',
					'1': '1.result'
				} }
			},
			insert: {
				request: {rules: {
					'0': '0',
					'0.table': '@del',
					'0.name': '0.table'
				}},
				response: {rules: {
					'0': '0',
					'1': '1.result'
				}}
			},
			modify: {
				request: {rules: {
					'0': '0',
					'0.table': '@del',
					'0.name': '0.table'
				}},
				response: {rules: {
					'0': '0',
					'1': '1'
				}}
			},
			delete: {
				request: {rules: {
					'0': '0',
					'0.table': '@del',
					'0.name': '0.table'
				}},
				response: {rules: {
					'0': '0',
					'1': '1'
				}}
			}
		}
	}
};
var viewConfig = {
	provider: undefined,
	views: {
		v: {
			name: 'v',
			service: 'flexo',
			methods: {},
			config: [
				{ a: -1, _vid: { id: 'id', data: { type: 'read', source: ['test', '_id'] } } },
				{ a: 0, _vid: { id: 'up', data: { type: 'read', source: ['test', 'tsUpdate'] } } },
				{ a: 1, _vid: { id: '1', data: { type: 'read', source: ['test', 'a'] } } },
				{ a: 2, _vid: { id: '2', data: { type: 'read', source: ['test', 'b'] } } },
				{ a: 3, _vid: { id: '3', data: { type: 'read', source: ['test', 'c'] } } }
			],
			aux: {},
			access: {find: {}, insert: {}}
		}
	},
	vids: {
		v: {
			'id': { source: { table: 'test', field: '_id' } },
			'up': { source: { table: 'test', field: 'tsUpdate' } },
			'1': { source: { table: 'test', field: 'a' } },
			'2': { source: { table: 'test', field: 'b' } },
			'3': { source: { table: 'test', field: 'c' } }
		}
	},
	paths: {}
};

var NAME = 'v';
var ALL_VIDS = [ 'id', 'up', '1', '2', '3' ];
var ACCESS = { company_id: '0', user_id: '1', role: '' };



exports['init'] = function( t ) {
	catchAll( t );
	t.expect( 2 );

	t.doesNotThrow( function() {
		connector = new Connector( connectorConfig );
		providerConfig.connector = connector;

		provider = new Provider( providerConfig );
		viewConfig.provider = provider;

		view = new View( viewConfig );
	} );

	view.start( function( err ) {
		t.ifError( err );
		t.done();
	} );
};

exports['start flexo server'] = function( t ) {
	catchAll( t );
	t.expect( 1 );

	Starter.init( starterConfig, function( err, c, all ) {
		t.ifError( err );
		t.done();
	} );
};

exports['GetTemplate'] = function( t ) {
	catchAll( t );
	t.expect( 4 );

	view.getTemplate( NAME, ALL_VIDS, function( err, vids, config, template ) {
		t.ifError( err );

		t.ok( vids );
		t.ok( config );
		t.strictEqual( template, '' );

		t.done();
	} );
};


exports['find'] = function( t ) {
	catchAll( t );
	t.expect( 2 );

	view.find( {
		name: NAME,
		vids: ALL_VIDS,
		request: { selector: {} },
		access: ACCESS
	}, function( err, res ) {
		t.ifError( err );
		t.ok( res );
		t.done();
	} );
};

var docIdUpdate;
exports['insert'] = function( t ) {
	catchAll( t );
	t.expect( 5 );

	view.insert( {
		name: NAME,
		vids: ALL_VIDS,
		request: [
			{ '1': 'q' },
			{ '1': 'a', '2': 's' },
			{ '1': 'z', '2': 'x', '3': 'c' }
		],
		access: ACCESS
	}, function( err, data ) {
		t.ifError( err );

		t.ok( data );
		t.ok( Array.isArray( data ) );
		t.doesNotThrow( function() {
			t.strictEqual( data.length, 3 );
			docIdUpdate = data[0];
		} );

		t.done();
	} );
};

exports['modify'] = function( t ) {
	catchAll( t );
	t.expect( 5 );

	view.modify( {
		name: NAME,
		request: [
			{ selector: docIdUpdate, properties: {'3': '-999'}}
		]
	}, function( err, data ) {
		t.ifError( err );

		t.ok( data );
		t.ok( Array.isArray( data ) );
		t.doesNotThrow( function() {
			t.strictEqual( data.length, 1 );
			docIdUpdate = data[0];
		} );

		t.done();
	} )
};

exports['delete'] = function( t ) {
	catchAll( t );
	t.expect( 6 );

	view.delete( {
		name: NAME,
		request: [ docIdUpdate ]
	}, function( err, data ) {
		t.ifError( err );

		t.ok( data );
		t.ok( Array.isArray( data ) );
		t.doesNotThrow( function() {
			t.strictEqual( data.length, 1 );
			t.ok( data[0] );
		} );

		t.done();
	} );
};

exports['find remaining'] = function( t ) {
	catchAll( t );
	t.expect( 2 );

	view.find( {
		name: NAME,
		vids: ALL_VIDS,
		request: { selector: {} },
		access: ACCESS
	}, function( err, res ) {
		t.ifError( err );
		t.strictEqual( res.data.length, 2 );
		docIdUpdate = [
			{id: res.data[0][0]._id, up: res.data[0][0].tsUpdate},
			{id: res.data[0][1]._id, up: res.data[0][1].tsUpdate}
		];
		t.done();
	} );
};

exports['clean'] = function( t ) {
	catchAll( t );
	t.expect( 6 );

	view.delete( {
		name: NAME,
		request: docIdUpdate
	}, function( err, data ) {
		t.ifError( err );

		t.ok( data );
		t.ok( Array.isArray( data ) );
		t.doesNotThrow( function() {
			t.strictEqual( data.length, 2 );
			t.ok( data[0] );
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
