// Module dependencies.
var mongoose = require('mongoose'),
Item = mongoose.models.Item,
api = {};

//Common Callback Function Utility
var cbf=function(cb,err,data){
  if(cb && typeof(cb)=='function'){
    if(err) cb(err);
    else cb(false,data);
  }
};

// ALL
api.getAllItems = function (cb) {
  return Item.find(function(err, items) {
    cbf(cb,err,items);    
  });
};

// GET
api.getItem = function (id,cb) {
  Item.findOne({ '_id': id }, function(err, item) {
    cbf(cb,err,item);
  });
};

//Some
api.getItems = function (offset,limit,cb) {
  return Item.find({ skip: offset, limit: limit },function(err, items) {
    cbf(cb,err,items);    
  });
};

// POST
api.addItem = function (item,cb) {

  if(item == 'undefined'){
    cb('No Item Provided. Please provide valid item data.');
  }

  item = new Item(item);

  item.save(function (err) {
    cbf(cb,err,item.toObject());
  });
};

// PUT
api.editItem = function (id,updateData, cb) {
  Item.findById(id, function (err, item) {

    
    
      if(typeof updateData["name"] != 'undefined'){
        item["name"] = updateData["name"];
      }
      
      if(typeof updateData["price"] != 'undefined'){
        item["price"] = updateData["price"];
      }
      

    return item.save(function (err) {
      cbf(cb,err,item.toObject()); 
    }); //eo item.save
  });// eo item.find
};

// DELETE
api.deleteItem = function (id,cb) {
  return Item.findById(id, function (err, item) {
    return item.remove(function (err) {
      cbf(cb,err,true);      
    });
  });
};


module.exports = api;
