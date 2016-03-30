'use strict';

var mongoose = require('mongoose'),
    Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId,
    l = require('../config/lib');

var fields = {
    name: { type: Schema.Types.Mixed },
    logo: { type: String },
    parserids: { type: Schema.Types.Mixed },
    visiblein: [String],
    created: { type: Date, default: Date.now }
};

var competitionSchema = new Schema(fields);

module.exports = mongoose.model('Competition', competitionSchema);
