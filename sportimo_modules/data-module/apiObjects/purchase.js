// Module dependencies.
var mongoose = require('mongoose'),
Purchase = mongoose.models.purchase,
api = {},
l=require('../config/lib');
var cbf=l.responseCallback; //Aliasing auto responseCallback


/*
========= [ CORE METHODS ] =========
*/

// ALL
api.getAllPurchases = function (skip,limit,cb) {
  var q=Purchase.find();
  
  if(skip!=undefined)
    q.skip(skip*1);

  if(limit!=undefined)
    q.limit(limit*1);

  return q.exec( (err, purchases)=>{
    cbf(cb,err,{purchases:purchases,count:purchases.length}) 
  });
};

// GET
api.getPurchase = function (id,cb) {

  Purchase.findOne({ '_id': id }, (err, purchase)=>{
    if(purchase==null) return cbf(cb,'No Data Found',404);
    return cbf(cb,err,purchase);
  });
};

// POST
api.addPurchase = function (purchase,cb) {

  if(purchase == 'undefined'){
    cb('No Purchase Provided. Please provide valid purchase data.');
  }

  purchase = new Purchase(purchase);

  purchase.save((err, saved)=>{    
    cbf(cb,err, saved.toObject());
  });
};

// PUT
api.editPurchase = function (id,updateData, cb) {

  if(updateData===undefined ){
    return cbf(cb,'Invalid Data. Please Check purchase and/or updateData fields',null); 
  }

  Purchase.findById(id, (err, purchase)=>{
   
    //Force Error
    // if(item==null) return cbf(cb,'No Data Found',404); 
      
    if(typeof updateData["status"] != 'undefined'){
      purchase["status"] = updateData["status"];
    }
    
    if(typeof updateData["user"] != 'undefined'){
      purchase["user"] = updateData["user"];
    }
    
    if(typeof updateData["type"] != 'undefined'){
      purchase["type"] = updateData["type"];
    }
    
    if(typeof updateData["info"] != 'undefined'){
      purchase["info"] = updateData["info"];
    }
    
    if(typeof updateData["provider"] != 'undefined'){
      purchase["provider"] = updateData["provider"];
    }
    
    if(typeof updateData["method"] != 'undefined'){
      purchase["method"] = updateData["method"];
    }
    
    if(typeof updateData["receiptid"] != 'undefined'){
      purchase["receiptid"] = updateData["receiptid"];
    }

    if(typeof updateData["providerMessage"] != 'undefined'){
      purchase["providerMessage"] = updateData["providerMessage"];
    }
    

  var data = purchase.toObject(); //trim unnecessary data

  return purchase.save( (err)=>{
    cbf(cb,err,data); 
    }); //eo purchase.save
  });// eo purchase.find
};

// DELETE
api.deletePurchase = function (id,cb) {
  return Purchase.findById(id).remove().exec( (err, purchase)=>{
    var data='The purchase got Deleted';
    if(err) data = 'Error in deleting this purchase';
   return cbf(cb,err,data);      
 });
};


/*
========= [ SPECIAL METHODS ] =========
*/


//TEST
//New Callback System in TEST, which returns a ResponseClass object's Output
api.test=function (cb) {
  return l.responseCallback(cb,false,{name:'dummyValue'});
};

//DELETE ALL
api.deleteAllPurchases = function (cb) {
  return Purchase.remove({}, (err)=>{
    var data='All purchases got Deleted';
    if(err) data = 'Error in deleting all purchases';
   return cbf(cb,err,data);      
  });
};


// SEARCH
api.searchPurchases = function (skip,limit,keywordObj,strict,cb) {
  var k={};

  if(strict){
    k=keywordObj;
  }else{
    Object.keys(keywordObj).forEach(function(key,index) {
        k[key]=new RegExp(keywordObj[key], 'i');
    });
  }

  var q=Purchase.find(k)
  
  if(skip!=undefined)
    q.skip(skip*1);

  if(limit!=undefined)
    q.limit(limit*1);

  return q.exec( (err, purchases)=>{
    cbf(cb,err,purchases) 
  });
};


module.exports = api;
