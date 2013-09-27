'use strict';

var argstype = require( 'f0.argstype' );

var checks = {};



function myErr( text ) {
	return (new Error( 'f0.view.config-slicer: ' + text ));
}



checks.sliceConfig = argstype.getChecker( myErr, [
	['settings', true, 'o'],
	['config', true, 'o'],
	['vids', true, 'a', [
		'*', false, 's'
	]]
] );
function slice( settings, config, vids ) {
	var errType = checks.sliceConfig( arguments );
	var inConfig, outConfig = [null], oVid = [];
	var queue = [], path, child, i, container, elem;

	if ( errType ) {
		throw errType;
	}

	inConfig = [config];

	// for real, i should go in depth
	queue.push( [inConfig, 0, outConfig, 0] ); // in, in_key, out, out_key
	while ( queue.length > 0 ) {
		elem = queue.shift();

		if ( elem[0][elem[1]]._vid !== undefined ) {
			if ( vids.indexOf( elem[0][elem[1]]._vid ) === -1 ) {
				continue;
			}
			oVid.push( elem[0][elem[1]]._vid );
		}

		// create container
		if ( Array.isArray( elem[0][elem[1]] ) ) {
			container = [];

			// push tasks for array
			for ( i = elem[0][elem[1]].length - 1; i >= 0; i -= 1 ) {
				queue.unshift( [ elem[0][elem[1]], i, container, -1] );
			}
		} else if ( typeof elem[0][elem[1]] === 'object' ) {
			container = {};

			// push tasks for object
			child = Object.keys( elem[0][elem[1]] );
			for ( i = child.length - 1; i >= 0; i -= 1 ) {
				if ( settings.stopNames.indexOf( child[i] ) === -1 ) {
					queue.unshift( [ elem[0][elem[1]], child[i], container, child[i] ] )
				}
			}
		} else if ( settings.copyTypes.indexOf( typeof elem[0][elem[1]] ) !== -1 ) {
			container = elem[0][elem[1]];
		} else {
			throw myErr( 'тип не поддерживается, позиция в конфиге: ' + JSON.stringify( path ) );
		}

		// insert container
		if ( elem[3] === -1 ) { // into array
			elem[2].push( container );
		} else { // into object
			elem[2][elem[3]] = container;
		}
	}

	return { config: outConfig[0], vids: oVid};
}



checks.getSlicer = argstype.getChecker( myErr, [
	['settings', true, 'o', [
		['stopNames', true, 'a', 's'],
		['copyTypes', true, 'a', 's']
	]]
] );
function getSlicer( settings ) {
	var errType = checks.getSlicer( arguments );

	if ( errType ) {
		throw errType;
	}

	return ( slice.bind( null, settings ) );
}



module.exports = {
	slice: slice,
	getSlicer: getSlicer
};
