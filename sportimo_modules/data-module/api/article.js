// Module dependencies.
var express = require('express'),
    router = express.Router(),
    mongoose = require('mongoose'),
    article = mongoose.models.article,
    api = {};
    

// ALL
api.articlesSearch = function (req, res) {
    var skip = null, limit = null;
    //  publishDate: { $gt: req.body.minDate, $lt: req.body.maxDate }, type: req.body.type, tags: { "$regex": req.body.tags, "$options": "i" }
    var queries = {};

    if (req.body.minDate != undefined || req.body.maxDate != undefined) {
        queries.publishDate = {};
        if (req.body.minDate == req.body.maxDate) {
            queries.publishDate.$eq = req.body.minDate;
        } else
            if (req.body.minDate != undefined)
                queries.publishDate.$gte = req.body.minDate;
        if (req.body.maxDate != undefined)
            queries.publishDate.$lt = req.body.maxDate;
    }
    
    if (req.body.tags != undefined)
        queries['tags.name.en'] = { "$regex": req.body.tags, "$options": "i" };

    if (req.body.related != undefined)
        queries['tags._id'] = req.body.related;

    if (req.body.type != undefined)
        queries.type = req.body.type;

    var q = article.find(queries);

    if (req.body.limit != undefined)
        q.limit(req.body.limit);

    q.exec(function (err, articles) {

        return res.send(articles);
    });

};

// POST
api.addarticle = function (req, res) {

    if (req.body == 'undefined') {
        return res.status(500).json('No Article Provided. Please provide valid team data.');
    }

    var newItem = new article(req.body);

    return newItem.save(function (err, data) {
        if (!err) {
            return res.status(200).json(data);
        } else {
            return res.status(500).json(err);
        }
    });
    
};

// GET
api.article = function (req, res) {
    var id = req.params.id;

};

// PUT
api.editArticle = function (req, res) {
    var id = req.params.id;
    var updateData = req.body;
    article.findById(id, function (err, art) {

        if (updateData === undefined || art === undefined) {
            return res.status(500).json("Error: Data is not correct.");
        }
        
        art.photo = updateData.photo;
        art.tags = updateData.tags;
        art.publishDate = updateData.publishDate;
        art.type = updateData.type;
        art.publication = updateData.publication;
        // art.markModified('tags');

        return art.save(function (err, data) {
            if (!err) {
                return res.status(200).json(data);
            } else {
                return res.status(500).json(err);
            }
        }); //eo team.save
    });// eo team.find
	

};

// DELETE
api.deleteArticle = function (req, res) {
    var id = req.params.id;

};



/*
=====================  ROUTES  =====================
*/

router.route('/v1/data/articles/search')
    .post(api.articlesSearch);

router.post('/v1/data/articles', api.addarticle);

router.route('/v1/data/articles/:id')
    .get(api.article)
    .put(api.editArticle)
    .delete(api.deleteArticle);

module.exports = router;