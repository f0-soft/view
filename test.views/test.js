'use strict';

module.exports = {
	name: 'test',

	template: 'test.tpl',

	// конфиг определяет какие поля корневой схемы могут быть показаны
	// также он определяет какие поля схем, которые возможно присоединить через `from` или `link`, могут быть показаны
	// срезанный по правам конфиг определяет какие поля следует показывать
	config: [
		1,
		{ a: 1, b: { a: 1, c: [1, 2]}, _vid: '01', _flexo: {type: 'read', scheme: [ 'testBill', '_id' ]}, _title: 'ID', _description: 'идентификатор счета' },
		{ _vid: '02', _flexo: {type: 'read', scheme: [ 'testBill', 'tsCreate' ]} },
		{ _vid: '03', _flexo: {type: 'read', scheme: [ 'testBill', 'tsUpdate' ]} },
		{ _vid: '04', _flexo: {type: 'read', scheme: [ 'testBill', 'date' ]} },
		{ _vid: '05', _flexo: {type: 'read', scheme: [ 'testBill', 'attachment_id' ]} },

		{ _vid: '06', _flexo: {type: 'read', scheme: [ 'testAttachment', '_id', 'attachment_id' ]} },
		{ _vid: '07', _flexo: {type: 'read', scheme: [ 'testAttachment', 'tsCreate', 'attachment_id' ]} },
		{ _vid: '08', _flexo: {type: 'read', scheme: [ 'testAttachment', 'tsUpdate', 'attachment_id' ]} },
		{ _vid: '09', _flexo: {type: 'read', scheme: [ 'testAttachment', 'date', 'attachment_id' ]} },
		{ _vid: '10', _flexo: {type: 'read', scheme: [ 'testAttachment', 'index', 'attachment_id' ]} },
		{ _vid: '11', _flexo: {type: 'read', scheme: [ 'testAttachment', 'contract_id', 'attachment_id' ]} },

		{ _vid: '12', _flexo: {type: 'read', scheme: [ 'testContract', '_id', 'attachment_id', 'bill-manager' ]} },
		{ _vid: '13', _flexo: {type: 'read', scheme: [ 'testContract', 'tsCreate', 'attachment_id', 'bill-manager' ]} },
		{ _vid: '14', _flexo: {type: 'read', scheme: [ 'testContract', 'tsUpdate', 'attachment_id', 'bill-manager' ]} },
		{ _vid: '15', _flexo: {type: 'read', scheme: [ 'testContract', 'date', 'attachment_id', 'bill-manager' ]} },
		{ _vid: '16', _flexo: {type: 'read', scheme: [ 'testContract', 'index', 'attachment_id', 'bill-manager' ]} },
		{ _vid: '17', _flexo: {type: 'read', scheme: [ 'testContract', 'customer_id', 'attachment_id', 'bill-manager' ]} },

		{ _vid: '18', _flexo: {type: 'read', scheme: [ 'testCustomer', '_id', 'attachment_id', 'bill-contract' ]} },
		{ _vid: '19', _flexo: {type: 'read', scheme: [ 'testCustomer', 'tsCreate', 'attachment_id', 'bill-contract' ]} },
		{ _vid: '20', _flexo: {type: 'read', scheme: [ 'testCustomer', 'tsUpdate', 'attachment_id', 'bill-contract' ]} },
		{ _vid: '21', _flexo: {type: 'read', scheme: [ 'testCustomer', 'name', 'attachment_id', 'bill-contract' ]} },
		{ _vid: '22', _flexo: {type: 'read', scheme: [ 'testCustomer', 'manager_id', 'attachment_id', 'bill-contract' ]} },

		// построчная агрегация
		{ _vid: '23', _flexo: {
			type: 'read',
			aggregate: {
				name: 'attachmentAggregation',
				group: { $sum: '$date' }
			}
		}},
		{ _vid: '24', _flexo: {
			type: 'read',
			aggregate: {
				name: 'attachmentAggregation',
				selector: 'tsCreate'
			}
		}}
	],

	root: 'testBill', // название корневой схемы flexo, к которой через связи будут подтянуты другие схемы
	join: { // view, которые могут дополнять запросы текущей view
		testForm: {}
	},



	// справочник агрегаций
	aggregate: {
		attachmentAggregation: {
			flexo: 'testAttachment',
			link: {contract_id: '%id%'} // makes separate requests by every id, so $group._id has requested id
		}
	},



	access: {
		'%role%': { /* %request% */ },
		manager: {_path: {$elemMatch: {c: 'testCustomer', f: 'bill-contract', o: '%user_id%'}}},
		customer: {_path: {$elemMatch: {c: 'testContract', f: 'bill-contract', o: '%company_id%'}}}
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
