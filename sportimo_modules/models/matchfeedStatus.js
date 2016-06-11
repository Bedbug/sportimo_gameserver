'use strict';

var mongoose = require('mongoose'),
  Schema = mongoose.Schema;
  
if (mongoose.models.matchfeedStatuses)
    module.exports = mongoose.models.matchfeedStatuses;
else {
    var matchfeedStatus = new mongoose.Schema({
        matchid: String,
        parsed_eventids: [String]
      });

    module.exports = mongoose.model("matchfeedStatuses", matchfeedStatus);
}