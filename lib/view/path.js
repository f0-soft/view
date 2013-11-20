'use strict';

exports.removeDuplicates = function( data ) {
	var i, res = [];
	for ( i = 0; i < data.length; i += 1 ) {
		if ( res.indexOf( data[i] ) === -1 ) {
			res.push( data[i] );
		}
	}
	return res;
};
