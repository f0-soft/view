'use strict';

var ME = '_compileVidsRoots';

exports.check = [];

exports.method = function() {
	var self = this;
	var srcVids = self._vids;
	var out = {};
	var view, id, i, j, k, node, root;
	var methods = ['find', 'insert', 'modify', 'delete'];

	view = Object.keys( srcVids );



	// сборка vids: сервис и методы
	for ( i = 0; i < view.length; i += 1 ) {
		out[ view[i] ] = {};

		id = Object.keys( srcVids[ view[i] ] );

		for ( j = 0; j < id.length; j += 1 ) {
			node = out[ view[i] ][ id[j] ] = {
				service: '',
				methods: {
					find: '',
					insert: '',
					modify: '',
					delete: ''
				},
				source: srcVids[ view[i] ][ id[j] ].source.slice( 0 )
			};

			node.service = srcVids[ view[i] ][ id[j] ].service
				|| self._views[ view[i] ].service
				|| self._defaultService;

			for ( k = 0; k < methods.length; k += 1 ) {
				if ( srcVids[ view[i] ][ id[j] ].methods ) {
					if ( srcVids[ view[i] ][ id[j] ].methods[ methods[k] ] ) {
						node.methods[ methods[k] ] = srcVids[ view[i] ][ id[j] ].methods[ methods[k] ];
						continue;
					}
				}

				if ( self._views[ view[i] ].methods ) {
					if ( self._views[ view[i] ].methods[ node.service ] ) {
						if ( self._views[ view[i] ].methods[ node.service ][ methods[k] ] ) {
							node.methods[ methods[k] ] = self._views[ view[i] ].methods[ node.service ][ methods[k] ];
							continue;
						}
					}
				}

				if ( self._services[ node.service ] ) {
					if ( self._services[ node.service ][ methods[k] ] ) {
						node.methods[ methods[k] ] = self._services[ node.service ][ methods[k] ];
						continue;
					}
				}

				node.methods[ methods[k] ] = methods[k];
			}
		}
	}

	self._vids = out;



	// поиск корней
	for ( i = 0; i < view.length; i += 1 ) {
		root = undefined;

		id = Object.keys( out[ view[i] ] );
		for ( j = 0; j < id.length; j += 1 ) {
			if ( !root ) { // поиск корня
				if ( out[ view[i] ][ id[j] ].source.length === 2 ) {
					root = id[j];
				}
			} else { // поиск второго корня
				if ( out[ view[i] ][ id[j] ].source.length === 2 ) {
					if ( out[ view[i] ][ id[j] ].service !== out[ view[i] ][root].service // сервис
						|| out[ view[i] ][ id[j] ].source[0] !== out[ view[i] ][root].source[0] ) { // таблица

						throw self._error(
							'найдено более 1 корня в схеме `{{v}}`: vid `{{root}}` и vid `{{second}}`',
							{v: view[i], root: root, second: id[j]}
						);
					}
				}
			}
		}

		if ( !root ) { throw self._error( 'не удалось обнаружить корень в схеме `{{v}}`', {v: view[i]} ); }

		self._views[ view[i] ].root = {
			service: out[ view[i] ][ root ].service,
			table: out[ view[i] ][ root ].source[0]
		};
	}
};
