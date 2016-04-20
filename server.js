// v 0.0.1

/*

 Game Server Modular

 Info:
 This servers has the following modules:
 
    Wildcards - This module's purpose is to register playing cards from the clients
    of the Sporimo app and handle timers and scoring.
 
    Notifications - This module's purpose is to register user actions and push notifications
    from the sportimo dashboard. 

    LiveMatches - This module's purpose is to handle active matches.

    Calendar - This module's purpose is to handle matches calendar.


 Copyright (c) Bedbug 2015
 Author: Aris Brink

 Permission is hereby granted, free of charge, to any person obtaining
 a copy of this software and associated documentation files (the
 "Software"), to deal in the Software without restriction, including
 without limitation the rights to use, copy, modify, merge, publish,
 distribute, sublicense, and/or sell copies of the Software, and to
 permit persons to whom the Software is furnished to do so, subject to
 the following conditions:

 The above copyright notice and this permission notice shall be
 included in all copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
 LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
 OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
 WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

 */

var express = require("express"),
    http = require('http'),
    bodyParser = require('body-parser'),
    redis = require('redis'),
    mongoose = require('mongoose'),
    winston = require('winston');


var TestSuite = {
    done: null
};

var app = module.exports = exports.app = express();

// Create Server
var server = http.createServer(app);
// server.listen(process.env.PORT || 3030);
var port = (process.env.PORT || 3030)
app.listen(port, function () {
         console.log("[Game Server] Server listening on port %d in %s mode", port, app.get('env'));
    });


app.get("/crossdomain.xml", onCrossDomainHandler);

function onCrossDomainHandler(req, res) {
    var xml = '<?xml version="1.0"?>\n<!DOCTYPE cross-domain-policy SYSTEM' +
        ' "http://www.macromedia.com/xml/dtds/cross-domain-policy.dtd">\n<cross-domain-policy>\n';
    xml += '<allow-access-from domain="*" to-ports="*"/>\n';
    xml += '</cross-domain-policy>\n';

    req.setEncoding('utf8');
    res.writeHead(200, {
        'Content-Type': 'text/xml'
    });
    res.end(xml);
}


// Initialize and connect to the Redis datastore
var redisCreds = {
    url: 'clingfish.redistogo.com',
    port: 9307,
    secret: '075bc004e0e54a4a738c081bf92bc61d',
    channel: "socketServers"
};

var PublishChannel = null;
PublishChannel = redis.createClient(redisCreds.port, redisCreds.url);
PublishChannel.auth(redisCreds.secret, function (err) {
    if (err) {
        console.log(err);
    }
});
var SubscribeChannel = null;
SubscribeChannel = redis.createClient(redisCreds.port, redisCreds.url);
SubscribeChannel.auth(redisCreds.secret, function (err) {
    if (err) {
         console.log(err);
    }
    else
    console.log("[Game Server] Redis Connected.")
});

// Setup MongoDB conenction
// var mongoConnection = 'mongodb://bedbug:a21th21@ds043523-a0.mongolab.com:43523,ds043523-a1.mongolab.com:43523/sportimo?replicaSet=rs-ds043523';
var mongoConnection = 'mongodb://bedbug:a21th21@ds027835.mongolab.com:27835/sportimov2';
// if (mongoose.connection.readyState != 1 && mongoose.connection.readyState != 2)
    mongoose.connect(mongoConnection, function (err, res) {
  if(err){
    console.log('ERROR connecting to: ' + mongoConnection + '. ' + err);
  }else{
    console.log("[Game Server] MongoDB Connected.")
  }
});

/* Modules */
// if (process.env.NODE_ENV != "production") {

var liveMatches = require('./sportimo_modules/match-moderation');
if(PublishChannel && SubscribeChannel)
liveMatches.SetupRedis(PublishChannel, SubscribeChannel, redisCreds.channel);
liveMatches.SetupMongoDB(mongoose);
liveMatches.SetupAPIRoutes(app);
liveMatches.init(TestSuite.done);
TestSuite.moderation = liveMatches;
// }

var wildcards = require('./sportimo_modules/wildcards');
//wildcards.setRedisPubSub(redisCreds.url, redisCreds.port, redisCreds.secret);
wildcards.SetupMongoDB(mongoose);
wildcards.SetupAPIRoutes(app);
wildcards.init();
TestSuite.wildcards = wildcards;


app.use('/offline_data/', require('./sportimo_modules/offline_data/api/ondemand.js'));

// var Notifications = require('./sportimo_modules/notifications');
// Notifications.SetupServer(app);
// Notifications.setMongoConnection(mongoConnection);

var leaderboards_module = require('./sportimo_modules/leaderpay');

var questions_module = require('./sportimo_modules/questions');


var users_module = require('./sportimo_modules/users');

var data_module = require('./sportimo_modules/data-module');
// dataModule.SetupMongoDB(mongoose);
// dataModule.SetupAPIRoutes(app);
// TestSuite.dataModule = dataModule;


function log(info) {
    console.log("[" + Date.now() + "] API CALL: " + info);
}

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, X-Access-Token");
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    next();
});

app.get('/', function (req, res, next) {
    res.send(200, "The Game Server is running smoothly.");
});



/*  Winston Logger Configuration */

var logger = new (winston.Logger)({
    levels: {
        prompt: 6,
        debug: 5,
        info: 4,
        core: 3,
        warn: 1,
        error: 0
    },
    colors: {
        prompt: 'grey',
        debug: 'blue',
        info: 'green',
        core: 'magenta',
        warn: 'yellow',
        error: 'red'
    }
});

logger.add(winston.transports.Console, {
    timestamp: true,
    level: process.env.LOG_LEVEL || 'warn',
    prettyPrint: true,
    colorize: 'level'
});

if (process.env.NODE_ENV == "production") {
    logger.add(winston.transports.File, {
        prettyPrint: true,
        level: 'core',
        silent: false,
        colorize: false,
        timestamp: true,
        filename: 'debug.log',
        maxsize: 40000,
        maxFiles: 10,
        json: false
    });
}



TestSuite.server = app;

module.exports = TestSuite;
