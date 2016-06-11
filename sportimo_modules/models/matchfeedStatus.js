'use strict';

var mongoose = require('mongoose'),
  Schema = mongoose.Schema;
  
if (mongoose.models.matchfeedStatus)
    module.exports = mongoose.models.matchfeedStatus;
else {
    var matchfeedStatus = new mongoose.Schema({
        matchid: String,
        parsed_eventids: [String]
      });

    module.exports = mongoose.model("matchfeedStatus", matchfeedStatus);
}