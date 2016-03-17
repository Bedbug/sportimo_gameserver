/**
 * API Routes that handle Scheduled Matches
 */

var express = require('express'),
    router = express.Router();

module.exports = function(ModerationModule, log) {

    // GET all schedule
    router.get('/v1/schedule/', function(req, res) {
        log("[SCHEDULE] Request all Matches Schedule.", "info");
        ModerationModule.GetSchedule(res);
    });
    
    // GET all schedule
    router.get('/v1/schedule/country/:country', function(req, res) {
        log("[SCHEDULE] Request all Matches Schedule.", "info");
        ModerationModule.GetSchedule(res);
    });

    // GET a match from schedule
    router.put('/v1/schedule/:id', function(req, res) {
        log("[SCHEDULE] Updating Match info.", "info");
        ModerationModule.UpdateScheduleMatch(req.body, res);
    });

    // GET a match from schedule
    router.get('/v1/schedule/:id', function(req, res) {
        // console.log(req.params.id);
        log("[SCHEDULE] Match request from schedule.", "info");
        // try {
            var matchFound = ModerationModule.GetMatch(req.params.id);
            // console.log("Do we have a match: "+matchFound);
           
            if (!matchFound)
                return res.status(404).json({ error: 'match id ' + req.params.id + ' was not found.' });
           
            return res.status(200).json(matchFound);
        // }
        // catch (err) {
        //     console.log(err);
        //     res.status(500).json({ error: err.message });
        // }
    });

    /** POST schedules a new match. 
     *  ModerationModule should handle creation in database.
    */
    router.post('/v1/schedule/', function(req, res) {
        log("[SCHEDULE] Request to schedule a new match.", "info");
        // try {
            ModerationModule.AddScheduleMatch(req.body, res);
      
        // }
        // catch (error) {
        //     return res.sendStatus(500).json({ error: error.message });
        // }
    });

    /** DELETE removes a match from schedule. 
     *  ModerationModule should handle deletion from database.
     */
    router.delete('/v1/schedule/:id', function(req, res) {

        log("[SCHEDULE] Request to remove match from schedule.", "info");
        try {
            ModerationModule.RemoveScheduleMatch(req.params.id, res);
        }
        catch (error) {
            return res.status(500).json({ error: error.message });
        }
    });


    return router;
}
