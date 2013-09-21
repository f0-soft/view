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
	var outConfig = {};
	var oVid = [];
	var queue = [], path, configNode, outNode, child, i;

	if ( errType ) {
		throw errType;
	}

	// here i should go in width over config and search _vid fields manually
	child = Object.keys( config );
	for ( i = 0; i < child.length; i += 1 ) {
		queue[queue.length] = [child[i]];
	}
	while ( queue.length > 0 ) {
		path = queue.shift();

		// get to config node
		configNode = config;
		for ( i = 0; i < path.length; i += 1 ) {
			configNode = configNode[path[i]];
		}

		// check _vid
		if ( configNode._vid !== undefined ) {
			if ( vids.indexOf( configNode._vid ) === -1 ) {
				continue;
			} else {
				oVid.push( configNode._vid );
			}
		}

		// get close to out node
		outNode = outConfig;
		for ( i = 0; i < path.length - 1; i += 1 ) {
			outNode = outNode[path[i]];
		}

		// prepare container
		if ( Array.isArray( configNode ) ) {
			outNode[path[path.length - 1]] = [];
		} else if ( typeof configNode === 'object' ) {
			outNode[path[path.length - 1]] = {};
		} else {
			throw myErr( 'Unsupported type on path: ' + JSON.stringify( path ) );
		}

		// get into container
		outNode = outNode[path[path.length - 1]];

		// clone properties
		child = Object.keys( configNode );
		for ( i = 0; i < child.length; i += 1 ) {
			if ( settings.stopNames.indexOf( child[i] ) === -1 ) {
				if ( settings.copyTypes.indexOf( typeof configNode[child[i]] ) !== -1 ) {
					outNode[child[i]] = configNode[child[i]];
				} else {
					queue[queue.length] = path.concat( child[i] );
				}
			}
		}
	}

	return { config: outConfig, vids: oVid};
}



checks.getSlicer = argstype.getChecker( myErr, [
	['settings', true, 'o', [
		['stopNames', true, 'a', [
			'*', false, 's'
		]],
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
