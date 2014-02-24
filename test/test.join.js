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
		r: {
			name: 'r',
			service: 'flexo',
			methods: {},
			config: [
				{ b: 1, _vid: { id: 'id', data: { type: 'read', source: ['root', '_id'] } } },
				{ b: 2, _vid: { id: 'up', data: { type: 'read', source: ['root', 'tsUpdate'] } } },
				{ b: 3, _vid: { id: 'j', data: { type: 'read', source: ['root', 'join_id'] } } },
				{ b: 4, _vid: { id: '1', data: { type: 'read', source: ['root', 'a'] } } },
				{ b: 5, _vid: { id: '2', data: { type: 'read', source: ['join', 'a', 'join_id'] } } }
			],
			aux: {},
			access: { find: {}, insert: {} }
		},
		j: {
			name: 'j',
			service: 'flexo',
			methods: {},
			config: [
				{ c: 1, _vid: { id: 'id', data: { type: 'read', source: ['join', '_id'] } } },
				{ c: 2, _vid: { id: 'up', data: { type: 'read', source: ['join', 'tsUpdate'] } } },
				{ c: 3, _vid: { id: '1', data: { type: 'read', source: ['join', 'a'] } } }
			],
			aux: {},
			access: { find: {}, insert: {} }
		}
	},
	vids: {
		r: {
			'id': { source: { table: 'root', field: '_id' } },
			'up': { source: { table: 'root', field: 'tsUpdate' } },
			'j': { source: { table: 'root', field: 'join_id' } },
			'1': { source: { table: 'root', field: 'a' } },
			'2': { source: { table: 'join', field: 'a', rootField: 'join_id' } }
		},
		j: {
			'id': { source: { table: 'join', field: '_id' } },
			'up': { source: { table: 'join', field: 'tsUpdate' } },
			'1': { source: { table: 'join', field: 'a' } }
		}
	},
	paths: {}
};

var ROOT_NAME = 'r';
var JOIN_NAME = 'j';
var ROOT_VIDS = [ 'id', 'up', 'j', '1', '2' ];
var JOIN_VIDS = [ 'id', 'up', '1' ];
var ACCESS = { company_id: '0', user_id: '1', role: '' };



exports['init'] = function( t ) {
	catchAll( t );
	t.expect( 3 );

	t.doesNotThrow( function() {
		connector = new Connector( connectorConfig );
		providerConfig.connector = connector;

		provider = new Provider( providerConfig );
		viewConfig.provider = provider;

		view = new View( viewConfig );
	} );

	view.start( function( err ) {
		t.ifError( err );

		Starter.init( starterConfig, function( err, c, all ) {
			t.ifError( err );
			t.done();
		} );
	} );
};

var joinIdUp;
exports['insert join'] = function( t ) {
	catchAll( t );
	t.expect( 5 );

	view.insert( {
		name: JOIN_NAME,
		vids: JOIN_VIDS,
		request: [
			{ '1': 'q' },
			{ '1': 'w' },
			{ '1': 'e' }
		],
		access: ACCESS
	}, function( err, data ) {
		t.ifError( err );

		t.ok( data );
		t.ok( Array.isArray( data ) );
		t.doesNotThrow( function() {
			t.strictEqual( data.length, 3 );
			joinIdUp = data;
		} );

		t.done();
	} );
};

var rootIdUp;
exports['insert root'] = function( t ) {
	catchAll( t );
	t.expect( 5 );

	view.insert( {
		name: ROOT_NAME,
		vids: ROOT_VIDS,
		request: [
			{ '1': 'q', 'j': [joinIdUp[0].id] },
			{ '1': 'a', 'j': [joinIdUp[0].id, joinIdUp[1].id] },
			{ '1': 'z', 'j': [joinIdUp[0].id, joinIdUp[1].id, joinIdUp[2].id] }
		],
		access: ACCESS
	}, function( err, data ) {
		t.ifError( err );

		t.ok( data );
		t.ok( Array.isArray( data ) );
		t.doesNotThrow( function() {
			t.strictEqual( data.length, 3 );
			rootIdUp = data;
		} );

		t.done();
	} );
};

exports['find'] = function( t ) {
	catchAll( t );
	t.expect( 9 );

	view.find( {
		name: ROOT_NAME,
		vids: ROOT_VIDS,
		request: { selector: {} },
		access: ACCESS
	}, function( err, res ) {
		t.ifError( err );
		t.ok( res );
		t.doesNotThrow( function() {
			t.ok( Array.isArray( res.links ) );
			t.ok( Array.isArray( res.data ) );
			t.strictEqual( res.links.length, 6 );
			t.strictEqual( res.data.length, 2 );
			t.strictEqual( res.data[0].length, 3 );
			t.strictEqual( res.data[1].length, 3 );
		} );
		t.done();
	} );
};



exports['clean'] = function( t ) {
	catchAll( t );
	t.expect( 12 );

	view.delete( {
		name: ROOT_NAME,
		request: rootIdUp
	}, function( err, data ) {
		t.ifError( err );

		t.ok( data );
		t.ok( Array.isArray( data ) );
		t.doesNotThrow( function() {
			t.strictEqual( data.length, 3 );
			t.ok( data[0] );
		} );

		view.delete( {
			name: JOIN_NAME,
			request: joinIdUp
		}, function( err, data ) {
			t.ifError( err );

			t.ok( data );
			t.ok( Array.isArray( data ) );
			t.doesNotThrow( function() {
				t.strictEqual( data.length, 3 );
				t.ok( data[0] );
			} );

			t.done();
		} );
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
