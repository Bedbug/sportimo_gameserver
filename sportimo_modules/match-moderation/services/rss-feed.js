
var feed_service = {};

// The id of the corresponding event(match)
feed_service.eventid = "";

// The match module that this feed will moderate
feed_service.match_module = null;

// The url for the feed.
feed_service.feedUrl = "";

// The interval that the module will request an update
feed_service.interval = 1;

// The parser for this feed
feed_service.parser = null;

// Initialize feed and validate response
feed_service.init = function(){
    
    
    return "AllOK";
} 

module.exports = feed_service;