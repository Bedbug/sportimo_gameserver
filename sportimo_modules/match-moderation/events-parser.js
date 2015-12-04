var EventsParser = {
	Parse: function(data){
		var evtObject = {};
		console.log(data.type);
		switch(data.type){
			case "message":
				evtObject = data;
			break;
		}
		
		return evtObject;
	}
}


module.exports = EventsParser;