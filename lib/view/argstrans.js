'use strict';

//TODO: переопределяемые значения по умолчанию

var traverse = require( 'traverse' );



// rules - объект правил
// objIn - объект исходного запроса (массив arguments)
// возвращает результат трансформации (массив arguments)
function transform( rules, objIn, objOut ) {
	if ( objOut ) {
		objOut = traverse.clone( objOut );
	} else {
		objOut = [];
	}
	objOut = traverse( objOut );
	objIn = traverse( objIn );

	rules = sortTransformRules( rules );

	for ( var i = 0; i < rules.length; i += 1 ) {
		applyRule( rules[i], objOut, objIn );
	}

	return objOut.value;
}

function applyRule( rule, trOut, trIn ) {
	var ruleKey = rule[0];
	var ruleValue = rule[1];

	// исполнение спецкоманды
	if ( specials[ ruleValue[0] ] ) {
		specials[ ruleValue[0] ]( ruleKey, ruleValue.substr( 1 ), trOut, trIn );
	} else { // копироване узла
		ruleValue = getPathArray( ruleValue );

		if ( trIn.has( ruleValue ) ) {
			trOut.set( ruleKey, traverse.clone( trIn.get( ruleValue ) ) );
		}
	}
}

var specials = {
	'@': function( ruleKey, ruleValue, trOut, trIn ) { // запуск спецкоманды
		if ( commands[ruleValue] ) {
			commands[ruleValue].apply( commands[ruleValue], arguments );
		}
	},
	'#': function( ruleKey, ruleValue, trOut, trIn ) { // подстановка значения из JSON
		trOut.set( ruleKey, JSON.parse( ruleValue ) );
	}
};

var commands = {
	del: function( ruleKey, ruleValue, trOut, trIn ) { // удаление узла
		delete trOut.get( ruleKey.slice( 0, -1 ) )[ ruleKey[ruleKey.length - 1] ];
	}
};

function sortTransformRules( rules ) {
	var keys = Object.keys( rules );
	var out = [];

	for ( var i = 0; i < keys.length; i += 1 ) {
		out[i] = [
			getPathArray( keys[i] ),
			rules[ keys[i] ]
		];
	}

	out = out.sort( pathCompare );

	return out;
}

function pathCompare( a, b ) {
	if ( a[0].length < b[0].length ) { return -1; }
	if ( a[0].length > b[0].length ) { return 1; }

	// equal key length, sort by name
	if ( a[0] < b[0] ) { return -1; }
	if ( a[0] > b[0] ) { return 1; }

	// impossible
	return 0;
}

function getPathArray( path ) {
	return path.split( '.' );
}

exports = module.exports = transform;



/*
 конфиг подключения сервиса

 может содержать:
 - правила или функции трансформации запроса view в запрос сервиса  
 - правила или функции трансформации ответа сервиса в ответ для view

 правила трансформации должны поддерживать:
 - перенос узлов объекта запроса
 - подстановку значений по умолчанию

 */


// пример трансформации

// запрос от view
var viewFindRequest = [ // arguments
	{
		query: { name: 'ivanov' },
		fields: ['_id', 'name', 'age'],
		sort: { age: 1 },
		access: {
			user: 'su2',
			company: 'co1',
			role: 'manager'
		}
	},
	function() {} // callback
];

// запрос к сервису
var serviceFindRequest = [ // arguments
	{
		name: 'ivanov',
		owner: 'su2'
	},
	{
		age: 1
	},
	function() {}
];

var transformRequestTemplate = [
	{}, // query
	{}, //sort
	undefined // callback
];
var transformRequestRule = { // ключ - путь назначения, значение - путь источника
	'0': '0.query',
	'0.owner': '0.access.user',
	'0.name': '@del', // указание на удаление
	'1.name': '#1', // значение по умолчанию, произвольный json
	'2': '@2'
};
// значение строки в зависимости от первого символа:
// @ - спецкоманда (del - удалить узел)
// # - подставить значение полученное из десериализации последующей строки
// все остальное - скопировать узел из исходного запроса

// правила исполняются в порядке углубления в дерево результата (возрастания длины массива `key.split('.')`)
