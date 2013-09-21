'use strict';

exports.findInPathOByI = function( path, collection, field, in_id ) {
	var i, res = [];
	for ( i = 0; i < path.length; i += 1 ) {
		if ( path[i].c === collection && path[i].f === field && path[i].i === in_id ) {
			res.push( path[i].o );
		}
	}
	res = removeDuplicates( res );
	return res;
};

exports.findInPathO = function( path, collection, field ) {
	var i, res = [];
	for ( i = 0; i < path.length; i += 1 ) {
		if ( path[i].c === collection && path[i].f === field ) {
			res.push( path[i].o );
		}
	}
	res = removeDuplicates( res );
	return res;
};

exports.findInPathI = function( path, collection, field ) {
	var i, res = [];
	for ( i = 0; i < path.length; i += 1 ) {
		if ( path[i].c === collection && path[i].f === field ) {
			res.push( path[i].i );
		}
	}
	res = removeDuplicates( res );
	return res;
};

var removeDuplicates = exports.removeDuplicates = function( data ) {
	var i, res = [];
	for ( i = 0; i < data.length; i += 1 ) {
		if ( res.indexOf( data[i] ) === -1 ) {
			res.push( data[i] );
		}
	}
	return res;
};
