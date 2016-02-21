// Module dependencies.
var express = require('express'),
router = express.Router(),
item = require('../apiObjects/item');

var api = {};
// ALL
api.items = function (req, res) {
	item.getAllItems(function(err,data){
		if (err) {
			res.status(500).json(err);
		} else {
			res.status(200).json({items: data});
		}
	}); 
};

// POST
api.additem = function (req, res) {
	item.addItem(req.body.item,function	(err,data){
		if(err) res.status(500).json(err);
		else {
			res.status(201).json(data);
		}
	});	
};

// GET
api.item = function (req, res) {
	var id = req.params.id;
	item.getItem(id,function(err,data){
		if (err) {
			res.status(404).json(err);
		} else {
			res.status(200).json({item: data});
		}
	}); 
};

// PUT
api.editItem = function (req, res) {
	var id = req.params.id;

	return item.editItem(id,req.body.item, function (err, data) {
		if (!err) {
			console.log("updated item");
			return res.status(200).json(data);
		} else {
			return res.status(500).json(err);
		}
		return res.status(200).json(data);   
	});

};

// DELETE
api.deleteItem = function (req, res) {
	var id = req.params.id;
	return item.deleteItem(id, function (err, data) {
		if (!err) {
			console.log("removed item");
			return res.status(204).send();
		} else {
			console.log(err);
			return res.status(500).json(err);
		}
	});
};




router.get('/items', api.items);
router.post('/item',api.additem);

router.route('/item/:id')
.get(api.item)
.put(api.editItem)
.delete(api.deleteItem);


module.exports = router;
