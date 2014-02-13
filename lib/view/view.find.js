'use strict';

var async = require( 'async' );
var next = require( 'nexttick' );



var ME = 'find';

exports.check = [
	['request', true, 'o', [
		['name', true, 's'],
		['vids',true,'a','s'],
		['request', true,'o',[
			['selector', true, 'o', [
				'*', true, 'o'
			]],
			['options', false, 'o', [
				['count', false, 'b'],
				['sort', false, 'o', 'n'],
				['skip', false, 'n'],
				['limit', false, 'n']
			]]
		]],
		['access', true, 'o', [
			['company_id', true, 's'],
			['user_id', true, 's'],
			['role', true, 's']
		]]
	]],
	['callback', true, 'f']
];

exports.method = function( request, cb ) {
	this._log( 'find', arguments );
	var self = this;
	var errType = self._check[ME]( arguments );
	var tasks;

	if ( errType ) { return next( cb, errType ); }
	if ( !self._views[request.name] ) { return self._nextError( cb, 'не существует view `{{v}}`', {v: request.name} ); }

	tasks = [
		function( cb ) { //init job
			return next( cb, {
				instance: self,
				request: request
			} );
		},
		function( job, cb ) {
			return next( cb, job );
		}
	];

	async.waterfall( tasks, function( err, job ) {
		if ( err ) { return cb( err ); }
		return cb( null, job.res );
	} );

	return next( cb, null, {} );
};
