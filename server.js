// v 0.0.1

/*

 Cards_Server Module

 Info:
 This server's purpose is to register playing cards from the clients
 of the Sporimo app and handle timers and scoring.

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

var express = require("express");
var http = require('http');
var bodyParser = require('body-parser');
var app = express();


// Create Server
var server = http.createServer(app);
server.listen(process.env.PORT || 3030);

app.get( "/crossdomain.xml", onCrossDomainHandler );
function onCrossDomainHandler( req, res ) {
    var xml = '<?xml version="1.0"?>\n<!DOCTYPE cross-domain-policy SYSTEM' +
        ' "http://www.macromedia.com/xml/dtds/cross-domain-policy.dtd">\n<cross-domain-policy>\n';
    xml += '<allow-access-from domain="*" to-ports="*"/>\n';
    xml += '</cross-domain-policy>\n';

    req.setEncoding('utf8');
    res.writeHead( 200, {'Content-Type': 'text/xml'} );
    res.end( xml );
}


var Wildcards = require('./wildcards');
Wildcards.setRedisPubSub('angelfish.redistogo.com', 9455, 'd8deecf088b01d686f7f7cbfd11e96a9');
Wildcards.setServerForRoutes(app);


var Notifications = require('./notifications');
Notifications.SetupServer(app);
Notifications.setMongoConnection ('mongodb://bedbug:a21th21@ds043523-a0.mongolab.com:43523,ds043523-a1.mongolab.com:43523/sportimo?replicaSet=rs-ds043523');


function log(info) {
    console.log("[" + Date.now() + "] API CALL: " + info);
}


app.get('/', function (req, res, next) {
    res.send(200, "The Cards Server is running smoothly.");
});