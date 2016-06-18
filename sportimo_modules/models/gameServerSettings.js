'use strict';

var mongoose = require('mongoose'),
  Schema = mongoose.Schema;
  
if (mongoose.models.gameserversettings)
    module.exports = mongoose.models.gameserversettings;
else {
    var gameServerSetting = new mongoose.Schema({
        scheduledTasks: {
            updateTeamStats: [{
                competition: String,
                season: String,
                cronPattern: String
            }],
            updatePlayerStats: [{
                competition: String,
                season: String
            }]
        }
      });

    module.exports = mongoose.model("gameserversettings", gameServerSetting);
}