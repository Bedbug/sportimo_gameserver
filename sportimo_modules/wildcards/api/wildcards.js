var express = require('express'),
    router = express.Router(),
    moment = require('moment');

var WildcardCtrl = require('../controllers/wildcard');


module.exports = function (wildcardModule) {

    /**
     * POST
     */
    router.post('/v1/wildcards', function (req, res) {
        return res.send(wildcardModule.add(
                new WildcardCtrl(req.body)
            ));
    });

    /**
     * DELETE
     */
    router.delete('/v1/wildcards', function (req, res) {
        return res.send(wildcardModule.delete(req.body.id));
    });


    return router;
}
