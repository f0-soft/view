'use strict';

exports.name = 'root';
exports.root = {
	a: { type: 'str' },
	join_id: { type: 'id', from: 'join' }
};
