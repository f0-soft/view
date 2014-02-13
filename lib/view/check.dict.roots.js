'use strict';

module.exports = [
	['roots', true, 'o', [
		'*', false, 'o', [ // названия схем view
			['service', true, 's'],
			['methods', true, 'o', [
				['find', true, 's'],
				['insert', true, 's'],
				['modify', true, 's'],
				['delete', true, 's']
			]],
			['table', true, 's']
		]
	]]
];
