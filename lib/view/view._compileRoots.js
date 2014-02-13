'use strict';

var ME = '_compileRoots';

exports.check = [];

exports.method = function() {
	var self = this;
	var src = self._vids;
	var out = {};
	var view, id, i, j, node, root;

	view = Object.keys( src );



	// поиск корней
	for ( i = 0; i < view.length; i += 1 ) {
		root = undefined;

		id = Object.keys( src[ view[i] ] );
		for ( j = 0; j < id.length; j += 1 ) {
			node = src[ view[i] ][ id[j] ];

			if ( !root ) { // поиск корня
				if ( !node.source.rootField && !node.source.path ) {
					root = id[j];
				}
			} else { // поиск второго корня
				if ( !node.source.rootField && !node.source.path ) {
					if ( node.service !== src[ view[i] ][root].service // сервис
						|| node.source.table !== src[ view[i] ][root].source.table ) { // таблица

						throw self._error(
							'найдено более 1 корня в схеме `{{v}}`: vid `{{root}}` и vid `{{second}}`',
							{v: view[i], root: root, second: id[j]}
						);
					}
				}
			}
		}

		if ( !root ) { throw self._error( 'не удалось обнаружить корень в схеме `{{v}}`', {v: view[i]} ); }

		out[ view[i] ] = {
			service: src[ view[i] ][ root ].service,
			table: src[ view[i] ][ root ].source.table
		};
	}


	return out;
};
