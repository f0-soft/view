'use strict';

var next = require( 'nexttick' );



var ME = 'getTemplate';

exports.check = [
	['name', true, 's'],
	['vids', true, 'a', [
		'*', false, 's'
	]],
	['callback', true, 'f']
];

exports.method = function( name, vids, cb ) {
	var self = this;

	self._log( ME, arguments );
	var errType = self._check[ME]( arguments );
	var template, res;

	if ( errType ) { return next( cb, errType ); }
	if ( !self._views[name] ) { return self._nextError( cb, 'не существует view `{{n}}`', {n: name} ); }

	// slice config - get user config
	// gather remaining vids in config
	try {
		res = self._slicer.slice( self._views[name].config, vids );
	} catch ( e ) {
		return self._nextError( cb, e.message );
	}

	// load template
	// process template with config
	return self._loadTemplate( name, function( err, processor ) {
		if ( err ) {
			return self._nextError( cb, 'не удалось загрузить шаблон `{{n}}`: {{e}}', {n: name, e: err.message} );
		}

		try {
			template = processor( res.config );
		} catch ( e ) {
			return self._nextError( cb, 'внутренняя ошибка шаблона: {{e}}', {e: e.message} );
		}

		return cb( null, res.vids, res.config, template );
	} );
};
