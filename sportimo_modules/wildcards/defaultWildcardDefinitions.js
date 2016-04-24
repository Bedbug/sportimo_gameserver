/*
* These are default definitions that are added to any scheduled match once it is started.
* They represent a card for any team and player in the next 5 minutes for: 
* a red card (explulsion event),
* a yellow card (caution event),
* a corner kick,
* an offside
*/
var mongoose = require("mongoose"),
    ObjectId = mongoose.Schema.ObjectId;


var defaultWildcardDefinitions = [
    {
        id: "1",
        matchid: "[[matchid]]",
        text: {"en": "Any player of any team will geta red card in the next 5 minutes" },
        activationLatency: 30, // 30 seconds
        duration: 30000, // 5"
        appearConditions: [], // empty - always avalable
        winConditions: [
            {
                teamid: null,
                playerid: null,
                stat: "Expulsion",
                target: null,
                remaining: 1
            }
        ],
        minPoints: 10,
        maxPoints: 100,
        maxUserInstances: 2,
        creationTime: null,
        activationTime: null,
        status: 1        
    },
    {
        id: "2",
        matchid: "[[matchid]]",
        text: {"en": "Any player of any team will get a yellow card in the next 5 minutes" },
        activationLatency: 30, // 30 seconds
        duration: 30000, // 5"
        appearConditions: [], // empty - always avalable
        winConditions: [
            {
                teamid: null,
                playerid: null,
                stat: "Caution",
                target: null,
                remaining: 1
            }
        ],
        minPoints: 10,
        maxPoints: 100,
        maxUserInstances: 2,
        creationTime: null,
        activationTime: null,
        status: 1        
    },
    {
        id: "3",
        matchid: "[[matchid]]",
        text: {"en": "Any player of any team will kick a corner in the next 5 minutes" },
        activationLatency: 30, // 30 seconds
        duration: 30000, // 5"
        appearConditions: [], // empty - always avalable
        winConditions: [
            {
                teamid: null,
                playerid: null,
                stat: "Corner Kick",
                target: null,
                remaining: 1
            }
        ],
        minPoints: 10,
        maxPoints: 100,
        maxUserInstances: 2,
        creationTime: null,
        activationTime: null,
        status: 1        
    },
    {
        id: "4",
        matchid: "[[matchid]]",
        text: {"en": "Any player of any team will be in an offside position in the next 5 minutes" },
        activationLatency: 30, // 30 seconds
        duration: 30000, // 5"
        appearConditions: [], // empty - always avalable
        winConditions: [
            {
                teamid: null,
                playerid: null,
                stat: "Offside",
                target: null,
                remaining: 1
            }
        ],
        minPoints: 10,
        maxPoints: 100,
        maxUserInstances: 2,
        creationTime: null,
        activationTime: null,
        status: 1        
    }
];
    
module.exports = defaultWildcardDefinitions;