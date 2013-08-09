'use strict';

module.exports = {
	name: 'viewCustomers',
	template: 'viewCustomers.tpl',
	config: function( it ) {
		var customers;
		var cfg = {
			sDom: "<'row'<'span6'l><'span6'<'#buttonFind'>>r>t<'row'<'span6'i><'span6'p>>",
			sPaginationType: 'bootstrap',
			bProcessing: true,
			bServerSide: false,
			aLengthMenu: [10, 20],
			aoColumns: []
		};

		if ( it.access.read && it.access.read.customers ) { // check existance
			customers = it.access.read.customers;
			if ( customers.indexOf( 'name' ) !== -1 ) {
				cfg.aoColumns.push( {"mData": "name", "sTitle": "Название компании", "sType": "string"} );
			}
			if ( customers.indexOf( 'inn' ) !== -1 ) {
				cfg.aoColumns.push( {"mData": "inn", "sTitle": "ИНН", "sType": "numeric"} );
			}
			if ( customers.indexOf( 'managerName' ) !== -1 ) {
				cfg.aoColumns.push( {"mData": "managerName", "sTitle": "Менеджер", "sType": "string", bSearchable: false} );
			}
			if ( customers.indexOf( 'tsCreate' ) !== -1 ) {
				cfg.aoColumns.push( {"mData": "tsCreate", "sTitle": "Дата регистрации", "sType": "date", "dateSearch": "01-01-2010"} );
			}
		}

		return cfg;
	},

	view: {
		customers: {}
	}
};
