// Module dependencies.
var mongoose = require('mongoose'),
Competition = mongoose.models.Competition,
api = {},
l=require('../config/lib');



/*
========= [ CORE METHODS ] =========
*/

// ALL
api.getAllCompetitions = function (skip,limit,cb) {
  var q=Competition.find();
  
  if(skip!=undefined)
    q.skip(skip*1);

  if(limit!=undefined)
    q.limit(limit*1);

  return q.exec(function(err, competitions) {
    cbf(cb,err,competitions);    
  });
};

// GET
api.getCompetition = function (id,cb) {

  Competition.findOne({ '_id': id }, function(err, competition) {
    cbf(cb,err,competition);
  });
};

// POST
api.addCompetition = function (competition,cb) {

  if(competition == 'undefined'){
    cb('No Competition Provided. Please provide valid competition data.');
  }

  competition = new Competition(competition);

  competition.save(function (err) {
    cbf(cb,err,competition.toObject());
  });
};

// PUT
api.editCompetition = function (id,updateData, cb) {
  Competition.findById(id, function (err, competition) {
   
   if(updateData===undefined || competition===undefined){
    return cbf(cb,'Invalid Data. Please Check competition and/or updateData fields',null); 
  }
  
  
    if(typeof updateData["name"] != 'undefined'){
      competition["name"] = updateData["name"];
    }
    
    if(typeof updateData["visiblein"] != 'undefined'){
      competition["visiblein"] = updateData["visiblein"];
    }
    
    if(typeof updateData["logo"] != 'undefined'){
      competition["logo"] = updateData["logo"];
    }
    
    if(typeof updateData["parserids"] != 'undefined'){
      competition["parserids"] = updateData["parserids"];
    }
    
    if(typeof updateData["created"] != 'undefined'){
      competition["created"] = updateData["created"];
    }
    

  return competition.save(function (err) {
    cbf(cb,err,competition.toObject()); 
    }); //eo competition.save
  });// eo competition.find
};

// DELETE
api.deleteCompetition = function (id,cb) {
  return Competition.findById(id).remove().exec(function (err, competition) {
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


api.deleteAllCompetitions = function (cb) {
  return Competition.remove({},function (err) {
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
