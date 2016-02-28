'use strict';

var mongoose = require('mongoose'),
Schema = mongoose.Schema,
ObjectId = Schema.ObjectId,
l=require('../config/lib');

var fields = {
		name: { type: String }
			,
	name_en: { type: String }
			,
	logo: { type: String }
			,
	league: { type: String }
			,
	parser: { type: Schema.Mixed },
	created: { type: Date , default: Date.now }
};

var teamSchema = new Schema(fields);

module.exports = mongoose.model('Team', teamSchema);
