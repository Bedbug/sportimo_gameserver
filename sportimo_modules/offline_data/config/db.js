'use strict';
var mongoose = require('mongoose');
//mongodb://devuser:3rgfgWERg34g34wFE45634eg3g5HAH34t3qrtSREGSE345s5sghstGw45gsg45wtsbtSRHw4g5-sergse3245-aerg345@46.101.100.145:27017/dev
var config = {
//   "db": "sportimov2",  
//   "host": "ds027835.mongolab.com",  
//   "user": "bedbug",
//   "pw": "a21th21",
//   "port": "27835"
   "db": "sportimo2?replicaSet=rs-ds021165",  
   "host": "ds021165-a0.mlab.com",  
   "user": "bedbug",
   "pw": "a21th21",
   "port": "21165"
//      "db": "sportimo_mbc",  
//    "host": "ds059726-a0.mlab.com",  
//    "user": "bedbug",
//    "pw": "a21th21",
//    "port": "59726"
};

var port = (config.port.length > 0) ? ":" + config.port : '';
var login = (config.user.length > 0) ? config.user + ":" + config.pw + "@" : '';
var uristring = "mongodb://" + login + config.host + port + "/" + config.db;

var mongoOptions = { db: { safe: true } };

// Connect to Database
// console.log("Mongoose Connection State: "+mongoose.connection.readyState);
if (mongoose.connection.readyState == 0)
    mongoose.connect(uristring, mongoOptions, function(err, res) {
        if (err) {
            console.log('ERROR connecting to: ' + uristring + '. ' + err);
        } else {
            console.log('Successfully connected to: ' + uristring);
        }
    });

exports.mongoose = mongoose;