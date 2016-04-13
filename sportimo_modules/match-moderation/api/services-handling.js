var express = require('express'),
    router = express.Router();

module.exports = function (ModerationModule) {

    /* Moderation services Handling */
    router.post('/v1/moderation/:id/service/add', function (req, res) {
        var match_id = req.params.id;
        var result = ModerationModule.GetMatch(match_id).AddModerationService(req.body.service);
        if (result.error != null)
            return res.status(302).json({ error: result.error });
        
        return res.status(200).send();
    });

    return router;
}
