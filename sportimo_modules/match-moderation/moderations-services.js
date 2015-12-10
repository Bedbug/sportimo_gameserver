/* Services must always have an init method for initialization options.
*/

var services = {
	xmlfeed: {
		url: "",
		init: function (url) {
			console.log("Initialize Service from XML Feed.");
			// this.url = url;
		}
	},
	manual: {
		init: function (server, match, log) {
			
			
			log("Initialize manual moderation Service.","info");
			
			// Set up Routes
			server.get('/v1/moderation/' + match.id + '/event', function (req, res) {
				res.send("All ok");
			});
			
			server.post('/v1/moderation/' + match.id + '/event', function (req, res) {
				switch(req.body.type){
					case "Delete":
						log("[moderation-service] Remove Event Request for matchid [" + req.body.match_id + "] and event ID ["+req.body.data.event_id+"]", "info");
						match.RemoveEvent(req.body, res);
					break;
					case "Update":
						log("[moderation-service] Update Event Request for matchid [" + req.body.match_id + "] and event ID ["+req.body.data.id+"]", "info");
						match.UpdateEvent(req.body, res);
					break;
					case "Add":
						log("Add Event Request for matchid [" + req.body.match_id + "] with event ID ["+req.body.data.id+"]", "info");
						match.AddEvent(req.body, res);
					break;
					default:
						
					break;	
				}
				
				
			});
		}
	}
};

module.exports = services;
