'use strict';

var next = require( 'nexttick' );



var ME = 'delete';

exports.check = [
	['request', true, 'o', [
		['name', true, 's'],
		['request', true, 'a', [
			['*', true, 'o']
		]]
	]],
	['callback', true, 'f']
];

exports.method = function( request, cb ) {
	this._log( ME, arguments );
	var self = this;
	var errType = self._check[ME]( arguments );
	var root, keys;
	var vid_id, vid_update;
	var docs = [];

	if ( errType ) { return next( cb, errType ); }
	if ( !self._views[ request.name ] ) { return self._nextError( cb, 'запрошенная view не существует: `{{v}}`', {v: request.name} ); }

	root = self._roots[ request.name ];
	keys = Object.keys( self._vids[ request.name ] );
	for ( var k = 0; k < keys.length; k += 1 ) {
		if ( self._vids[ keys[k] ].service !== root.service ) { continue; }
		if ( self._vids[ keys[k] ].methods[ME] !== root.methods[ME] ) { continue; }
		if ( self._vids[ keys[k] ].source.table !== root.source.table ) { continue; }

		if ( self._vids[ keys[k] ].source.field === self._doc.ID ) {
			vid_id = keys[k];
		}
		if ( self._vids[ keys[k] ].source.field === self._doc.UPDATE ) {
			vid_update = keys[k];
		}
	}

	for ( var i = 0; i < request.request.length; i += 1 ) {
		docs[i] = {};
		docs[i][ self._doc.ID ] = request.request[i][vid_id];
		docs[i][ self._doc.UPDATE ] = request.request[i][vid_update];
	}

	return self._provider.request( {
		service: root.service,
		method: root.methods[ME],
		request: {
			table: root.source.table,
			query: docs
		}
	}, function( err, res ) {
		if ( err ) { return cb( err ); }

		//TODO: преобразовать результат если надо
		return cb( null, res );
	} )
};
