'use strict';
var mongoose = require('mongoose'),
  Schema = mongoose.Schema,
  ObjectId = Schema.ObjectId;

var fields = {
  user: {
    type: String,
    ref: 'users'
  },
  room: String,
  lastActive: Date,
  isPresent: Boolean
};

var schema = new Schema(fields,
  {
    timestamps: { updatedAt: 'lastActive' }
  });

module.exports = mongoose.model('useractivities', schema);


