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
var serviceTypes = {};

var servicesPath = path.join(__dirname, '../services');
fs.readdirSync(servicesPath).forEach(function (file) {
    serviceTypes[path.basename(file, ".js")] = require(servicesPath + '/' + file);
});

var Timers = {
    Timeout: null,
    matchTimer: null,
    clear: function () {
        clearTimeout(Timers.Timeout);
        clearInterval(Timers.matchTimer);
    }
};

var matchModule = function (match, PubChannel, SubChannel) {

    var HookedMatch = {}; // = match;
    //HookedMatch.moderationServices = [];


    // Set ID
    HookedMatch.id = match._id.toString() || 'mockid';

    // Match data
    HookedMatch.data = match;

    // Validations
    if (HookedMatch.data.timeline.length == 0) {
        HookedMatch.data.state = 0;
        HookedMatch.data.timeline.push({
            "events": []
        });
        // HookedMatch.data.markModified('timeline');
        HookedMatch.data.save();
    }

    // Setting the game_type ('soccer','basket') and its settings (game segments, duration, etc)
    HookedMatch.sport = Sports[match.sport];

    // establishing a link with gamecards module, where match events should propagate in order to resolve played match wildcards
    HookedMatch.gamecards = require('../../gamecards');
    HookedMatch.gamecards.init(mongoConnection.mongoose, PubChannel, SubChannel, match);


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
        if (_.find(services, {
            type: service.type
        })) {
            log.info("Service already active");
            return callback(new Error("Service type already active. Please remove the old one first."));
        } else {

            HookedMatch.data.moderation.push(service);
            HookedMatch.data.save();

            HookedMatch.StartService(service, function (error, newService) {
                if (error)
                    return callback(error);

                callback(null, getServiceDTO(newService));
            });

        }
    };

    HookedMatch.StartService = function (service, callback) {
        var newService = serviceTypes[service.type];

        newService = _.cloneDeep(newService);
        //_.merge(newService, service);
        if (service.parsername)
            newService.parsername = service.parsername;
        if (service.parserid)
            newService.parserid = service.parserid;
        if (service.type)
            newService.type = service.type;
        if (service.interval)
            newService.interval = 1000 * service.interval; // convert seconds to milliseconds
        if (service.active)
            newService.active = service.active;
        if (service.parsed_eventids)
            newService.parsed_eventids = service.parsed_eventids;

        // init the service by passing this.data as a context reference for internal communication (sending events)
        newService.init(this.data, function (error, initService) {
            if (error) {
                return callback(error);
            }

            // Register this match module to the events emitted by the new service, but first filter only those relative to its match id (I have to re-evaluate this filter, might be redundant). 
            initService.emitter.on('matchEvent', function (matchEvent) {
                if (matchEvent && matchEvent.data.match_id == HookedMatch.data.id)
                    HookedMatch.AddEvent(matchEvent);
            });
            initService.emitter.on('nextMatchSegment', function (matchEvent) {
                if (matchEvent && matchEvent.id == HookedMatch.data.id)
                    HookedMatch.AdvanceSegment(matchEvent);
            });
            initService.emitter.on('endOfMatch', function (matchEvent) {
                if (matchEvent && matchEvent.id == HookedMatch.data.id)
                    HookedMatch.Terminate();
            });

            services.push(initService);
            callback(null, initService);
        });
    };

    HookedMatch.PauseService = function (service, callback) {
        // Check if service of same type already exists 
        var serviceTypeFound = _.find(services, {
            type: service.type
        });
        if (!serviceTypeFound)
            return callback(new Error("Service type does not exist. Please add it first."));

        // Update status in MongoDB
        var serviceData = _.find(HookedMatch.data.moderation, { type: service.type });
        if (serviceData) {
            serviceData.active = false;
            HookedMatch.data.save();
        }

        serviceTypeFound.pause();
        callback(null, getServiceDTO(serviceTypeFound));
    };


    HookedMatch.ResumeService = function (service, callback) {
        // Check if service of same type already exists 
        var serviceTypeFound = _.find(services, {
            type: service.type
        });
        if (!serviceTypeFound)
            return callback(new Error("Service type does not exist. Please add it first."));

        // Update status in MongoDB
        var serviceData = _.find(HookedMatch.data.moderation, { type: service.type });
        if (serviceData) {
            serviceData.active = true;
            HookedMatch.data.save();
        }

        serviceTypeFound.resume();
        callback(null, getServiceDTO(serviceTypeFound));
    };


    HookedMatch.GetServices = function () {
        return _.map(services, function (service) {
            return getServiceDTO(service);
        });
    };


    // Return a strip down version of a service, only the information needed in API endpoints to know
    var getServiceDTO = function (service) {
        return {
            type: service.type,
            parserid: service.parserid,
            interval: service.interval,
            active: service.isActive()
        };
    }

    // Set services for the first time
    //HookedMatch.moderationServices = match.moderation;
    match.moderation.forEach(function (service) {
        HookedMatch.StartService(service, function (error) {
            if (error) {
                log.error("Error initializing the service " + service.type ? service.type : "Unknown" + ": " + error.message);
            }
        });
    });


    HookedMatch.removeSegment = function (data, cbk) {

        this.data.timeline.splice(data.index, 1);

        HookedMatch.data.state--;

        // this.data.markModified('timeline');
         this.data.save(function (err, done) {
            if (err)
                log.error(err.message);
         });


        startMatchTimer();

        return cbk(null, HookedMatch);
    }

    HookedMatch.updateTimes = function (data, cbk) {
        // console.log(data);
        // make checks
        if (this.data.timeline[data.index].start != data.data.start) {
            this.data.timeline[data.index].start = data.data.start;

            if (this.data.timeline[data.index - 1])
                this.data.timeline[data.index - 1].end = data.data.start;

            // this.data.markModified('timeline');
             this.data.save(function (err, done) {
            if (err)
                log.error(err.message);
         });
        }

        if (this.data.timeline[data.index].end != data.data.end) {
            this.data.timeline[data.index].end = data.data.end;

            if (this.data.timeline[data.index + 1])
                this.data.timeline[data.index + 1].start = data.data.end;

            // this.data.markModified('timeline');
             this.data.save(function (err, done) {
            if (err)
                log.error(err.message);
         });
        }

        return cbk(null, HookedMatch);
    }

    /*  SocketMessage
        Send a socket message to clients registered in match.
    */
    HookedMatch.SocketMessage = function (event) {
        PubChannel.publish("socketServers", JSON.stringify({
            sockets: true,
            payload: event
        }
        ));
        
        return "Done";
    };

    /*  AdvanceSegment
        The advance state method is called when we want to advance to the next segment of the game.
        Depending on setting, here will determine if a timer should begin counting and hold the
        game's time.
    */
    HookedMatch.AdvanceSegment = function (event) {
        // Register the time that the previous segment ended
        HookedMatch.data.timeline[HookedMatch.data.state].end = moment().utc().format();

        // This previous segment is timed. We should send a segment end timeline event first.
        if (HookedMatch.sport.segments[HookedMatch.data.state].timed) {
            console.log(HookedMatch.sport.segments[HookedMatch.data.state].name.en + " Ends");
            var endEvent = {
                type: "Add",
                match_id: HookedMatch.id,
                data: {
                    match_id: HookedMatch.id,
                    type: HookedMatch.sport.segments[HookedMatch.data.state].name.en + " Ends",
                    time: HookedMatch.data.time,
                    state: HookedMatch.data.state,
                    timeline_event: true
                }
            };
            HookedMatch.AddEvent(endEvent);
        }


        // Advance the state of the match
        HookedMatch.data.state++;

        // console.log(this.sport.segments[this.data.state]);
        // Register the time that the current segment starts

        var newSegment = {
            start: moment().utc().format(),
            sport_start_time: HookedMatch.sport.segments[HookedMatch.data.state].initialTime ? HookedMatch.sport.segments[HookedMatch.data.state].initialTime : 0,
            timed: HookedMatch.sport.segments[HookedMatch.data.state].timed,
            text: HookedMatch.sport.segments[HookedMatch.data.state].name,
            break_time: 0,
            events: []
        }

        HookedMatch.data.timeline.push(newSegment);

        // Send new segment change to clients
        // Inform Clients for the new event to draw
        PubChannel.publish("socketServers", JSON.stringify({
            sockets: true,
            payload: {
                type: "Advance_Segment",
                room: HookedMatch.id,
                data: {
                    segment: newSegment,
                    match_id: HookedMatch.id,
                    info: "The porperty segment should be pushed to the timeline",
                    sportSegmenInfo: HookedMatch.sport.segments[HookedMatch.data.state],
                    state: HookedMatch.data.state,
                    timeline_event: false
                }
            }
        }));


       // this.data.markModified('timeline');
        
        HookedMatch.data.save(function(err,result, numaffected){
            log.info("Updating database - Advance segment");
            if(err)
            log.error(err);
            else
            log.info("Saved: "+numaffected );
        })

        // Update gamecards module of the segment change. Create an event out of this
        const segmentEvent = {
            data: {
                id: null,
                sender: null,
                matchid: HookedMatch.id,
                team: null,
                players: null,
                segment: 1,
                state: HookedMatch.data.state,
                timeline_event: false
            }
        };
        HookedMatch.gamecards.ResolveEvent(segmentEvent);

        // This new segment is timed. We should send a segment start timeline event.
        if (HookedMatch.sport.segments[HookedMatch.data.state].timed) {
            console.log(HookedMatch.sport.segments[HookedMatch.data.state].name.en + " Starts");
            var startEvent = {
                type: "Add",
                match_id: HookedMatch.id,
                data: {
                    match_id: HookedMatch.id,
                    type: HookedMatch.sport.segments[HookedMatch.data.state].name.en + " Starts",
                    time: HookedMatch.sport.segments[HookedMatch.data.state].initialTime,
                    state: HookedMatch.data.state,
                    timeline_event: true
                }
            };
            HookedMatch.AddEvent(startEvent);
        }

        // Check if we should initiate a match timer to change the main TIME property.
        startMatchTimer();

        return HookedMatch;
    };

    startMatchTimer();

    function startMatchTimer() {

        Timers.clear();

        if (!HookedMatch.sport.segments[HookedMatch.data.state].timed) { console.log("No need to be timed."); return; }

        console.log("Start Match Timer for Match [ID: " + HookedMatch.id + "] ");
        var segment = HookedMatch.data.timeline[HookedMatch.data.state];

        var segmentStart = segment.start;
        var secondsToMinuteTick = 60 - moment.duration(moment().diff(moment(segment.start))).seconds();

        // Set the TIME property
        HookedMatch.data.time = calculatedMatchTimeFor();
        HookedMatch.data.save().then(function () { console.log("[MatchModule] Match [ID: " + HookedMatch.id + "] has reached " + HookedMatch.data.time + "'"); });

        Timers.Timeout = setTimeout(function () {
            HookedMatch.data.time = calculatedMatchTimeFor();
            HookedMatch.data.save().then(function () { console.log("[MatchModule] Match [ID: " + HookedMatch.id + "] has reached " + HookedMatch.data.time + "'"); });

            Timers.matchTimer = setInterval(function () {
                HookedMatch.data.time = calculatedMatchTimeFor();
                HookedMatch.data.save().then(function () { console.log("[MatchModule] Match [ID: " + HookedMatch.id + "] has reached " + HookedMatch.data.time + "'"); });
                //TODO: Methods called every minute the game concludes one minute. Send Event for example.
            }, 60000)
        }, secondsToMinuteTick * 1000);
    }



    function calculatedMatchTimeFor() {
        var segment = HookedMatch.data.timeline[HookedMatch.data.state];
        var intitial = HookedMatch.sport.segments[HookedMatch.data.state].initialTime;
        var duration = moment.duration(moment().diff(moment(segment.start))).subtract(segment.break_time, 'seconds').asMinutes();//.add(1, 'minute');//.add(1, 'minute');//.subtract(segment.break_time, 'seconds');
        return Math.ceil(intitial + duration);
    }


    // TODO: Create a method that will stop timer and add the duration to the Break_Time property of the segment

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

    HookedMatch.AddEvent = function (event, cbk) {

        event.data = new matchEvents(event.data);

        // console.log("Linked: "+ StatsHelper.Parse(event, match, log));

        //        console.log("When adding event:");
        //        console.log(HookedMatch.data.timeline[this.data.state]);

        var evtObject = event.data;



        // Parses the event based on sport and makes changes in the match instance
        if (event.data.stats != null) {
            evtObject.linked_mods = StatsHelper.Parse(event, match);
            //Detour process in case of 'Goal'
            if (evtObject.stats.Goal) {
                if (evtObject.team == "home_team")
                    HookedMatch.data.home_score++;
                else
                    HookedMatch.data.away_score++;
            }
        }

        // 1. push event in timeline
        if (evtObject.timeline_event) {
            log.info("Received Timeline event");
            if (evtObject.type)
                evtObject.type = cleanSafe(evtObject.type);
            // evtObject = new matchEvents(evtObject);
            this.data.timeline[this.data.state].events.push(evtObject);
        }

        // 2. broadcast event on pub/sub channel
        log.info("Pushing event to Redis Pub/Sub channel");
        // PubChannel.publish("socketServers", JSON.stringify(event));
            
        // 3. send event to wildcards module for wildcard resolution
        HookedMatch.gamecards.ResolveEvent(event);

        // 4. save match to db
        // if (evtObject.timeline_event) {
            // this.data.markModified('timeline');
            // log.info("Updating database");
        // }

        StatsHelper.UpsertStat("system", {
            events_sent: 1
        }, this.data, "system");

        this.data.markModified('stats');
        
        
         // Add 'created' property in the socket event data for easier sorting on clients 
        event.data = event.data.toObject();
        event.data.created = moment().utc().format();
       
        // Inform Clients for the new event to draw
        PubChannel.publish("socketServers", JSON.stringify({
            sockets: true,
            payload: {
                type: "Event_added",
                room: event.data.match_id.toString(),
                data: event.data
            }
        }
        ));
        
        // Inform the system about the stat changes
        PubChannel.publish("socketServers", JSON.stringify({
            sockets: true,
            payload: {
                type: "Stats_changed",
                room: event.data.match_id.toString(),
                data: match.stats
            }
        }
        ));

        this.data.save(function (err, done) {
            if (err)
                return log.error(err.message);
            if (cbk)
                cbk(null, evtObject);

            return HookedMatch;
        });


    };

    /*  RemoveEvent
     
    */
    HookedMatch.RemoveEvent = function (event) {

        // Parses the event based on sport and makes changes in the match instance
        StatsHelper.Parse(event, match);


        var eventObj = _.find(this.data.timeline[event.data.state].events, {
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
        // this.data.markModified('timeline');
       

        StatsHelper.UpsertStat("system", {
            events_sent: 1
        }, this.data, "system");
        this.data.markModified('stats');

        this.data.save(function (err, done) {
            if (err)
                log.error(err.message);
        });

        // 4. return match to Sender
        return HANDLE_EVENT_REMOVAL(event.data, this);
    }

    /*  RemoveEvent
     
    */
    HookedMatch.UpdateEvent = function (event, cbk) {

        // console.log(event.data._id);
        //  console.log(this.data.timeline[event.data.state]);
        var eventToUpdate = _.find(this.data.timeline[event.data.state].events, function (o) {
            return o._id == event.data._id;
        });

        // We have an update to players
        if (eventToUpdate.players && eventToUpdate.players.length < event.data.players.length) {
            event.data.linked_mods = StatsHelper.UpdateEventStat([event.data.players[0]._id], event.data.stats, [event.data.players[0].name], this.data, eventToUpdate.linked_mods);
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
        // this.data.markModified('timeline');
        log.info("Updating database");

        // StatsHelper.UpsertStat(match.id, {
        //     events_sent: 1
        // }, this.data);
        this.data.markModified('stats');

        this.data.save(function (err, done) {
            if (err)
                return log.error(err.message);
            if (cbk)
                cbk(null, eventToUpdate);

            return HookedMatch;
        });
    };

    // method to be called when the match is over. Disposes and releases handlers, timers, and takes care of loose ends.
    HookedMatch.Terminate = function () {
        Timers.clear();
        this.data.completed = true;
         this.data.save(function (err, done) {
            if (err)
                 log.error(err.message);
         });
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

function cleanSafe(str) {
    // remove spaces
    return str.replace(/ /g, '_');
}

module.exports = matchModule;
