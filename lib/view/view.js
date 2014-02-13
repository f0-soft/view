'use strict';

var argstype = require( 'f0.argstype' );
var next = require( 'nexttick' );
var Slicer = require( './config-slicer' ).Slicer;
var und = require( 'underscore' );



//TODO: вынести в отдельный модуль или подключить другой шаблонизатор
// функция шаблонизации, работает как `handlebars.js`
// заменяет в шаблоне подстроки вида `{{ name }}` на значения из справочника
// tpl - строка шаблона
// vars - объект значений
function render( tpl, vars ) {
	var out = tpl;
	var keys = Object.keys( vars );

	for ( var i = 0; i < keys.length; i += 1 ) {
		out = out.replace( new RegExp( '{{ *' + keys[i] + ' *}}', 'g' ), vars[ keys[i] ] );
	}

	return out;
}



// конструктор
var View = function( options ) {
	// копирование настроек
	if ( options.doc ) { this._doc = und.extend( {}, this._doc, options.doc ); }
	if ( options.access ) { this._access = und.extend( {}, this._access, options.access ); }

	if ( options.provider ) { this._provider = options.provider; }
	if ( options.defaultService ) { this._defaultService = options.defaultService; }
	if ( options.services ) { this._services = options.services; }
	if ( options.views ) { this._views = options.views; } // перечень схем view
	if ( options.vids ) { this._vids = options.vids; }
	if ( options.paths ) { this._paths = options.paths; }
	if ( options.provider_alias ) { this._alias = options.provider_alias; }

	if ( options.templatePath ) { this._templatePath = options.templatePath; }
	if ( options.templateTimeout ) { this._templateTimeout = options.templateTimeout; }
	if ( options.slicerSettings ) { this._slicerSettings = und.extend( {}, this._slicerSettings, options.slicerSettings ); }

	// создание контейнеров контейнеры для данных
	this._roots = {};
	this._templates = {}; // кеш функций шаблонизации вида [template, timestamp]
	this._templateNames = [];

	// компиляция настроек
	this._vids = this._compileVids();
	this._roots = this._compileRoots();

	// подключение компонентов
	this._slicer = new Slicer( this._slicerSettings );
};



// справочные константы и значения по умолчанию
View.prototype._doc = {
	ID: '_id',
	UPDATE: 'tsUpdate',
	CREATE: 'tsCreate'
};
View.prototype._access = {
	ALL: '*',
	USER: '%user_id%',
	COMPANY: '%company_id%'
};
View.prototype._provider = {}; // объект предоставляющий доступ к методам сервисов
View.prototype._defaultService = 'flexo';
View.prototype._services = {}; // справочник методов по умолчанию для сервисов
View.prototype._views = {};
View.prototype._vids = {};
View.prototype._paths = {};
View.prototype._alias = {};
View.prototype._check = {};
View.prototype._templatePath = '';
View.prototype._templateTimeout = 5 * 60 * 1000; // 5 минут в миллисекундах
View.prototype._slicerSettings = {
	stop: ['_vid'],
	copy: ['string', 'number', 'boolean']
};



// ошибки и логирование
View.prototype._error = function _error( text, vars ) {
	if ( vars ) { text = render( text, vars ); }
	return new Error( 'f0.view: ' + text );
};
View.prototype._nextError = function _nextError( cb, text, vars ) {
	return next( cb, this._error( text, vars ) );
};
View.prototype._log = function() {};

if ( process.env.DEBUG && process.env.DEBUG.indexOf( 'view' ) !== -1 ) {
	View.prototype._log = function log() {
		arguments[0] = 'DEBUG f0.view.' + arguments[0] + ':';
		console.log.apply( console, arguments );
	};
}



// подключение методов класса
var methods = ['find', 'insert', 'modify', 'delete', 'getTemplate'] // публичные
	.concat( ['_loadTemplate', '_compileVids', '_compileRoots'] ); // служебные
var req;

for ( var i = 0; i < methods.length; i += 1 ) {
	req = require( './view.' + methods[i] );
	View.prototype[ methods[i] ] = req.method;
	View.prototype._check[ methods[i] ] = argstype.getChecker( View.prototype._error, req.check );
}



module.exports = exports = View;
