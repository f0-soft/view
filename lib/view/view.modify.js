'use strict';

var next = require( 'nexttick' );



var ME = 'modify';

exports.check = [
	['request', true, 'o', [
		['name', true, 's'],
		['request', true, 'a', [
			'*', true, 'o', [
				['selector', true, 'o'],
				['properties', true, 'o']
			]
		]]
	]],
	['callback', true, 'f']
];

exports.method = function( request, cb ) {
	this._log( ME, arguments );
	var self = this;
	var errType = self._check[ME]( arguments );
	var root, keys, vid;
	var vid_id, vid_update;
	var docs;

	if ( errType ) { return next( cb, errType ); }
	if ( !self._views[request.name] ) { return self._nextError( cb, 'запрошенная view не существует: `{{v}}`', {v: request.name} ); }

	root = self._roots[ request.name ];
	keys = Object.keys( self._vids[ request.name ] );
	for ( var k = 0; k < keys.length; k += 1 ) {
		if ( self._vids[ request.name ][ keys[k] ].service !== root.service ) { continue; }
		if ( self._vids[ request.name ][ keys[k] ].methods[ME] !== root.methods[ME] ) { continue; }
		if ( self._vids[ request.name ][ keys[k] ].source.table !== root.table ) { continue; }

		if ( self._vids[ request.name ][ keys[k] ].source.field === self._doc.ID ) {
			vid_id = keys[k];
		}
		if ( self._vids[ request.name ][ keys[k] ].source.field === self._doc.UPDATE ) {
			vid_update = keys[k];
		}
	}

	docs = [];
	for ( var i = 0; i < request.request.length; i += 1 ) {
		docs[i] = {
			selector: {},
			properties: {}
		};

		docs[i].selector[ self._doc.ID ] = request.request[i].selector[vid_id];
		docs[i].selector[ self._doc.UPDATE ] = request.request[i].selector[vid_update];

		keys = Object.keys( request.request[i].properties );
		for ( var j = 0; j < keys.length; j += 1 ) {
			vid = self._vids[ request.name ][ keys[j] ];
			if ( !vid ) { return self._nextError( cb, 'в запросе использован несуществующий vid: `{{v}}.{{id}}`', {v: request.name, id: keys[j]} ); }

			if ( vid.service !== root.service
				|| vid.methods[ME] !== root.methods[ME]
				|| vid.source.table !== root.table ) {
				return self._nextError( cb, 'в запросе использован некорневой vid: `{{v}}.{{id}}`', {v: request.name, id: keys[j]} );
			}

			docs[i].properties[ vid.source.field ] = request.request[i].properties[ keys[j] ];
		}
	}

	return self._provider.request( {
		service: root.service,
		method: root.methods[ME],
		request: {
			table: root.table,
			query: docs
		}
	}, function( err, res ) {
		var docs;
		if ( err ) { return cb( err ); }

		docs = [];
		for ( var i = 0; i < res.length; i += 1 ) {
			docs[i] = {};
			docs[i][vid_id] = res[i][self._doc.ID];
			docs[i][vid_update] = res[i][self._doc.UPDATE];
		}

		return cb( null, docs );
	} );
};
