var express = require('express'),
    router = express.Router();

module.exports = function (ModerationModule) {

    /* Moderation services Handling */
    router.post('/v1/moderation/:id/service/add', function (req, res) {
        var match_id = req.params.id;
        ModerationModule.GetMatch(match_id).AddModerationService(req.body.service, res);
    });

    return router;
}
