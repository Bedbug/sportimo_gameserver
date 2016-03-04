/*
 * ***********************************************************************
 * Data Module
 *
 * @description :: 
 * 
 * **********************************************************************
 */

'use strict';

// Module dependencies.
var express = require('express'),
    path = require('path'),
    fs = require('fs'),
    methodOverride = require('method-override'),
    morgan = require('morgan'),
    bodyParser = require('body-parser'),
    errorhandler = require('errorhandler');
    // cors = require('cors');

var app = null;

try {
    app = require('./../../server');

} catch (ex) {
    // Start server
    app =  module.exports = exports.app = express.Router();
    var port = process.env.PORT || 3000;
    app.listen(port, function () {
        console.log('Express server listening on port %d in %s mode', port, app.get('env'));
    });
}

module.exports = this;

app.locals.siteName = "data-module";

var accessLogStream = fs.createWriteStream(__dirname + '/../'+app.locals.siteName+'_access.log', {flags: 'a'})


// app.use(cors());
app.use(morgan('dev'));
app.use(morgan('short', { stream: accessLogStream }));

// Connect to database
var db = require('./config/db');
app.use(express.static(__dirname + '/public'));

var env = process.env.NODE_ENV || 'development';

// Bootstrap models
var modelsPath = path.join(__dirname, 'models');
fs.readdirSync(modelsPath).forEach(function (file) {
    require(modelsPath + '/' + file);
});

// Bootstrap routes
var routesPath = path.join(__dirname, 'routes');
fs.readdirSync(routesPath).forEach(function (file) {
    app.use('/', require(routesPath + '/' + file));
});

// Bootstrap api
var apiPath = path.join(__dirname, 'api');
fs.readdirSync(apiPath).forEach(function (file) {
    app.use('/', require(apiPath + '/' + file));
});


