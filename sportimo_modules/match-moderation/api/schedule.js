/**
 * API Routes that handle Scheduled Matches
 */

var express = require('express'),
    router = express.Router();

module.exports = function (ModerationModule, log) {

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
    router.delete('/v1/schedule/', function (req, res) {
        log("[SCHEDULE] Request to remove match from schedule.", "info");
        ModerationModule.RemoveScheduleMatch(req.body, res);
    });

    return router;
}
