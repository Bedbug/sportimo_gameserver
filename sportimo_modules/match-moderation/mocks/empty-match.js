 module.exports = {
    "sport": "soccer",
    "home_team": "",
    "away_team": "",
    "home_score": 0,
    "away_score": 0,
    "time": "1",
    "start": null,
    "competition":"",
    "moderation": [],
     "parserids":[],
    "stats": [],
    "timeline": [],
    "settings": {
        "destroyOnDelete": true
    },
    "state": 0
}

// var match_schema = new mongoose.Schema({
//   sport: String,
//   home_team: {
//     type: String,
//     ref: 'team'
//   },
//   away_team: {
//     type: String,
//     ref: 'team'
//   },
//   start: Date,
//   color: String,
//   competition: String,
//   home_score: Number,
//   away_score: Number,
//   match_date: Date,
//   time: String,
//   state: Number,
//   stats: mongoose.Schema.Types.Mixed,
//   timeline: [mongoose.Schema.Types.Mixed],
//   settings: mongoose.Schema.Types.Mixed,
//   moderation: [mongoose.Schema.Types.Mixed]
// }