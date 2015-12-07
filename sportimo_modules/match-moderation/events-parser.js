var EventsParser = {
	Parse: function(data){
		var evtObject = {};
		switch(data.type){
			default:
				evtObject = data;
			break;
		}
		
		return evtObject;
	}
}


module.exports = EventsParser;