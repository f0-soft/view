'use strict';

module.exports = [
	['vids', true, 'o', [
		'*', false, 'o', [ // названия схем view
			'*', false, 'o', [ // названия viewId
				['service', true, 's'],
				['methods', true, 'o', [
					['find', true, 's'],
					['insert', true, 's'],
					['modify', true, 's'],
					['delete', true, 's']
				]],
				['source', true, 'o', [
					['table', true, 's'],
					['field', true, 's'],
					['rootField', false, 's'],
					['path', false, 's']
				]]
			]
		]
	]]
];
