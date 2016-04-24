/**
 * Match_Module is the main Class regarding matches in the Sportimo Platform.
 * It handles all match related stuff. From match infos to actual
 * database hooks and syncing. 
 * All moderation services will have to register on this object in order to 
 * function and will call methods on this object in order to moderate it.
 */

var Sports = require('./sports-settings');
var StatsHelper = require('./StatsHelper');
var moment = require('moment');
var log = require('winston');
var _ = require('lodash'),
    mongoConnection = require('../config/db.js'),
    StatMods = require('../../models/stats-mod'),
    matchEvents = require('../../models/matchEvents');




var path = require('path'),
    fs = require('fs');

/*Bootstrap service*/
var services = [];
var servicesPath = path.join(__dirname, '../services');
fs.readdirSync(servicesPath).forEach(function (file) {
    services[path.basename(file, ".js")] = require(servicesPath + '/' + file);
});


var matchModule = function (match, PubChannel) {

    var HookedMatch = {}; // = match;
    HookedMatch.moderationServices = [];

    // establishing a link with wildcards module, where match events should propagate in order to resolve played match wildcards
    HookedMatch.wildcards = require('../../wildcards');
    HookedMatch.wildcards.init(mongoConnection.mongoose, PubChannel);
    // Set ID
    HookedMatch.id = match._id.toString() || 'mockid';

    // Match data
    HookedMatch.data = match;

    // Validations
    if (HookedMatch.data.timeline.length == 0) {
        HookedMatch.data.state = 0;
        HookedMatch.data.timeline.push({
            "start": null,
            "end": null,
            "events": []
        });
        HookedMatch.data.markModified('timeline');
        HookedMatch.data.save();
    }

    // Setting the game_type ('soccer','basket') and its settings (game segments, duration, etc)
    HookedMatch.sport = Sports[match.sport];



    /*  -------------
     **   Methods
     **  -------------
     */


    /*  SetModerationService
        Here we set the moderation service for the game. "service" is the object of the corresponding
        service. 
        e.g. a feed service
       {
            "type": "rss-feed",
            "eventid": "15253",
            "feedurl": "http://feed-somewhere.com?event-id=",
            "interval": 500 
        } 
    */
    HookedMatch.AddModerationService = function (service, callback) {
        // Check if service of same type already exists 
        if (_.findWhere(HookedMatch.moderationServices, {
                type: service.type
            })) {
            log.info("Service already active");
            return callback(new Error("Service type already active. Please remove the old one first."));
        } else {
            //HookedMatch.moderationServices.push(service);
            return HookedMatch.StartService(service, callback);
        }
    };

    HookedMatch.StartService = function (service, callback) {
        var newService = services[service.type];

        _.merge(newService, service);

        // init the service by passing this.data as a context reference for internal communication (sending events)
        newService.init(JSON.parse(JSON.stringify(this.data)), function(error, done) {
            if (error)
                return callback(error);
            
            // Register this match module to the events emitted by the new service, but first filter only those relative to its match id (I have to re-evaluate this filter, might be redundant). 
            newService.emitter.on('matchEvent', function(matchEvent) {
                if (matchEvent && matchEvent.data.match_id == HookedMatch.data.id) 
                    HookedMatch.AddEvent(matchEvent);
            });
            newService.emitter.on('nextMatchSegment', function(matchEvent) {
                if (matchEvent && matchEvent._id == HookedMatch.data.id) 
                    HookedMatch.AdvanceSegment(matchEvent);
            });
            newService.emitter.on('endOfMatch', function(matchEvent) {
                if (matchEvent && matchEvent._id == HookedMatch.data.id) 
                    HookedMatch.Terminate();
            });

            HookedMatch.moderationServices.push(newService);
            callback(null, newService);
        });
    };
    
    HookedMatch.PauseService = function (service, callback) {
        // Check if service of same type already exists 
        var serviceTypeFound = _.findWhere(HookedMatch.moderationServices, {
                type: service.type
            });
        if (!serviceTypeFound)
            return callback(new Error("Service type does not exist. Please add it first."));
        serviceTypeFound.pause();
        callback(null, serviceTypeFound);
    };
    
    
    HookedMatch.ResumeService = function (service, callback) {
        // Check if service of same type already exists 
        var serviceTypeFound = _.findWhere(HookedMatch.moderationServices, {
                type: service.type
            });
        if (!serviceTypeFound)
            return callback(new Error("Service type does not exist. Please add it first."));
        serviceTypeFound.resume();
        callback(null, serviceTypeFound);
    };    
    
    
    HookedMatch.GetServices = function() {
        return HookedMatch.moderationServices;
    };


    // Set services for the first time
    HookedMatch.moderationServices = match.moderation;
    HookedMatch.moderationServices.forEach(function (service) {
        HookedMatch.StartService(service);
    });


    HookedMatch.removeSegment = function (data, cbk) {

        this.data.timeline.splice(data.index, 1);

        HookedMatch.data.state--;

        this.data.markModified('timeline');
        this.data.save();

        return cbk(null, HookedMatch);
    }

    HookedMatch.updateTimes = function (data) {
        console.log(data);
        // make checks
        if (this.data.timeline[data.index].start != data.data.start) {
            this.data.timeline[data.index].start = data.data.start;

            if (this.data.timeline[data.index - 1])
                this.data.timeline[data.index - 1].end = data.data.start;

            this.data.markModified('timeline');
            this.data.save();
        }

        if (this.data.timeline[data.index].end != data.data.end) {
            this.data.timeline[data.index].end = data.data.end;

            if (this.data.timeline[data.index + 1])
                this.data.timeline[data.index + 1].start = data.data.end;

            this.data.markModified('timeline');
            this.data.save();
        }

        return HookedMatch;
    }

    /*  AdvanceSegment
        The advance state method is called when we want to advance to the next segment of the game.
        Depending on setting, here will determine if a timer should begin counting aand hold the
        game's time.
    */
    HookedMatch.AdvanceSegment = function(event)
    {
        // Register the time that the previous segment ended
        this.data.timeline[this.data.state].end = moment().utc().format();
        // Advance the state of the match
        this.data.state++;
        // Register the time that the current segment starts
        this.data.timeline.push({
            "start": null,
            "end": null,
            "events": []
        });
        this.data.timeline[this.data.state].start = moment().utc().format();

        this.data.markModified('timeline');
        this.data.save();
        
        return HookedMatch;
    };



    HookedMatch.GetCurrentSegment = function () {
        // We assign the name of the segment to the currentSegment var
        return HookedMatch.Sport.segments[HookedMatch.state].name;
    }



    /*  AddEvent
        The addEvent method is a core method to the moderation system. It is called by
        moderation services or manualy from the dashboard in order to inject events to
        the timeline and also broadcast them on the sockets channel to be consumed by
        other instances.
    */

    HookedMatch.AddEvent = function (event)
    {
        event.data = new matchEvents(event.data);

        // console.log("Linked: "+ StatsHelper.Parse(event, match, log));

        //        console.log("When adding event:");
        //        console.log(HookedMatch.data.timeline[this.data.state]);

        var evtObject = event.data;

        // Parses the event based on sport and makes changes in the match instance
        evtObject.linked_mods = StatsHelper.Parse(event, match);

        // 1. push event in timeline
        if (evtObject.timeline_event) {
            log.info("Received Timeline event");

            // evtObject = new matchEvents(evtObject);
            this.data.timeline[this.data.state].events.push(evtObject);
        }

        // 2. broadcast event on pub/sub channel
        log.info("Pushing event to Redis Pub/Sub channel");
        // PubChannel.publish("socketServers", JSON.stringify(event));

        // Inform Clients for the new event to draw
        PubChannel.publish("socketServers", JSON.stringify({
            sockets: true,
            payload: {
                type: "Event_added",
                room: event.match_id,
                data: event.data
            }
        }
        ));

        // Inform the system about the stat changes
        PubChannel.publish("socketServers", JSON.stringify({
            sockets: true,
            payload: {
                type: "Stats_changed",
                room: event.matchid,
                data: match.stats
            }
        }
        ));
        
        // 3. send event to wildcards module for wildcard resolution
        HookedMatch.wildcards.ResolveEvent(event);

        // 4. save match to db
        if (evtObject.timeline_event) {
            this.data.markModified('timeline');
            log.info("Updating database");
        }

        StatsHelper.UpsertStat(match.id, {
            events_sent: 1
        }, this.data);

        this.data.markModified('stats');

        this.data.save();
        
        return HookedMatch;
    };

    /*  RemoveEvent
     
    */
    HookedMatch.RemoveEvent = function (event) {

        // Parses the event based on sport and makes changes in the match instance
        StatsHelper.Parse(event, match);


        var eventObj = _.findWhere(this.data.timeline[event.data.state].events, {
            id: event.data.id,
            match_id: event.data.match_id
        });



        // set status to removed
        eventObj.status = "removed";

        // Should we destroy events on just mark them "removed"
        if (this.data.settings.destroyOnDelete)
            this.data.timeline[event.data.state].events = _.without(this.data.timeline[event.data.state].events, eventObj);

        // Broadcast the remove event so others can consume it.
        PubChannel.publish("socketServers", JSON.stringify(event));

        // 3. save match to db
        this.data.markModified('timeline');
        log.info("Updating database");

        StatsHelper.UpsertStat(match.id, {
            events_sent: 1
        }, this.data);
        this.data.markModified('stats');

        this.data.save();

        // 4. return match to Sender
        return HANDLE_EVENT_REMOVAL(event.data, this);
    }

    /*  RemoveEvent
     
    */
    HookedMatch.UpdateEvent = function (event) {

        // console.log(event.data._id);
        //  console.log(this.data.timeline[event.data.state]);
      var eventToUpdate = _.find(this.data.timeline[event.data.state].events, function(o){
          return o._id == event.data._id;
        }); 
        
        // We have an update to players
        if(eventToUpdate.players.length < event.data.players.length){
          event.data.linked_mods = StatsHelper.UpdateEventStat([event.data.players[0]._id],event.data.stats,[event.data.players[0].name], this.data, eventToUpdate.linked_mods);
           eventToUpdate.players = event.data.players; 
        }
        
        
        
        // // Parses the event based on sport and makes changes in the match instance
        // StatsHelper.Parse(event, match);

        // for (var i = 0; i < this.data.timeline[event.data.state].events.length; i++) {
        //     if (this.data.timeline[event.data.state].events[i].id == event.data.id && this.data.timeline[event.data.state].events[i].match_id == event.match_id) {
        //         this.data.timeline[event.data.state].events[i] = event.data;
        //         break;
        //     }
        // }

        // Broadcast the remove event so others can consume it.
        // 2. broadcast event on pub/sub channel
        log.info("Pushing event to Redis Pub/Sub channel");
        // PubChannel.publish("socketServers", JSON.stringify(event));

        // Inform Clients for the new event to draw
        PubChannel.publish("socketServers", JSON.stringify({
            sockets: true,
            payload: {
                type: "Event_updated",
                room: eventToUpdate.match_id,
                data: eventToUpdate
            }
        }
        ));

        // Inform the system about the stat changes
        PubChannel.publish("socketServers", JSON.stringify({
            sockets: true,
            payload: {
                type: "Stats_changed",
                room: event.matchid,
                data: match.stats
            }
        }
        ));

        // 3. save match to db
        this.data.markModified('timeline');
        log.info("Updating database");

        // StatsHelper.UpsertStat(match.id, {
        //     events_sent: 1
        // }, this.data);
        this.data.markModified('stats');

        this.data.save();

        // 4. return match to Sender
        return HookedMatch;
    };

    // method to be called when the match is over. Disposes and releases handlers, timers, and takes care of loose ends.
    HookedMatch.Terminate = function() {
        
    };

    return HookedMatch;
};


// TODO: [x] Stats update according to the removal of a previous stat modifier 
// TODO: Add validation after event removal and stats update. There should be a looped process wher each card player after the removed event is validated for win.
var HANDLE_EVENT_REMOVAL = function (linked, returnData) {

    var finished = linked.linked_mods.length;

    linked.linked_mods.forEach(function (link) {
        // 1. Find the corresponding document
        StatMods.findById(link, function (err, mod) {

            //            console.log(mod);
            // 2. Update all documents from created date on with the deleted modification
            // more multi updates
            StatMods.where({
                match_id: mod.match_id,
                stat_for: mod.stat_for,
                stat: mod.stat,
                created: {
                    $gt: mod.created
                }
            })
                .setOptions({
                    multi: true
                })
                .update({
                    $inc: {
                        was: -mod.by,
                        is: -mod.by
                    }
                }, function (err, doc) { });

            // 3. Remove the document from the collection
            mod.remove(function (err) {
                finished--;

                if (finished == 0)
                    return returnData;
            });
        });
    });

};

module.exports = matchModule;
