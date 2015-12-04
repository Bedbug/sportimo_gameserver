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
				log("Add Event Request for matchid [" + match.id + "]", "info");
				match.AddEvent(req.body, res);
			});
		}
	}
};

module.exports = services;
