var express = require('express'),
    router = express.Router();


var WildcardCtrl = require('../controllers/wildcard');


module.exports = function (wildcardModule) {

    /**
     * ADD
     * Adds a new wildcard. Data for the wildcard are incorporated
     * in the post body. Look in /models/wildcard.js for more info.
     */
    router.post('/v1/wildcards', function (req, res) {
        return res.send(wildcardModule.add(
                new WildcardCtrl(req.body)
            ));
    });

    /**
     * DELETE
     * Delete function is only available for unit testing. No real
     * other functionality.
     */
    router.delete('/v1/wildcards', function (req, res) {
        return res.send(wildcardModule.delete(req.body.id));
    });


    return router;
}
