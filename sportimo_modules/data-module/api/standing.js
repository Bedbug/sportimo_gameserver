// Module dependencies.
var express = require('express'),
    router = express.Router(),
    mongoose = require('mongoose'),
    item = mongoose.models.standing,
    api = {};


// ALL
api.itemsSearch = function(req, res) {
    var skip = null, limit = null;
    //  publishDate: { $gt: req.body.minDate, $lt: req.body.maxDate }, type: req.body.type, tags: { "$regex": req.body.tags, "$options": "i" }
    var queries = {};

    if (req.body.minDate != undefined || req.body.maxDate != undefined) {
        queries.publishDate = {};
        if (req.body.minDate == req.body.maxDate) {
            queries.publishDate.$eq = req.body.minDate;
        } else {
            if (req.body.minDate != undefined)
                queries.publishDate.$gte = req.body.minDate;
            if (req.body.maxDate != undefined)
                queries.publishDate.$lt = req.body.maxDate;
        }
    }

    if (req.body.tags != undefined)
        queries['tags.name.en'] = { "$regex": req.body.tags, "$options": "i" };

    if (req.body.related != undefined)
        queries['tags._id'] = req.body.related;

    if (req.body.type != undefined)
        queries.type = req.body.type;

    var q = item.find(queries);

    if (req.body.limit != undefined)
        q.limit(req.body.limit);

    q.exec(function(err, items) {

        return res.send(items);
    });

};

// POST
api.additem = function(req, res) {

    if (req.body == 'undefined') {
        return res.status(500).json('No item Provided. Please provide valid team data.');
    }

    var newItem = new item(req.body);

    return newItem.save(function(err, data) {
        if (!err) {
            return res.status(200).json(data);
        } else {
            return res.status(500).json(err);
        }
    });

};

// GET
api.item = function(req, res) {
    var id = req.params.id;
    item.findById(id, function(err, returnedItem) {
        if (!err) {
                return res.status(200).json(returnedItem);
            } else {
                return res.status(500).json(err);
            }
    });
};

// PUT
api.edititem = function(req, res) {
    var id = req.params.id;
    var updateData = req.body;
    item.findById(id, function(err, returnedItem) {

        if (updateData === undefined || returnedItem === undefined) {
            return res.status(500).json("Error: Data is not correct.");
        }

        returnedItem.photo = updateData.photo;
        returnedItem.tags = updateData.tags;
        areturnedItemrt.publishDate = updateData.publishDate;
        returnedItem.type = updateData.type;
        returnedItemart.publication = updateData.publication;
        // art.markModified('tags');

        return returnedItem.save(function(err, data) {
            if (!err) {
                return res.status(200).json(data);
            } else {
                return res.status(500).json(err);
            }
        }); //eo team.save
    });// eo team.find


};

// DELETE
api.deleteitem = function(req, res) {
    var id = req.params.id;

};



/*
=====================  ROUTES  =====================
*/

router.route('/v1/data/standings/search')
    .post(api.itemsSearch);

router.post('/v1/data/standings', api.additem);

router.route('/v1/data/standings/:id')
    .get(api.item)
    .put(api.edititem)
    .delete(api.deleteitem);

module.exports = router;