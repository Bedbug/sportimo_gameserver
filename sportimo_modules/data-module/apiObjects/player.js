// Module dependencies.
var mongoose = require('mongoose'),
Player = mongoose.models.players,
api = {},
l=require('../config/lib');



/*
========= [ CORE METHODS ] =========
*/

// ALL
api.getAllPlayers = function (skip,limit,cb) {
  var q=Player.find();
  
  if(skip!=undefined)
    q.skip(skip*1);

  if(limit!=undefined)
    q.limit(limit*1);

  return q.exec(function(err, players) {
    cbf(cb,err,players);    
  });
};

// GET
api.getPlayer = function (id,cb) {

  Player.findOne({ '_id': id }, function(err, player) {
    cbf(cb,err,player);
  });
};

// POST
api.addPlayer = function (player,cb) {

  if(player == 'undefined'){
    cb('No Player Provided. Please provide valid player data.');
  }

  player = new Player(player);

  player.save(function (err) {
    cbf(cb,err,player.toObject());
  });
};

// PUT
api.editPlayer = function (id,updateData, cb) {
  Player.findById(id, function (err, player) {

   if(updateData===undefined || player===undefined){
    return cbf(cb,'Invalid Data. Please Check player and/or updateData fields',null); 
  }
  
  
    if(typeof updateData["name"] != 'undefined'){
      player["name"] = updateData["name"];
    }
    
    if(typeof updateData["team"] != 'undefined'){
      player["team"] = updateData["team"];
    }
    
    if(typeof updateData["pic"] != 'undefined'){
      player["pic"] = updateData["pic"];
    }
    
    if(typeof updateData["position"] != 'undefined'){
      player["position"] = updateData["position"];
    }
    
    if(typeof updateData["created"] != 'undefined'){
      player["created"] = updateData["created"];
    }
    

  return player.save(function (err) {
    cbf(cb,err,player.toObject()); 
    }); //eo player.save
  });// eo player.find
};

// DELETE
api.deletePlayer = function (id,cb) {
  return Player.findById(id).remove().exec(function (err, player) {
   return cbf(cb,err,true);      
 });
};


/*
========= [ SPECIAL METHODS ] =========
*/


//TEST
api.test=function (cb) {
  cbf(cb,false,{result:'ok'});
};


api.deleteAllPlayers = function (cb) {
  return Player.remove({},function (err) {
    cbf(cb,err,true);      
  });
};






/*
========= [ UTILITY METHODS ] =========
*/

/** Callback Helper
 * @param  {Function} - Callback Function
 * @param  {Object} - The Error Object
 * @param  {Object} - Data Object
 * @return {Function} - Callback
 */
 
 var cbf=function(cb,err,data){
  if(cb && typeof(cb)=='function'){
    if(err) cb(err);
    else cb(false,data);
  }
};



module.exports = api;
