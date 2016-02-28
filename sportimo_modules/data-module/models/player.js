'use strict';

var mongoose = require('mongoose'),
Schema = mongoose.Schema,
ObjectId = Schema.ObjectId,
l=require('../config/lib');

var fields = {
		name: { type: String }
			,
	team_id: { type: String }
			,
	pic: { type: String }
			,
	team_name: { type: String }
			,
	created: { type: Date , default: Date.now }
};

var playerSchema = new Schema(fields);

module.exports = mongoose.model('Player', playerSchema);
