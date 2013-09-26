'use strict';

module.exports = {
	name: 'test',

	template: 'test.tpl',

	// конфиг определяет какие поля корневой схемы могут быть показаны
	// также он определяет какие поля схем, которые возможно присоединить через `from` или `link`, могут быть показаны
	// срезанный по правам конфиг определяет какие поля следует показывать
	config: {
		a01: { a: 1, _vid: '01', _flexo: {type: 'read', scheme: [ 'testBill', '_id' ]}, _title: 'ID', _description: 'идентификатор счета' },
		a02: { _vid: '02', _flexo: {type: 'read', scheme: [ 'testBill', 'tsCreate' ]} },
		a03: { _vid: '03', _flexo: {type: 'read', scheme: [ 'testBill', 'tsUpdate' ]} },
		a04: { _vid: '04', _flexo: {type: 'read', scheme: [ 'testBill', 'name' ]} },
		a05: { _vid: '05', _flexo: {type: 'read', scheme: [ 'testBill', 'attachment_id' ]} },

		a06: { _vid: '06', _flexo: {type: 'read', scheme: [ 'testAttachment', '_id', 'attachment_id' ]} },
		a07: { _vid: '07', _flexo: {type: 'read', scheme: [ 'testAttachment', 'tsCreate', 'attachment_id' ]} },
		a08: { _vid: '08', _flexo: {type: 'read', scheme: [ 'testAttachment', 'tsUpdate', 'attachment_id' ]} },
		a09: { _vid: '09', _flexo: {type: 'read', scheme: [ 'testAttachment', 'date', 'attachment_id' ]} },
		a10: { _vid: '10', _flexo: {type: 'read', scheme: [ 'testAttachment', 'index', 'attachment_id' ]} },
		a11: { _vid: '11', _flexo: {type: 'read', scheme: [ 'testAttachment', 'contract_id', 'attachment_id' ]} },

		a12: { _vid: '12', _flexo: {type: 'read', scheme: [ 'testContract', '_id', 'attachment_id', 'bill-manager' ]} },
		a13: { _vid: '13', _flexo: {type: 'read', scheme: [ 'testContract', 'tsCreate', 'attachment_id', 'bill-manager' ]} },
		a14: { _vid: '14', _flexo: {type: 'read', scheme: [ 'testContract', 'tsUpdate', 'attachment_id', 'bill-manager' ]} },
		a15: { _vid: '15', _flexo: {type: 'read', scheme: [ 'testContract', 'date', 'attachment_id', 'bill-manager' ]} },
		a16: { _vid: '16', _flexo: {type: 'read', scheme: [ 'testContract', 'index', 'attachment_id', 'bill-manager' ]} },
		a17: { _vid: '17', _flexo: {type: 'read', scheme: [ 'testContract', 'customer_id', 'attachment_id', 'bill-manager' ]} },
		a18: { _vid: '18', _flexo: {type: 'read', scheme: [ 'testCustomer', '_id', 'attachment_id', 'bill-contract' ]} },
		a19: { _vid: '19', _flexo: {type: 'read', scheme: [ 'testCustomer', 'tsCreate', 'attachment_id', 'bill-contract' ]} },
		a20: { _vid: '20', _flexo: {type: 'read', scheme: [ 'testCustomer', 'tsUpdate', 'attachment_id', 'bill-contract' ]} },
		a21: { _vid: '21', _flexo: {type: 'read', scheme: [ 'testCustomer', 'name', 'attachment_id', 'bill-contract' ]} },
		a22: { _vid: '22', _flexo: {type: 'read', scheme: [ 'testCustomer', 'manager_id', 'attachment_id', 'bill-contract' ]} },

		// построчная агрегация
		ag1: { _vid: '23', _flexo: {
			type: 'read',
			aggregate: {
				name: 'attachmentAggregation',
				group: { $sum: '$date' }
			}
		}},
		ag2: { _vid: '24', _flexo: {
			type: 'read',
			aggregate: {
				name: 'attachmentAggregation',
				selector: 'tsCreate'
			}
		}}
	},

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
