var express = require('express'),
    router = express.Router(),
    log = require('winston');


module.exports = function (gamecardModule) {


    // Get existing template gamecards
    // Used by the dashboard
    router.get('/v1/gamecards/templates', function(req, res) {
        gamecardModule.getTemplates(function(error, data) {
            if (error)
                res.status(400).json({ error: error });
            res.status(200).json({ error: null, data: data });
        });
    });
    
    
    // upsert existing template gamecards
    // Used by the dashboard
    router.post('/v1/gamecards/templates', function(req, res) {
         gamecardModule.upsertTemplate(req.body, function(error, data) {
            if (error)
                res.status(400).send(error.message);
            res.status(200).json({ error: null, data: data });                
        });
    });


    // Get existing definition gamecards for a specific matchId
    // Used by both the dashboard and the clients
    router.get('/v1/gamecards/:matchId/definitions', function(req, res) {
        gamecardModule.getDefinitions(function(error, data) {
            if (error)
                res.status(400).json( { error: error });
            res.status(200).json({ error: null, data: data });
        });
    });
    
    
    // upsert existing definition gamecards for a specific matchId
    // Used by the dashboard
    router.post('/v1/gamecards/:matchId/definitions', function(req, res) {
        gamecardModule.upsertDefinition(req.body, function(error, data) {
            if (error)
                res.status(400).json({ error: error });
            res.status(200).json({error: null, data: data});                
        });
    });
    
    /**
     * GET user gamecards
     * used by clients to populate their gamecard rolodex.
     */
    router.get('/v1/gamecards/:matchId/user/:userId', function (req, res) {
        gamecardModule.getUserInstances(req.params.matchId, req.params.userId, function(error, data) {
            if (error)
                return res.status(500).json({ error: error.message });
            log.debug(data);
            return res.status(200).json({ error: null, data: data });
        });
    });

    /**
     * ADD
     * Adds a new gamecard. Data for the gamecard are incorporated
     * in the post body. Look in /models/gamecards.js for more info.
     * 
     * Post body sample:
     * {
            "wildcardDefinitionId": "",
            "userId": "",
            "creationTime": "",
            
     }
     
     Used by clients
     */
    router.post('/v1/gamecards/:matchId/users', function (req, res) {
        gamecardModule.addUserInstance(req.params.matchId, req.body, function(error, validationError, data) {
            if (error)
                return res.status(500).json({ error: error.message });
            if (validationError)
                return res.status(400).json({ error: validationError.message });
            log.debug(data);
            return res.status(200).json({ error: null });
        });
    });
    
    
    /**
     * DELETE
     * Delete function is only available for unit testing. No real
     * other functionality.
     */
    router.delete('/v1/gamecards/:matchId/users', function (req, res) {
        gamecardModule.deleteUserInstance(req.body.id, function(error, data) {
            if (error)
                return res.status(500).json({ error: error.message });
            return res.status(200).json({ error: null, data: data });
        });
    });


    return router;
}
