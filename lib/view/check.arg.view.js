'use strict';

module.exports = exports = [
	['view', true, 'o', [
		['name', true, 's'],
		['template', false, 's'],
		['service', true, 's'],
		['methods', true, 'o', [
			'*', false, 'o', [ // любой сервис
				['find', false, 's'],
				['insert', false, 's'],
				['modify', false, 's'],
				['delete', false, 's']
			]
		]],
		['config', true, 'o'],
		['aux', true, 'o', [
			'*', false, 'o'
		]],
		['access', true, 'o', [
			['find', true, 'o', [
				'*', false, 'o' // любая роль
			]],
			['insert', true, 'o', [
				'*', false, 'o', [ // любая роль
					['data', true, 'o'],
					['lazy', false, 'b']
				]
			]]
		]]
	]]
];
