// Module dependencies.
var mongoose = require('mongoose'),
Team = mongoose.models.Team,
api = {},
l=require('../config/lib');



/*
========= [ CORE METHODS ] =========
*/

// ALL
api.getAllTeams = function (skip,limit,cb) {
  var q=Team.find();
  
  if(skip!=undefined)
    q.skip(skip*1);

  if(limit!=undefined)
    q.limit(limit*1);

  return q.exec(function(err, teams) {
    cbf(cb,err,teams);    
  });
};

// GET
api.getTeam = function (id,cb) {

  Team.findOne({ '_id': id }, function(err, team) {
    cbf(cb,err,team);
  });
};

// POST
api.addTeam = function (team,cb) {

  if(team == 'undefined'){
    cb('No Team Provided. Please provide valid team data.');
  }

  team = new Team(team);

  team.save(function (err) {
    cbf(cb,err,team.toObject());
  });
};

// PUT
api.editTeam = function (id,updateData, cb) {
  Team.findById(id, function (err, team) {
   
   if(updateData===undefined || team===undefined){
    return cbf(cb,'Invalid Data. Please Check team and/or updateData fields',null); 
  }
  
  
    if(typeof updateData["name"] != 'undefined'){
      team["name"] = updateData["name"];
    }
    
    if(typeof updateData["name_en"] != 'undefined'){
      team["name_en"] = updateData["name_en"];
    }
    
    if(typeof updateData["logo"] != 'undefined'){
      team["logo"] = updateData["logo"];
    }
    
    if(typeof updateData["league"] != 'undefined'){
      team["league"] = updateData["league"];
    }
    
    if(typeof updateData["parser"] != 'undefined'){
      team["parser"] = updateData["parser"];
    }
    
    if(typeof updateData["created"] != 'undefined'){
      team["created"] = updateData["created"];
    }
    

  return team.save(function (err) {
    cbf(cb,err,team.toObject()); 
    }); //eo team.save
  });// eo team.find
};

// DELETE
api.deleteTeam = function (id,cb) {
  return Team.findById(id).remove().exec(function (err, team) {
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


api.deleteAllTeams = function (cb) {
  return Team.remove({},function (err) {
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
