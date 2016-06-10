// Module dependencies.
var mongoose = require('mongoose'),
Competition = mongoose.models.competitions,
Matches = mongoose.models.scheduled_matches,
Standings = mongoose.models.standings,
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
  Competition.findByIdAndUpdate(id, updateData, function (err, competition) {
   
   
    return Matches.update({ competition: id }, updateData,function(err,data){
        if(!err)
         Standings.update({ competitionid: id }, { $set: { visiblein: updateData["visiblein"] }},function(err,data){
             if(!err)
                return cbf(cb,err,competition.toObject()); 
         });
    });

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
