'use strict';

var argstype = require( 'f0.argstype' );
var next = require( 'nexttick' );
var Slicer = require( './config-slicer' ).Slicer;



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
	this._doc = options.doc || this._doc;
	this._access = options.access || this._access;

	this._provider = options.provider || this._provider;
	this._views = options.views || this._views;
	this._paths = options.paths || this._paths;
	this._alias = options.provider_alias || this._alias;

	this._templatePath = options.templatePath || this._templatePath;
	this._templateTimeout = options.templateTimeout || this._templateTimeout;
	this._slicerSettings = options.slicerSettings || this._slicerSettings;

	// контейнеры для данных
	this._templates = {}; // object of [template, timestamp]
	this._templateNames = [];

	this._slicer = new Slicer( options.slicer || this._slicerSettings );
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
View.prototype._provider = {};
View.prototype._views = {};
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
var methods = ['find', 'insert', 'modify', 'delete', 'getTemplate', '_loadTemplate'];
var req;

for ( var i = 0; i < methods.length; i += 1 ) {
	req = require( './view.' + methods[i] );
	View.prototype[ methods[i] ] = req.method;
	View.prototype._check[ methods[i] ] = argstype.getChecker( View.prototype._error, req.check );
}



module.exports = exports = View;
