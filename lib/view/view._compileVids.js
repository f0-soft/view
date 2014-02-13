'use strict';

var ME = '_compileVids';

exports.check = [];

// правило определения сервиса vid:
// vid.service -> scheme.defaultService -> view.defaultService
//
// правило определения названия метода для операции find (и других): 
// vid.methods.find -> scheme.methods.service.find -> view.service.find -> 'find'
exports.method = function() {
	var self = this;
	var src = self._vids;
	var out = {};
	var view, id, i, j, k, node;
	var methods = ['find', 'insert', 'modify', 'delete'];
	var source = ['table', 'field', 'rootField', 'path'];

	view = Object.keys( src );



	// сборка vids: сервис и методы
	for ( i = 0; i < view.length; i += 1 ) {
		out[ view[i] ] = {};

		id = Object.keys( src[ view[i] ] );

		for ( j = 0; j < id.length; j += 1 ) {
			node = out[ view[i] ][ id[j] ] = {
				service: '',
				methods: {
					find: '',
					insert: '',
					modify: '',
					delete: ''
				},
				source: {}
			};

			// service
			node.service = src[ view[i] ][ id[j] ].service
				|| self._views[ view[i] ].service
				|| self._defaultService;

			// methods
			for ( k = 0; k < methods.length; k += 1 ) {
				if ( src[ view[i] ][ id[j] ].methods ) {
					if ( src[ view[i] ][ id[j] ].methods[ methods[k] ] ) {
						node.methods[ methods[k] ] = src[ view[i] ][ id[j] ].methods[ methods[k] ];
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

			// source
			for ( k = 0; k < source.length; k += 1 ) {
				if ( src[ view[i] ][ id[j] ].source[ source[k] ] ) {
					node.source[ source[k] ] = src[ view[i] ][ id[j] ].source[ source[k] ];
				}
			}
		}
	}



	return out;
};
