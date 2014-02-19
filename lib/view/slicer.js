'use strict';

var argstype = require( 'f0.argstype' );
var traverse = require( 'traverse' );



function myErr( text ) {
	return (new Error( 'f0.view.config-slicer: ' + text ));
}

var checks = {};



var Slicer = function( settings ) {
	this._stopKey = settings.stopKey || '_vid';
	this._idKey = settings.idKey || 'id';
};



checks.slice = argstype.getChecker( myErr, [
	['config', true, 'o'],
	['vids', true, 'a', [
		'*', false, 's'
	]]
] );
Slicer.prototype.slice = function( config, vids ) {
	var self = this;
	var errType = checks.slice( arguments );
	var clone, vidDict, allowedVids;

	if ( errType ) { throw errType; }

	// словарь vid
	vidDict = {};
	for ( var i = 0; i < vids.length; i += 1 ) {
		vidDict[ vids[i] ] = true;
	}

	allowedVids = [];
	clone = traverse( config ).map( function( node ) {
		if ( !node[self._stopKey] ) { return; }

		if ( !vidDict[ node[self._stopKey][self._idKey] ] ) {
			this.remove( true );  // удаление с остановкой углубления
			return;
		}

		allowedVids.push( node[self._stopKey][self._idKey] );
		delete node[self._stopKey];
	} );

	return { config: clone, vids: allowedVids};
};



module.exports = exports = Slicer;
