var express = require('express'),
    router = express.Router(),
    log = require('winston');


module.exports = function (wildcardModule) {


    // Get existing template wildcards
    // Used by the dashboard
    router.get('/v1/wildcards/templates', function(req, res) {
        wildcardModule.getTemplates(function(error, data) {
            if (error)
                res.status(400).json({ error: error });
            res.status(200).json({ error: null, data: data });
        });
    });
    
    
    // upsert existing template wildcards
    // Used by the dashboard
    router.post('/v1/wildcards/templates', function(req, res) {
         wildcardModule.upsertTemplate(req.body, function(error, data) {
            if (error)
                res.status(400).send(error.message);
            res.status(200).json({ error: null, data: data });                
        });
    });


    // Get existing definition wildcards for a specific matchId (to populate the cards rolodex)
    // Used by both the dashboard and the clients
    router.get('/v1/wildcards/:matchId/definitions', function(req, res) {
        wildcardModule.getDefinitions(function(error, data) {
            if (error)
                res.status(400).json( { error: error });
            res.status(200).json({ error: null, data: data });
        });
    });
    
    
    // upsert existing definition wildcards for a specific matchId
    // Used by the dashboard
    router.post('/v1/wildcards/:matchId/definitions', function(req, res) {
        wildcardModule.upsertDefinition(req.body, function(error, data) {
            if (error)
                res.status(400).json({ error: error });
            res.status(200).json({error: null, data: data});                
        });
    });

    /**
     * ADD
     * Adds a new wildcard. Data for the wildcard are incorporated
     * in the post body. Look in /models/wildcard.js for more info.
     * 
     * Post body sample:
     * {
            "wildcardDefinitionId": "",
            "userId": "",
            "creationTime": "",
            
     }
     
     Used by clients
     */
    router.post('/v1/wildcards/:matchId/users', function (req, res) {
        wildcardModule.addUserInstance(req.params.matchId, req.body, function(error, validationError, data) {
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
    router.delete('/v1/wildcards/:matchId/users', function (req, res) {
        wildcardModule.deleteUserInstance(req.body.id, function(error, data) {
            if (error)
                return res.status(500).json({ error: error.message });
            return res.status(200).json({ error: null, data: data });
        });
    });


    return router;
}
