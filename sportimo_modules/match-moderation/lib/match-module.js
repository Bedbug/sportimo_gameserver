/**
 * Match_Module is the main Class regarding matches in the Sportimo Platform.
 * It handles all match related stuff. From match infos to actual
 * database hooks and syncing. 
 * All moderation services will have to register on this object in order to 
 * function and will call methods on this object in order to moderate it.
 */

var Sports = require('./sports-settings');
var StatsHelper = require('./stats-handler');
var moment = require('moment');
var _ = require('lodash'),
    StatMods = require('../models/stats-mod');

var path = require('path'),
    fs = require('fs');

/*Bootstrap service*/
var services = [];
var servicesPath = path.join(__dirname, '../services');
fs.readdirSync(servicesPath).forEach(function (file) {
    services[path.basename(file, ".js")] = require(servicesPath + '/' + file);
});


var matchModule = function (match, MatchTimers, PubChannel, log) {
    
    var moderationServices = [];

    var HookedMatch = {}; // = match;

    //HookedMatch.MODERATION_SERVICES = [];

    // Holds the interval that counts time
    // HookedMatch.Time_interval = null;
    // Holds the actual running time (i.e. 10m:34s)
    HookedMatch.Match_timer = "";

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
    
    HookedMatch.GetModerationServices = function()
    {
        return moderationServices;
    };
    
    HookedMatch.AddModerationService = function (service, res) {

        // Check if service of same type already exists 
        if (_.findWhere(HookedMatch.moderation, {
                type: service.type
            })) {
            log("Service already active", "core");
            return res.send("Service type already active. Please remove the old one first.");
        } else {
            HookedMatch.moderation.push(service);
            HookedMatch.StartService(service);
        }
    }

    HookedMatch.StartService = function (service) {
        var newService = services[service.type];

        _.merge(newService, service);

        //HookedMatch.MODERATION_SERVICES.push(newService);
        moderationServices.push(newService);
        
        // init the service by passing this as a context reference for internal communication (sending events)
        //HookedMatch.MODERATION_SERVICES[HookedMatch.MODERATION_SERVICES.length - 1].init(this);
        newService.init(this);
    }


    // Set services for the first time
    HookedMatch.moderation = match.moderation;
    HookedMatch.moderation.forEach(function (service) {
        HookedMatch.StartService(service);
    });


    HookedMatch.removeSegment = function (data, res) {

        this.data.timeline.splice(data.index, 1);

        HookedMatch.data.state--;

        this.data.markModified('timeline');
        this.data.save();

        res.status(200).send(HookedMatch);
    }

    HookedMatch.updateTimes = function (data, res) {
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

        res.status(200).send(HookedMatch);
    }

    /*  AdvanceSegment
        The advance state method is called when we want to advance to the next segment of the game.
        Depending on setting, here will determine if a timer should begin counting aand hold the
        game's time.
    */
    HookedMatch.AdvanceSegment = function (event, res) {

        HookedMatch.AdvanceSegmentCore(event);

        return res.status(200).send(HookedMatch);
    }
    
    // This is the core used by both the module API and the rss-feed service.
    HookedMatch.AdvanceSegmentCore = function(event)
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

        //  Does it have initial time?
        // if (HookedMatch.sport.segments[this.data.state].initialTime)
        //     this.data.time = HookedMatch.sport.segments[this.data.state].initialTime;

        //     if (HookedMatch.sport.segments[this.data.state].initialTime)
        //     this.data.time = HookedMatch.sport.segments[this.data.state].initialTime;
        // else
        //     this.data.time = "";

        // HookedMatch.Match_timer = "";

        this.addTimeHooks();

        this.data.markModified('timeline');
        this.data.save();
    };



    HookedMatch.addTimeHooks = function () {

        // In Case match State is erroneous
        if (this.data.state > this.data.timeline.length - 1)
            this.data.state = this.data.timeline.length - 1;

        //  Should this segment be timed?
        if (HookedMatch.sport.segments[this.data.state].timed) {
            if (HookedMatch.sport.segments[HookedMatch.data.state]) {
                var now = moment().utc();
                var then = moment(HookedMatch.data.timeline[HookedMatch.data.state].start);
                var ms = moment(now, "DD/MM/YYYY HH:mm:ss").diff(moment(then, "DD/MM/YYYY HH:mm:ss"));
                var d = moment.duration(ms);


                HookedMatch.Match_timer = HookedMatch.sport.segments[this.data.state].timed ? d.format("mm:ss", {
                    trim: false
                }) : "";
                HookedMatch.data.time = (HookedMatch.sport.segments[this.data.state].initialTime || 0) + parseInt(d.add(1, "minute").format("m")) + "";

                if (!HookedMatch.sport.time_dependant) { //  Is Time controlled?
                    MatchTimers[this.data.match_id] = setInterval(function () {
                        var now = moment().utc();
                        var then = moment(HookedMatch.data.timeline[HookedMatch.data.state].start);
                        var ms = moment(now, "DD/MM/YYYY HH:mm:ss").diff(moment(then, "DD/MM/YYYY HH:mm:ss"));
                        var d = moment.duration(ms);
                        HookedMatch.Match_timer = d.format("mm:ss", {
                            trim: false
                        });
                        // console.log(d.format("mm"));
                        //  console.log(now);
                        //  console.log(then);

                        HookedMatch.data.time = (HookedMatch.sport.segments[HookedMatch.data.state].initialTime || 0) + parseInt(d.add(1, "minute").format("m")) + "";

                    }, 1000);
                }
            } else {
                clearInterval(MatchTimers[this.data.match_id]);
            }
        } else {
            clearInterval(MatchTimers[this.data.match_id]);
        }
    }


    /*  ToggleTimer
        Toggles the game's timer state.
    */
    HookedMatch.ToggleTimer = function () {
        if (this.Time_interval) {
            clearInterval(MatchTimers[this.data.match_id]);
        } else {
            MatchTimers[this.data.match_id] = setInterval(function () {
                HookedMatch.countTime();
            }, 1000)
        }
    }
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
    HookedMatch.AddEvent = function (event, res) {
        HookedMatch.AddEventCore(event);
        
        // 4. return match to Sender
        return res.status(200).send(HookedMatch); //HookedMatch

    };


    HookedMatch.AddEventCore = function (event)
    {
        // console.log("Linked: "+ StatsHelper.Parse(event, match, log));

        //        console.log("When adding event:");
        //        console.log(HookedMatch.data.timeline[this.data.state]);

        var evtObject = event.data;

        // Parses the event based on sport and makes changes in the match instance
        evtObject.linked_mods = StatsHelper.Parse(event, match, log);

        // 1. push event in timeline
        if (evtObject.timeline_event) {
            log("Received Timeline event", "info");
            this.data.timeline[this.data.state].events.push(evtObject);
        }

        // 2. broadcast event on pub/sub channel
        log("Pushing event to Redis Pub/Sub channel", "info");
        PubChannel.publish("socketServers", JSON.stringify(event));

        // 3. save match to db
        if (evtObject.timeline_event) {
            this.data.markModified('timeline');
            log("Updating database", "info");
        }

        StatsHelper.UpsertStat(match.id, {
            events_sent: 1
        }, this.data);

        this.data.markModified('stats');

        this.data.save();
    };

    /*  RemoveEvent
     
    */
    HookedMatch.RemoveEvent = function (event, res) {

        // Parses the event based on sport and makes changes in the match instance
        StatsHelper.Parse(event, match, log);


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
        log("Updating database", "info");

        StatsHelper.UpsertStat(match.id, {
            events_sent: 1
        }, this.data);
        this.data.markModified('stats');

        this.data.save();

        // 4. return match to Sender
        return HANDLE_EVENT_REMOVAL(event.data, res, this);
        //        res.status(200).send(this);
    }

    /*  RemoveEvent
     
    */
    HookedMatch.UpdateEvent = function (event, res) {

        // Parses the event based on sport and makes changes in the match instance
        StatsHelper.Parse(event, match, log);

        for (var i = 0; i < this.data.timeline[event.data.state].events.length; i++) {
            if (this.data.timeline[event.data.state].events[i].id == event.data.id && this.data.timeline[event.data.state].events[i].match_id == event.match_id) {
                this.data.timeline[event.data.state].events[i] = event.data;
                break;
            }
        }

        // Broadcast the remove event so others can consume it.
        PubChannel.publish("socketServers", JSON.stringify(event));

        // 3. save match to db
        this.data.markModified('timeline');
        log("Updating database", "info");

        StatsHelper.UpsertStat(match.id, {
            events_sent: 1
        }, this.data);
        this.data.markModified('stats');

        this.data.save();

        // 4. return match to Sender
        return res.status(200).send();
    }

    HookedMatch.addTimeHooks();

    return HookedMatch;
}


// TODO: [x] Stats update according to the removal of a previous stat modifier 
// TODO: Add validation after event removal and stats update. There should be a looped process wher each card player after the removed event is validated for win.
var HANDLE_EVENT_REMOVAL = function (linked, res, returnData) {

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
                }, function (err, doc) {});

            // 3. Remove the document from the collection
            mod.remove(function (err) {
                finished--;

                if (finished == 0)
                    res.status(200).send(returnData);

            });
        });
    });

};

module.exports = matchModule;
