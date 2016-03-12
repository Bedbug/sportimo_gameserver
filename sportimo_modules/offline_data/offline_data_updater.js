var path = require('path'),
    fs = require('fs'),
    mongoose = require('../config/db.js');

var parsers = [ ];

var servicesPath = path.join(__dirname, '../parsers');
    fs.readdirSync(servicesPath).forEach(function (file) {
        parsers[path.basename(file, ".js")] = require(servicesPath + '/' + file);
    });

var modelsPath = path.join(__dirname, '../models');
    fs.readdirSync(modelsPath).forEach(function (file) {
        require(modelsPath + '/' + file);
    });
    
var offlineDataUpdater = {};


module.exports = offlineDataUpdater;