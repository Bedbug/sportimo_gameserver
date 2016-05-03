var mongoose = require("mongoose"),
    ObjectId = mongoose.Schema.ObjectId;

var instantGamecardDefinitions = [
{
    "definitionId": mongoose.Types.ObjectId(),
    "matchId": null,
    "cardType": 101,  // all cardTypes with id > 100 are instants
    "duration": 60000,
    "prompt": { "en": "Will any team score in the next 10 minutes?" },
    "options":[
    	{
    		"optionId": "1",
    		"winCondition": 
    		{
    			"team": "home_team",
    			"text": { "en": "Yes, [[home_team]]" }, // [[home_team]] is a placeholder for the actual name of the home team. To be replaced in the gamecard definition. 
    			"stat": "Goal",
    			"statRemaining": 1,
    			"maxPoints": 300,
    			"minPoints" : 150,
    			"conditionNegation": false
    		}
    	},
    	{
    		"optionId": "2",
    		"winCondition": 
    		{
    			"team": "away_team",
    			"text": { "en": "Yes, [[away_team]]" },
    			"stat": "Goal",
    			"statRemaining": 1,
    			"maxPoints": 300,
    			"minPoints" : 150,
    			"conditionNegation": false
    		}
    	},
    	{
    		"optionId": "3",
    		"winCondition": 
    		{
    			"team": null,
    			"text": { "en": "Yes" },
    			"stat": "Goal",
    			"statRemaining": 1,
    			"maxPoints": 200,
    			"minPoints" : 100,
    			"conditionNegation": false
    		}
    	},
    	{
    		"optionId": "4",
    		"winCondition": 
    		{
    			"team": null,
    			"text": { "en": "No" },
    			"stat": "Goal",
    			"statRemaining": 1,
    			"maxPoints": 50,
    			"minPoints" : 25,
    			"conditionNegation": true
    		}
    	}]
}
];