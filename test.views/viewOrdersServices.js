'use strict';

module.exports = {
	name: 'viewOrdersServices',
	template: 'viewOrdersServices.tpl',



	view: {

		orders: { // название схемы flexo
			join: {
				services: { // название схемы flexo
					on: 'services'
				}
			}
		}

	}
};
