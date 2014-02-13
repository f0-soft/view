'use strict';

module.exports = exports = [
	['node', true, 'o', [
		['_vid', false, 'o', [
			['id', true, 's'],
			['data', false, 'o', [
				['type', true, 's'],
				['service', false, 's'],
				['methods', false, 'o', [
					['find', false, 's'],
					['insert', false, 's'],
					['modify', false, 's'],
					['delete', false, 's']
				]],
				['source', false, 'a', [
					['table', true, 's'],
					['field', true, 's'],
					['root_field', false, 's']
				]]
			]],
			['title', false, 's'],
			['description', false, 's']
		]]
	]]
];
