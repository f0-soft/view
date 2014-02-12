'use strict';

module.exports = exports = [
	['view', true, 'o', [
		['name', true, 's'],
		['template', false, 's'],
		['service', false, 's'],
		['methods', false, 'o', [
			'*', false, 'o', [ // любой сервис
				['find', false, 's'],
				['insert', false, 's'],
				['modify', false, 's'],
				['delete', false, 's']
			]
		]],
		['config', true, 'o'],
		['join', false, 'o', [
			'*', false, 'o'
		]],
		['access', false, 'o', [
			['find', false, 'o', [
				'*', false, 'o' // любая роль
			]],
			['insert', false, 'o', [
				'*', false, 'o', [ // любая роль
					['data', true, 'o'],
					['lazy', false, 'b']
				]
			]]
		]]
	]]
];
