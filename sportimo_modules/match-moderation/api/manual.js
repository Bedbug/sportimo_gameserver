var express = require('express'),
    router = express.Router();

module.exports = function (ModerationModule, log) {


    router.post('/v1/live/match', function (req, res) {
        log("[Moderation] Request for matchid [" + req.body.id + "]", "info");
        ModerationModule.create(req.body.id, res);
    });

    router.post('/v1/live/match/time', function (req, res) {
        log("[Update Segment Time] Request for matchid [" + req.body.id + "]", "info");
        //        ModerationModule.GetMatch(req.body.id).updateTimes(req.body, res);
    });

    router.post('/v1/live/match/time/remove', function (req, res) {
        log("[Update Segment Time] Request for matchid [" + req.body.id + "]", "info");
        ModerationModule.GetMatch(req.body.id).removeSegment(req.body, res);
    });

    router.post('/v1/live/match/reload', function (req, res) {
        log("[Reload Match] Request for matchid [" + req.body.id + "]", "info");
        ModerationModule.LoadMatchFromDB(req.body.id, res);
    });

    router.put('/v1/live/match', function (req, res) {
        req.body.last_action_time = moment();
    });
    
    router.get('/v1/live/match/:id', function (req, res) {
        return res.send(ModerationModule.GetMatch(req.params.id));
    });

    // Set up manual Moderation Routes
    router.get('/v1/moderation/:id/event', function (req, res) {
        res.send("All ok");
    });

    router.post('/v1/moderation/:id/event', function (req, res) {
        var match_id = req.params.id;
        switch (req.body.type) {
            case "Delete":
                log("[moderation-service] Remove Event Request for matchid [" + match_id + "] and event ID [" + req.body.data.event_id + "]", "info");
                ModerationModule.GetMatch(match_id).RemoveEvent(req.body, res);
                break;
            case "Update":
                log("[moderation-service] Update Event Request for matchid [" + match_id + "] and event ID [" + req.body.data.id + "]", "info");
                ModerationModule.GetMatch(match_id).UpdateEvent(req.body, res);
                break;
            case "Add":
                log("Add Event Request for matchid [" + match_id + "] with event ID [" + req.body.data.id + "]", "info");
                ModerationModule.GetMatch(match_id).AddEvent(req.body, res);
                break;
            case "AdvanceSegment":
                console.log(req.body);
                log("Advance Segment Request for matchid [" + match_id + "]", "info");
                ModerationModule.GetMatch(match_id).AdvanceSegment(req.body, res);
                break;
            default:
                break;
        }


    });

    return router;
}
