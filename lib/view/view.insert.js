'use strict';

var next = require( 'nexttick' );



var ME = 'insert';

exports.check = [
	['request', true, 'o', [
		['name', true, 's'],
		['vids', true, 'a', 's'],
		['request', true, 'a', 'o'],
		['access', true, 'o', [
			['company_id', true, 's'],
			['user_id', true, 's'],
			['role', true, 's']
		]]
	]],
	['callback', true, 'f']
];

exports.method = function( request, cb ) {
	this._log( ME, arguments );
	var self = this;
	var errType = self._check[ME]( arguments );
	var rules, reqAccess, access, keys, vid;
	var val, insertion = [];
	var docs = [];
	var root;

	if ( errType ) { return next( cb, errType ); }
	if ( !self._views[request.name] ) { return self._nextError( cb, 'запрошенная view не существует: `{{v}}`', {v: request.name} ); }

	// подготовка дополнительных параметров
	rules = self._views[ request.name ].access[ME];
	if ( rules ) {
		reqAccess = request.access;
		access = rules[reqAccess.role] || rules[self._access.ALL] || { data: {} };

		keys = Object.keys( access.data );
		for ( var i = 0; i < keys.length; i += 1 ) {
			val = access.data[ keys[i] ];
			if ( val === self._access.USER ) { val = reqAccess.user_id; }
			if ( val === self._access.COMPANY ) { val = reqAccess.company_id; }

			insertion.push( {
				lazy: access.lazy,
				key: keys[i],
				value: val
			} );
		}
	}

	// преобразование документов
	root = self._roots[ request.name ];
	for ( var j = 0; j < request.request.length; j += 1 ) {
		docs[j] = {};

		// копирование занчений из запроса
		keys = Object.keys( request.request[j] );
		for ( var k = 0; k < keys.length; k += 1 ) {
			vid = self._vids[ request.name ][ keys[k] ];
			if ( !vid ) { return self._nextError( cb, 'в запросе использован несуществующий vid: `{{v}}.{{id}}`', {v: request.name, id: keys[k]} ); }

			if ( vid.service !== root.service
				|| vid.methods[ME] !== root.methods[ME]
				|| vid.source.table !== root.source.table ) {
				return self._nextError( cb, 'в запросе использован некорневой vid: `{{v}}.{{id}}`', {v: request.name, id: keys[k]} );
			}

			docs[j][ vid.source.field ] = request.request[j][ keys[k] ];
		}

		// подстановка значений по умолчанию
		for ( var z = 0; z < insertion.length; z += 1 ) {
			if ( !insertion[z].lazy || docs[j][ insertion[z].key ] === undefined ) {
				docs[j][ insertion[z].key ] = insertion[z].value;
			}
		}
	}

	return self._provider.request( {
		service: root.service,
		method: root.methods[ME],
		request: {
			table: root.source.table,
			query: docs,
			fields: [ self._doc.ID, self._doc.UPDATE ] //TODO: проверить набор полей
		}
	}, function( err, res ) {
		if ( err ) { return cb( err ); }

		//TODO: преобразовать результат если надо
		return cb( null, res );
	} )
};
