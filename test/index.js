'use strict';

/*
 Перед запуском провести установку зависимостей `npm install`
 Для работы требует `flexo` (которому требуются `collectioner` и `rabbit`), который надо поместить в `node_modules` на уровне package.json
 Перед запуском с настоящим `rabbit` следует очистить коллекции `test` и `test_join` 
 Для тестов с настоящим `rabbit`, надо ниже в переменной `flexoConfig` заменить значение mock на `false`
 Тест запускать через `node test/index.js`
 */

var flexoConfig = { mock: true };



//process.env.DEBUG = true;

var log = process.env.DEBUG ? console.log : function() {};


var async = require( 'async' );

var Flexo = require( 'flexo' );
var flexoContainer;
var View;
var tj_ids, t_ids;

function rnd() {
	return (Math.random() * 10000).toString( 10 );
}

var viewFields = {
	test: ['name', 'inn', 'comment', 'join_id', 'array_of_id', 'test_join_name', 'test_join_inn', 'test_join_comment'],
	test_join: ['name', 'inn', 'comment', 'array_of_id']
};



var tasks = {
	'Init Flexo': function( callback ) {
		console.log( 'Init Flexo' );

		try {
			Flexo.init( flexoConfig, function( error ) {
				if ( error ) {
					callback( error );
					return;
				}

				callback( null, Flexo );
			} );
		} catch ( e ) {
			callback( e );
		}
	},

	'Create Flexo': function( callback ) {
		console.log( 'Create Flexo' );

		try {
			flexoContainer = {
				test: new Flexo.Collection( { scheme: 'test', fields: ['name', 'inn', 'comment', 'join_id', 'array_of_id', 'test_join_name', 'test_join_inn', 'test_join_comment'] } ),
				test_join: new Flexo.Collection( { scheme: 'test_join', fields: ['name', 'inn', 'comment', 'array_of_id'] } )
			};
		} catch ( e ) {
			callback( e );
			return;
		}

		callback( null, flexoContainer );
	},

	'Check Flexo `test` is empty': function( callback ) {
		console.log( 'Check Flexo `test` is empty' );

		flexoContainer.test.find( {selector: {}}, {all: true, count: true}, function( error, data, count ) {
			if ( error ) {
				callback( error );
				return;
			}

			if ( data.length !== 0 || count !== 0 ) {
				callback( new Error( 'Collection `test` isn\'t empty, clean it first' ) );
				return;
			}

			callback( null, {data: data, count: count} );
		} );
	},

	'Check Flexo `test_join` is empty': function( callback ) {
		console.log( 'Check Flexo `test_join` is empty' );

		flexoContainer.test_join.find( {selector: {}}, {all: true, count: true}, function( error, data, count ) {
			if ( error ) {
				callback( error );
				return;
			}

			if ( data.length !== 0 || count !== 0 ) {
				callback( new Error( 'Collection `test_join` isn\'t empty, clean it first' ) );
				return;
			}

			callback( null, {data: data, count: count} );
		} );
	},

	'Init View': function( callback ) {
		console.log( 'Init View' );

		try {
			View = require( '../' );

			View.init( {
				views: { test: require( '../test.views/test' ) },
				templatePath: __dirname + '/../test.templates/',
				templateTimeout: 10 * 1000
			}, function( error, result ) {
				if ( error ) {
					callback( error );
					return;
				}

				callback( null, result );
			} );
		} catch ( e ) {
			callback( e );
		}
	},

	'Insert `test_join` part of view': function( callback ) {
		console.log( 'Insert `test_join` part of view' );

		View.ProcessRequest( 'test', 'insert', {queries: { test_join: [
			{ name: rnd(), inn: rnd(), comment: rnd(), array_of_id: [rnd(), rnd(), rnd()]},
			{ name: rnd(), inn: rnd(), comment: rnd(), array_of_id: [rnd(), rnd()]},
			{ name: rnd(), inn: rnd(), comment: rnd(), array_of_id: [rnd()]}
		]}}, flexoContainer, viewFields, {}, function( error, data ) {
			if ( error ) {
				callback( error );
				return;
			}

			if ( data.test_join === undefined ) {
				callback( new Error( 'No data returned' ) );
				return;
			}
			if ( data.test_join.length !== 3 ) {
				callback( new Error( 'Not all documents are saved' ) );
				return;
			}

			try {
				tj_ids = [data.test_join[0]._id, data.test_join[1]._id, data.test_join[2]._id];
			} catch ( e ) {
				callback( e );
				return;
			}

			callback( null, tj_ids );
		} );
	},

	'Insert `test` part of view': function( callback ) {
		console.log( 'Insert `test` part of view' );

		View.ProcessRequest( 'test', 'insert', {queries: { test: [
			{ name: rnd(), inn: rnd(), comment: rnd(), join_id: tj_ids[2], array_of_id: [tj_ids[2], tj_ids[1], tj_ids[0]]},
			{ name: rnd(), inn: rnd(), comment: rnd(), join_id: tj_ids[1], array_of_id: [tj_ids[2], tj_ids[1]]},
			{ name: rnd(), inn: rnd(), comment: rnd(), join_id: tj_ids[0], array_of_id: [tj_ids[2]]}
		]}}, flexoContainer, viewFields, {}, function( error, data ) {
			if ( error ) {
				callback( error );
				return;
			}

			if ( data.test === undefined ) {
				callback( new Error( 'No data returned' ) );
				return;
			}
			if ( data.test.length !== 3 ) {
				callback( new Error( 'Not all documents are saved' ) );
				return;
			}

			try {
				t_ids = [data.test[0]._id, data.test[1]._id, data.test[2]._id];
			} catch ( e ) {
				callback( e );
				return;
			}

			callback( null, t_ids );
		} );
	},

	'Find inserted views': function( callback ) {
		console.log( 'Find inserted views' );

		View.ProcessRequest( 'test', 'find', { queries: {}, count: true }, flexoContainer, viewFields, {}, function( error, data, count ) {
			if ( error ) {
				callback( error );
				return;
			}

			if ( data.test.length !== 3 || data.test_join.length !== 3 || count !== 3 ) {
				callback( new Error( 'Not all documents were saved' ) );
				return;
			}

			callback( null, {data: data, count: count} );
		} );

	},

	'Find one view': function( callback ) {
		console.log( 'Find one view' );

		View.ProcessRequest( 'test', 'find', {queries: {test: {selector: {_id: t_ids[2]}}}, count: true}, flexoContainer, viewFields, {}, function( error, data, count ) {
			if ( error ) {
				callback( error );
				return;
			}

			if ( data.test.length !== 1 || count !== 1 ) {
				callback( new Error( 'Wrong amount of `test` documents' ) );
				return;
			}
			if ( data.test_join.length !== 1 ) {
				callback( new Error( 'Wrong amount of `test_join` documents' ) );
				return;
			}

			callback( null, {data: data, count: count} );
		} );
	},

	'Modify view': function( callback ) {
		console.log( 'Modify view' );

		View.ProcessRequest( 'test', 'modify', {queries: {test: {selector: {_id: t_ids[2]}, properties: {array_of_id: [tj_ids[1], tj_ids[2]]}}}}, flexoContainer, viewFields, {}, function( error, data ) {
			if ( error ) {
				callback( error );
				return;
			}

			if ( data.test.length !== 1 ) {
				callback( new Error( 'Wrong amount of modified `test` documents' ) );
				return;
			}

			callback( null, data );
		} );
	},

	'Check view modification': function( callback ) {
		console.log( 'Check view modification' );

		View.ProcessRequest( 'test', 'find', {queries: {test: {selector: {_id: t_ids[2]}}}, count: true}, flexoContainer, viewFields, {}, function( error, data, count ) {
			if ( error ) {
				callback( error );
				return;
			}

			if ( data.test.length !== 1 || data.test_join.length !== 2 || count !== 1 ) {
				callback( new Error( 'Wrong amount of documents' ) );
				return;
			}

			callback( null, {data: data, count: count} );
		} );
	},

	'Delete view': function( callback ) {
		console.log( 'Delete view' );

		View.ProcessRequest( 'test', 'delete', {queries: {test: {selector: {_id: t_ids[0]}}}}, flexoContainer, viewFields, {}, function( error, data ) {
			if ( error ) {
				callback( error );
				return;
			}

			if ( data.test.length !== 1 ) {
				callback( new Error( 'Wrong amount of deleted documents' ) );
			}

			callback( null, data );
		} );
	},

	'Check view deletion': function( callback ) {
		console.log( 'Check view deletion' );

		View.ProcessRequest( 'test', 'find', {queries: {}, count: true}, flexoContainer, viewFields, {}, function( error, data, count ) {
			if ( error ) {
				callback( error );
				return;
			}

			if ( data.test.length !== 2 || data.test_join.length !== 2 ) {
				callback( new Error( 'Wrong amount of deleted documents' ) );
				return;
			}

			callback( null, {data: data, count: count} );
		} );
	},

	'Get template': function( callback ) {
		console.log( 'Get template' );

		View.GetTemplate( 'test', {find: viewFields, insert: viewFields, modify: viewFields, delete: viewFields}, {}, function( error, template, config ) {
			if ( error ) {
				callback( error );
				return;
			}

			if ( template === undefined ) {
				callback( new Error( 'No template' ) );
				return;
			}
			if ( config === undefined ) {
				callback( new Error( 'No config' ) );
				return;
			}

			callback( null, {template: template, config: config} );
		} );
	}
};

async.series( tasks, function( error, results ) {
	console.log( 'Результаты:', results );

	if ( error ) {
		console.log( 'Ошибка:', error );
	} else {
		console.log( 'Тест пройден' );
	}

	process.kill();
} );
