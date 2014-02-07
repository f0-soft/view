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



var argstype = require( 'f0.argstype' );
var next = require( 'nexttick' );
var async = require( 'async' );



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



var STATE = {};
STATE.ONLINE = 'online';
STATE.OFFLINE = 'offline';
STATE.CONNECTING = 'connecting';
STATE.DISCONNECTING = 'disconnecting';

var checks = {};

var INSTANCE;



// правило проверки сигнатуры клиента, должно использоваться Модулем
checks.service = argstype.getChecker( myErr, [
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
		]],
		['close', true, 'f']
	]]
] );

// Конструктор экземпляра
checks.ServiceClient = argstype.getChecker( myErr, [
	['options', false, 'o']
] );
var ServiceClient = function( options ) {
	this._options = options;
	this._configs = []; // массив объектов конфигов клиентов
	this._services = { // объект с запущенными клиентами и информацией по ним
		mock: {
			client: {},
			subscribe: {},
			replace: {}
		}
	};
	this._defaultService = options.defaultService;
	this.state = STATE.OFFLINE;

	//TODO: получить конфиги клиентов
	//TODO: подключить клиенты
	// Инициализация
	// - подключение к сервисам
	// - запрос сведений о сервисах
};



ServiceClient.prototype.start = function( cb ) {
	if ( this.state !== STATE.OFFLINE ) { return nextErr( cb, 'клиент болжен быть остановлен, текущее состояние: {{state}}', {state: this.state} ); }

	//TODO: запустить клиенты
	// - init клиента
	// - проверка наличия у клиента методов из подписки
	// - запрос у клиента правил подстановки
	// - сохранение клиента, подписки и подстановок под заданным именем
	async.map( this._configs, function( item, cb ) {
		
	}, function( err, res ) {

	} );
};



ServiceClient.prototype.stop = function( cb ) {
	var keys;

	if ( this.state !== STATE.ONLINE ) { return nextErr( cb, 'клиент болжен быть запущен, текущее состояние: {{state}}', {state: this.state} ); }

	//TODO: остановить клиенты
	keys = Object.keys( this._services );
	for ( var i = 0; i < keys.length; i += 1 ) {
		this._services[ keys[i] ].close();
	}

	return next( cb, null );
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



checks.init = argstype.getChecker( myErr, [
	['options', true, 'o', [
		['defaultService', false, 's'],
		['pathClientConfig', true, 's']
	]],
	['callback', true, 'f']
] );
function init( options, cb ) {
	if ( INSTANCE ) { return next( cb, INSTANCE ); }

	options.defaultService = options.defaultService || 'flexo';

	try {
		INSTANCE = new ServiceClient( options );
	} catch ( e ) {
		return nextErr( cb, e.message );
	}

	return next( cb, INSTANCE );
}



module.exports = exports = init;
