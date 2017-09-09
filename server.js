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
    winston = require('winston'),
    settings = require('./models/settings'),
    morgan = require('morgan');


var TestSuite = {
    done: null
};

var app = module.exports = exports.app = express();
var version = "0.9.11";
// Create Server
var server = http.createServer(app);
var port = (process.env.PORT || 3030)
app.listen(port, function () {
    console.log("------------------------------------------------------------------------------------");
    console.log("-------       Sportimo v2.0 Game Server %s listening on port %d        --------", version, port);
    console.log("-------       Environment: " + process.env.NODE_ENV);
    console.log("------------------------------------------------------------------------------------");
});

if(process.env.NODE_ENV == "development"){
morgan.token("date-time", function (req, res) { return (new Date()).toISOString() });
app.use(morgan(':date-time :method :url :status :response-time ms - :res[content-length]'));
app.use(morgan('dev'));
}
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
// var redisCreds = {
//     url: 'clingfish.redistogo.com',
//     port: 9307,
//     secret: '075bc004e0e54a4a738c081bf92bc61d',
//     channel: "socketServers"
// };

var redisCreds = require('./config/redisConfig');
var mongoCreds = require('./config/mongoConfig');

var PublishChannel = null;
var SubscribeChannel = null;

try {
    PublishChannel = redis.createClient(process.env.REDIS_URL || "redis://h:p24268cafef1f0923a94420b8cb29eb88476356728a9825543a262bac20b0c973@ec2-34-249-251-118.eu-west-1.compute.amazonaws.com:25229");
    // PublishChannel.auth(redisCreds.secret, function (err) {
    //     if (err) {
    //         console.log(err);
    //     }
    // });
    
    SubscribeChannel = redis.createClient(process.env.REDIS_URL || "redis://h:p24268cafef1f0923a94420b8cb29eb88476356728a9825543a262bac20b0c973@ec2-34-249-251-118.eu-west-1.compute.amazonaws.com:25229");
    // SubscribeChannel.auth(redisCreds.secret, function (err) {
    //     if (err) {
    //         console.log(err);
    //     }
    // });


    PublishChannel.on("error", function (err) {
        console.error(err);
        console.error(err.stack);
    });

    SubscribeChannel.on("error", function (err) {
        console.error(err);
        console.error(err.stack);
    });
}
catch (err) {
    console.log(err);
}

app.PublishChannel = PublishChannel;


if (!process.env.NODE_ENV)
    process.env.NODE_ENV = "development";

    // process.env.NODE_ENV = "production";

// Setup MongoDB conenction
// var mongoConnection = 'mongodb://bedbug:a21th21@ds043523-a0.mongolab.com:43523,ds043523-a1.mongolab.com:43523/sportimo?replicaSet=rs-ds043523';
// var mongoConnection = 'mongodb://bedbug:a21th21@ds027835.mongolab.com:27835/sportimov2';
var mongoConnection = 'mongodb://' + mongoCreds[process.env.NODE_ENV].user + ':' + mongoCreds[process.env.NODE_ENV].password + '@' + mongoCreds[process.env.NODE_ENV].url;
// if (mongoose.connection.readyState != 1 && mongoose.connection.readyState != 2)
mongoose.Promise = global.Promise;

mongoose.connect(mongoConnection, function (err, res) {
    if (err) {
        console.log('ERROR connecting to: ' + mongoConnection + '. ' + err);
    }
    //  else {
    //     console.log("[Game Server] MongoDB Connected.");
    // }
});

/* Modules */
// if (process.env.NODE_ENV != "production") {

var liveMatches = require('./sportimo_modules/match-moderation');
if (PublishChannel && SubscribeChannel)
    liveMatches.SetupRedis(PublishChannel, SubscribeChannel, redisCreds.channel);

liveMatches.SetupMongoDB(mongoose);
liveMatches.SetupAPIRoutes(app);
liveMatches.init(TestSuite.done);
TestSuite.moderation = liveMatches;
// }

// var wildcards = require('./sportimo_modules/wildcards');
//     //wildcards.setRedisPubSub(redisCreds.url, redisCreds.port, redisCreds.secret);
//     //wildcards.SetupMongoDB(mongoose);
//     //wildcards.SetupAPIRoutes(app);
// wildcards.init(mongoose);
// TestSuite.wildcards = wildcards;


app.use('/offline_data/', require('./sportimo_modules/offline_data/api/ondemand.js'));

// var Notifications = require('./sportimo_modules/notifications');
// Notifications.SetupServer(app);
// Notifications.setMongoConnection(mongoConnection);

var leaderboards_module = require('./sportimo_modules/leaderpay');

var questions_module = require('./sportimo_modules/questions');


var users_module = require('./sportimo_modules/users');

var data_module = require('./sportimo_modules/data-module');

var polls_module = require('./sportimo_modules/polls');

var early_access_module = require('./sportimo_modules/early-access');

// var purchases_module = require('./sportimo_modules/purchases');
// dataModule.SetupMongoDB(mongoose);
// dataModule.SetupAPIRoutes(app);
// TestSuite.dataModule = dataModule;


function log(info) {
    //  console.log("[" + Date.now() + "] API CALL: " + info);
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

app.use(function (req, res, next) {
    req.mongoose = mongoose.connection;
    req.redisPub = PublishChannel;
    req.redisSub = SubscribeChannel;
    next();
});

app.get('/', function (req, res, next) {
    res.send(200, "Sportimo main game server v0.9.2 status is live.");
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
    level: process.env.LOG_LEVEL || 'debug',
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

// Central Error Handling for all Express router endpoints: for Express this should be the last middleware declared:
// See http://expressjs.com/en/guide/error-handling.html
app.use(function (error, request, response, next) {
    logger.error('Error: %s \nStack: %s', error.message, error.stack);

    // In Development environment return the exact error message and stack:
    return response.status(500).json({
        error: {
            message: error.message,
            stack: error.stack
        }
    });

    // In Production environment, return a generic error message:
    //return response.status(500).json({error: 'Oops! The service is experiencing some unexpected issues. Please try again later.'});
});

TestSuite.server = app;


// ROUTE FOR PLATFORM SETTINGS
// =============================================================================
var router = express.Router();              // get an instance of the express Router

router.get('/', function (req, res) {
    settings.find({}, function (err, result) {
        if (result[0])
            return res.status(200).send(result[0]);
        else return res.status(200).send(result);
    })
});

app.use('/settings', router);

module.exports = TestSuite;
