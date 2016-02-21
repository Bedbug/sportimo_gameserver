'use strict';

var mongoose = require('mongoose'),
Schema = mongoose.Schema,
ObjectId = Schema.ObjectId;

var fields = {
		name: { type: String }
			,
	price: { type: Number }
};

var itemSchema = new Schema(fields);

module.exports = mongoose.model('Item', itemSchema);
