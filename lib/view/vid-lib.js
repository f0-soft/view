'use strict';

var VID_LINK = '_link';

exports.vidByProp = function( prop, vids, dict ) {
	var i;

	for ( i = 0; i < vids.length; i += 1 ) {
		if ( dict[ vids[i] ][1] === prop ) {
			return vids[i];
		}
	}

	return undefined;
};

exports.vidsOfFlexo = function( dict, vids, flexo, field ) {
	var i, res = [];

	if ( field !== undefined ) {
		for ( i = 0; i < vids.length; i += 1 ) {
			if ( dict[vids[i]][0] === flexo && dict[vids[i]][2] === field ) {
				res.push( vids[i] );
			}
		}
	} else {
		for ( i = 0; i < vids.length; i += 1 ) {
			if ( dict[vids[i]][0] === flexo ) {
				res.push( vids[i] );
			}
		}
	}

	return res;
};

exports.fieldsOfFlexo = function( flexo, vids, dict ) {
	var i, res = [];
	for ( i = 0; i < vids.length; i += 1 ) {
		if ( dict[vids[i]][0] === flexo && res.indexOf( dict[vids[i]][1] ) === -1 ) {
			res.push( dict[vids[i]][1] );
		}
	}

	return res;
};

exports.nestVidsFromData = function( vids, dict, data_in, data_out ) {
	var i, j;
	data_out = Array.isArray( data_out ) ? data_out : [];

	for ( i = 0; i < data_in.length; i += 1 ) {
		if ( data_out[i] === undefined ) {
			data_out[i] = {};

			if ( data_in[i][VID_LINK] !== undefined ) {
				data_out[i][VID_LINK] = data_in[i][VID_LINK];
			}
		}

		for ( j = 0; j < vids.length; j += 1 ) {
			data_out[i][ vids[j] ] = data_in[i][ dict[vids[j]][1] ];
		}
	}

	return data_out;
};
