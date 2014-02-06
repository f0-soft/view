'use strict';

// Сервис должен состоять из клиента и сервера
// Node.js-модуль Сервиса может содержать в себе Клиент и Сервер
// Для экономного подключения, модуль должен содержать функцию, которая внутри совершает необходимый require

// Интерфейс сервера в данном случае не интересен

// Интерфейс Клиента должен иметь следующие характеристики:
// 1. набор методов сервиса вида function(request, callback){}, где коллбек имеет вид function(error, result){};
// 2. описание мест вставки ID пользователя/компании в запросы, если возможно;
// 3. исходя из п.1 и п.2, в клиенте следует избегать функций-оберток над несколькими 
//       вида function(func_name, request, callback){}, поскольку это может затруднить создание правил из п.2;
// 4. если клиент имеет методы find, insert, modify, delete, то эти методы должны иметь сигнатуру как у методов flexo;
// 5. клиент может не предоставлять методы find, insert, modify, delete;
// 6. сервис должен проверять верность запросов, на сервере и/или на клиенте, на усмотрение разработчика;
// 7. метод close(), который приводит к остановке работы клиента.

// Для подключения Клиента сервиса к Модулю, требуется создание конфигурационного файла под каждый Клиент
// В таком файле должны присутствовать:
// 1. имя под которым сервис будет фигурировать в схемах view;
// 2. перечень методов которые должны быть доступны через Модуль;
// 3. функция запуска клиента вида function(callback){}



// пример интерфейса клиента
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
			'*', true, 'f' // клиент должен предоставлять хотя бы один метод сервиса
		]],
		['info', false, 'o', [
			'*', false, 'o', [ // описание может отсутствовать, тогда у метода нет параметра пользователь/компания
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
	// Инициализация
	// - подключение к сервисам
	// - запрос сведений о сервисах
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
	// Обработка команды на запрос к сервису
	// - проверить запрос правилом проверки вызовов
	// - совершить запрос к сервису
	// - проверить ответ от сервиса
	// - вернуть результат запроса
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
