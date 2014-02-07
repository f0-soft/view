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

// правило трансформации
var transformRequest = [ // arguments
	'@0.query, #.owner=@0.access.user',
	'@0.sort',
	'@callback' // указание на коллбек
];
// @ - обращение к запросу от view
// # - обращение к текущему узлу

// правило трансформации ответа
var transformResponse = [
];
