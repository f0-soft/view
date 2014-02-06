'use strict';

//TODO: Модуль для доступа к сервисам: flexo, mailer, autopilot, etc.

//TODO: модуль node.js может содержать в себе как клиент, так сервер сервиса
// соответствующий компонент должен возвращаться функцией, которая внутри совершает необходимый require

// сервис должен предоставлять следующую информацию о себе:
// - методы;
// - описание, как можно сузить запрос по пользователю и/или компании, если это возможно.
// проверка структуры запроса - задача самого сервиса
// методы сервиса должны реализовывать интерфейс function(request, callback)
// методы сервиса должны работать с коллбеком с интерфейсом function(error, result)
// сервис не должен реализовывать методы-обертки для обращения к другим своим методам (как mailer.do)
// сервис может не реализовывать методы find, insert, modify, delete 
// если сервис реализует метод find, insert, modify, delete, то этот метод должен работать так же, как у flexo

// сервис должен подключаться посредством конфигурационного файла
// в файле должны быть перечислены методы, на использование которых подписывается Модуль

// на основе полученных описаний Модуль должен предоставлять доступ к методам сервисов


// Инициализация
// - подключение к сервисам
// - запрос сведений о сервисах

// Обработка команды на запрос к сервису
// - проверить запрос правилом проверки вызовов
// - совершить запрос к сервису
// - проверить ответ от сервиса
// - вернуть результат запроса

// пример интерфейса клиента к сервису
var MockService = {
	methods: {
		find: function() {},
		insert: function() {},
		modify: function() {},
		delete: function() {},
		edit: function() {},
		draft: function() {},
		attach: function() {}
	},
	info: { // это описание использует Модуль для проверки расстановки сужений по пользователю/компании
		edit: { // название метода
			user: { // описание сужения по пользователю
				path: 'req.*.user', // путь по которому параметр должен быть указан в запросе, поддерживаются
				required: true // обязательно ли указание параметра
			},
			company: { // аналогичное описание для компании
				path: 'company'
			}
		}
	}
};

// правило проверки сигнатуры клиента, должно использоваться Модулем
var serviceInfoCheck = [
	['service', true, 'o', [
		['methods', true, 'o', [
			'*', true, 'f' // сервис должен реализовывать хотя бы один метод
		]],
		['info', true, 'o', [
			'*', true, 'o', [ // сервис должен предоставлять описание хотя бы для одного метода
				// описание может быть пустым, если запрос не предусматривает указание пользователя/компании
				['user', false, 'o', [
					['path', true, 's'],
					['required', false, 'b']
				]],
				['company', false, 'o', [
					['path', true, 's'],
					['required', false, 'b']
				]]
			]
		]]
	]]
];

// пример конфига подключения сервиса к Модулю
var MockServiceConnection = {
	name: 'MockService', // название под которым сервис будет фигурировать в схемах view
	module: 'f0.MockService', // название клиента сервиса, подключаемого через require
	config: { // настройки подключения клиента сервиса к сервису
		host: 'localhost',
		port: 1337
	},
	subscribe: { // перечень методов, на использование которых подписывается Модуль
		edit: true
	}
};



var argstype = require( 'f0.argstype' );
var next = require( 'nexttick' );



function nextErr( cb, text, vars ) {
	return next( cb, myErr( text, vars ) );
}
function myErr( text, vars ) {
	if ( vars ) { text = renderTemplate( text, vars ); }
	return new Error( 'f0.view.service-client: ' + text );
}
function renderTemplate( tpl, vars ) {
	var out = tpl;
	var keys = Object.keys( vars );

	for ( var i = 0; i < keys.length; i += 1 ) {
		out = out.replace( new RegExp( '{{' + keys[i] + '}}', 'g' ), vars[ keys[i] ] );
	}

	return out;
}

var checks = {};

var STATE = {};
STATE.ONLINE = 'online';
STATE.OFFLINE = 'offline';
STATE.CONNECTING = 'connecting';
STATE.DISCONNECTING = 'disconnecting';



// Конструктор экземпляра
var ServiceClient = function( config ) {
	//TODO: получить конфиги клиентов
	//TODO: подключить клиенты
	this._config = config;
	this._services = {};
	this._defaultService = config.defaultService;
	this.state = STATE.OFFLINE;
};



ServiceClient.prototype.start = function( cb ) {
	if ( this.state !== STATE.OFFLINE ) { return nextErr( cb, 'клиент болжен быть остановлен, текущее состояние: {{state}}', {state: this.state} ); }
	//TODO: запустить клиенты
};



ServiceClient.prototype.stop = function( cb ) {
	if ( this.state !== STATE.ONLINE ) { return nextErr( cb, 'клиент болжен быть запущен, текущее состояние: {{state}}', {state: this.state} ); }
	//TODO: остановить клиенты
};



// правило проверки аргументов вызова Модуля
checks.x = argstype.getChecker( myErr, [
	['request', true, 'o', [
		['service', false, 's'],
		['method', true, 's'],
		['query', true, 'o'],
		['access', true, 'o', [
			['user', false, 's'],
			['company', true, 's'],
			['role', true, 's']
		]]
	]],
	['callback', true, 'f']
] );
// ключевой метод Модуля
ServiceClient.prototype.x = function( req, cb ) {
	var errType = checks.x( arguments );

	if ( errType ) { return next( cb, errType ); }

	req.service = req.service || this._defaultService;

	if ( !this._services[req.service] ) { return nextErr( cb, 'сервис `{{svc}}` не найден', {svc: req.service} ); }
	if ( !this._services[req.service][req.method] ) { return nextErr( cb, 'метод `{{svc}}.{{mtd}}` не найден', {svc: req.service, mtd: req.method} ); }

	//TODO: подстановка обязательных параметров руководствуясь правилами сервиса
	req.query.user = req.access.user;
	req.query.company = req.access.company;

	this._services[req.service][req.method]( req.query, cb );
};



function init( config, cb ) {
	var SC;
	config.defaultService = config.defaultService || 'flexo';

	try {
		SC = new ServiceClient( config );
	} catch ( e ) {
		return nextErr( cb, e.message );
	}

	return next( cb, SC );
}



exports.init = init;
