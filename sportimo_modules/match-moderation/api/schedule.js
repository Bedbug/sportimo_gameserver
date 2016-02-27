/**
 * API Routes that handle Scheduled Matches
 */

var express = require('express'),
    router = express.Router();

module.exports = function (ModerationModule, log) {
    
     // GET all schedule
    router.get('/v1/schedule/', function (req, res) {
        log("[SCHEDULE] Request all Matches Schedule.", "info");
        ModerationModule.GetSchedule(res);
    });
    
    // GET a match from schedule
    router.put('/v1/schedule/:id', function (req, res) {
        log("[SCHEDULE] Updating Match info.", "info");
        ModerationModule.UpdateScheduleMatch(req.body, res);
    });
    
     // GET a match from schedule
    router.get('/v1/schedule/:id', function (req, res) {
        log("[SCHEDULE] Match request from schedule.", "info");
        return res.send(ModerationModule.GetMatch(req.params.id));
    });

    /** POST schedules a new match. 
     *  ModerationModule should handle creation in database.
    */
    router.post('/v1/schedule/', function (req, res) {
        log("[SCHEDULE] Request to schedule a new match.", "info");
        ModerationModule.AddScheduleMatch(req.body, res);
    });
   
    /** DELETE removes a match from schedule. 
     *  ModerationModule should handle deletion from database.
     */
    router.delete('/v1/schedule/:id', function (req, res) {
        
        log("[SCHEDULE] Request to remove match from schedule.", "info");
        ModerationModule.RemoveScheduleMatch(req.params.id, res);
    });
   

    return router;
}
