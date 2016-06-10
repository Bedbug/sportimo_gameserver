var path = require('path'),
    fs = require('fs');

var http = require('http'),
    express = require('express');

var bodyParser = require('body-parser');
    
var app = express();


// Create Server
var server = http.createServer(app);
var port = (process.env.PORT || 3030);
server.listen(port, function () {
        //console.log('Express server listening on port %d in %s mode', port, app.get('env') || 'development');
        console.log('Express server listening on port %d', port);
    });


app.use(bodyParser.json());


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