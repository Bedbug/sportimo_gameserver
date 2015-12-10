// Parsers based on sports
var parsers = {
	soccer:{
		Add: function(event,match,log){
			console.log(event);
			var evtData = event.data;
			
			// Filter based on different sport based event types
			switch(evtData.type){
				case "yellow":
					UpsertStart({y:1}, evtData.players[0].id, match.playerstats );
					log(match);
				break;
			}
			
			
		},
		Update: function(event,match,log){},
		Delete: function(event,match,log){},
	},
	basket:{},
	tennis:{}
}


var UpsertStart = function(statModifier, entry, statsHolder){
	// var found = 0;
	
	if(statsHolder[entry] == undefined) statsHolder[entry] = {};
	if(statsHolder[entry][statModifier[0]] == undefined) statsHolder[entry][statModifier[0]] = 0;
	statsHolder[entry][statModifier[0]] += statModifier[1];
	
	// if(statsHolder[entry] != null)
	// 	statsHolder[entry][statModifier[0]] += statModifier[1]; 
	
}



var StatsAnalyzer = {
	Parse: function(event, match ,log){
		return parsers[match.sport][event.type](event,match,log);
	}
}


module.exports = StatsAnalyzer;


// log("[Stats Analyzer] "+ match.sport,"info");
// 			switch(event.type){
				
// 			}