/*
 * ***********************************************************************
 * Data Module
 *
 * @description :: 
 * 
 * **********************************************************************
 */

var path = require('path'),
    fs = require('fs'),
    moment = require('moment'),
    _ = require('lodash'),
    bodyParser = require('body-parser');



var DataModule = {};
var Schedule;

DataModule.SetupMongoDB = function (dbconenction) {
    this.db = dbconenction;
    var modelsPath = path.join(__dirname, 'models');
    fs.readdirSync(modelsPath).forEach(function (file) {
        require(modelsPath + '/' + file);
    });
    
    Schedule = this.db.models.scheduled_match;
}

/************************************
 *           API ROUTES             *
 ************************************/
DataModule.SetupAPIRoutes = function (server) {
    // Load up the Rest-API routes
    server.use(bodyParser.json());
    server.use(bodyParser.urlencoded({
        extended: true
    }));
    server.use(function (req, res, next) {
        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
        res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
        next();
    });

    // Loading routes
    var apiPath = path.join(__dirname, 'api');
    fs.readdirSync(apiPath).forEach(function (file) {
        server.use('/', require(apiPath + '/' + file));
    });
}

module.exports = DataModule;