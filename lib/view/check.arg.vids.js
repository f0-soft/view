'use strict';

// предварительные данные о viewId извне

module.exports = [
	['vids', true, 'o', [
		'*', false, 'o', [ // названия схем view
			'*', false, 'o', [ // названия viewId
				['service', false, 's'],
				['methods', false, 'o', [
					['find', false, 's'],
					['insert', false, 's'],
					['modify', false, 's'],
					['delete', false, 's']
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
