'use strict';

module.exports = {
	name: 'test',
	template: 'test.tpl',
	config: function(){
		var cfg = {};
		return cfg;
	},



	view: {

		test: { // название схемы flexo
			join: {
				test_join: { // название схемы flexo
					on: 'array_of_id', // правило связи, родительское поле должно быть строкой _id или массивом строк _id
					where: { // статичные правила фильтрации
						property_name: 'value'
					}
				}
			},
			where: { // статичные правила фильтрации
				property_name: 'value',
				property_name_2: { $gt: 'value' },
				property_name_3: { $in: [ 'val1', 'val2', 'val3' ] }
			}
		}

	},



	calc: {
		new_property: {
			type: 'number',
			require: [ 'test' ],
			optional: [ 'test_join' ],
			handler: function( data, options, permissions, callback ) {
				var len = 0;

				len += data.test.length;
				if ( data.test_join ) {
					len += data.test_join.length;
				}

				callback( len );
			}
		}
	},



	options: {
		test_join: 'boolean'
	},



	preprocess: {
		find: [
			function( request, options, permissions, callback ) {
				// request - объект запросов по именам flexo
				if ( !options.test_join ) {
					delete request.test_join;
				}

				callback( request );
			}
		]
	}
};
