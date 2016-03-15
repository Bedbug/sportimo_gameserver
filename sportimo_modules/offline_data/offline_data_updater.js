var path = require('path'),
    fs = require('fs');
    //mongoose = require('../config/db.js'),
    //_ = require('lodash');
    
var http = require('http'),
    express = require('express');

    
    
var app = express();

// Create Server
var server = http.createServer(app);
// server.listen(process.env.PORT || 3030);
var port = (process.env.PORT || 3030);
server.listen(port, function () {
        //console.log('Express server listening on port %d in %s mode', port, app.get('env') || 'development');
        console.log('Express server listening on port %d', port);
    });


// Recursively add router paths
var apiPath = path.join(__dirname, 'api');
    fs.readdirSync(apiPath).forEach(function (file) {
        app.use('/offline_data/', require(apiPath + '/' + file));
    });

    
var offlineDataUpdater = {};

offlineDataUpdater.Init = function()
{
    
};



module.exports = offlineDataUpdater;