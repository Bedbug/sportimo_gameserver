/*
 * ***********************************************************************
 * Gamecards Module
 *
 * @description :: The Gamecards Module is repsonsible for handling
 * cards in the game. It is repsonsible for holding the list of active
 * cards and handle their destruction or winnings.
 * 
 * At its core there is the gamecards class that handles 
 * all card types, saving to the database, managing their states through the lifetime of each one, checking for winning conditions, etc.
 * 
 * It also creates API routes that instruct the module to ADD cards
 * from clients. Once the call has been received and a new gamecard
 * has been created the class handles everything else (activation /
 * destruction / db connections)
 * 
 * **********************************************************************
 */

"use strict"

var path = require('path'),
    fs = require('fs'),
    express = require('express'),
    moment = require('moment'),
    async = require('async'),
    log = require('winston'),
    _ = require('lodash'),
    bodyParser = require('body-parser');


/* Mongoose model
Used to access wildcards store in database*/
var UserGamecard;


/*Main module*/
var gamecards = {};

/*The database connection*/
var db = null;

/*The redis pub/sub chanel for publishing*/
var redisPublish = null;
var redisSubscribe = null;

/*The tick handler*/
var tickSchedule = null;


/************************************
 * Perform initialization functions */
gamecards.init = function (dbconnection, redisPublishChannel, redisSubscribeChannel, match) {
    if (!db) {
        db = dbconnection;
        UserGamecard = db.models.userGamecards;
    }

    if (!redisPublish)
        redisPublish = redisPublishChannel;
        
    if (!redisSubscribe)
    {
        redisSubscribe = redisSubscribeChannel;
        
        redisSubscribe.on("error", function (err) {
            log.error("{''Error'': ''" + err + "''}");
        });

        redisSubscribe.on("subscribe", function (channel, count) {
            console.log("[Gamecards] Subscribed to Sportimo Events PUB/SUB channel");
        });

        redisSubscribe.on("unsubscribe", function (channel, count) {
            log.info("[Gamecards] Unsubscribed from Sportimo Events PUB/SUB channel");
        });

        redisSubscribe.on("end", function () {
            log.error("[Gamecards] Connection ended");
        });
        
        redisSubscribe.subscribe("socketServers");
        
        redisSubscribe.on("message", function (channel, message) {
            let msg = JSON.parse(message);
            if (msg.payload && msg.payload.type && (msg.payload.type == 'socket_stats' || msg.payload.type == 'Stats_changed'))
            {
                log.info("[Redis] : Event has come through the channel.");
                log.info("[Redis] :" + JSON.stringify(msg.payload));

            }
        });


    }

    if (db == null || UserGamecard == null) {
        log.error("No active database connection found. Aborting.");
        return new Error('No active database connection found. Aborting.');
    }

    if (!tickSchedule)
        tickSchedule = setInterval(gamecards.Tick, 1000);

    // Check if match has gamecardDefinitions written in mongo from the gamecardTemplates and if their appearanceConditions are met, if not, create them.
    async.waterfall([
        function (callback) {
            db.models.gamecardTemplates.find({}, function (error, templates) {
                if (error)
                    return callback(error);
                callback(null, templates);
            });
        },
        function (templates, callback) {
            db.models.gamecardDefinitions.find({ matchid: match._id.toString() }, function (error, definitions) {

                if (error)
                    return callback(error);

                if (templates == null || templates.length == 0)
                    return callback(null);
                //callback(null, definitions);
                let usedTemplateIds = [];
                _.forEach(definitions, function (definition) {
                    if (_.indexOf(usedTemplateIds, definition.gamecardTemplateId))
                        usedTemplateIds.push(definition.gamecardTemplateId);
                });

                // Now instantiate all not found templates into new gamecardDefinitions
                _.forEach(templates, function (template) {
                    if (_.indexOf(usedTemplateIds, template.id) == -1) {
                        gamecards.createDefinitionFromTemplate(template, match);
                    }
                });
            });
        }
    ], function (error, result) {
        if (error)
            log.error('Error while initializing gamecards module: ' + error.message);
    });


};



/************************************
 *          Gamecards API           *
 ***********************************/

gamecards.testAwardsHandling = function (callback) {
    gamecards.HandleUserCardRewards('56debc2fa5eb8c080bdb261d', '5743492e9d0372fc007b3e15', 150, callback);
}

gamecards.getTemplates = function (callback) {
    return db.models.gamecardTemplates.find({}, callback);
};


gamecards.upsertTemplate = function (template, callback) {
    let processedTemplate = null;
    try {
        if (template._id) {
            processedTemplate = db.models.gamecardTemplates.findById(template._id);
            processedTemplate.text = template.text;
            processedTemplate.title = template.title;
            processedTemplate.image = template.image;
            processedTemplate.activationLatency = template.activationLatency;
            processedTemplate.duration = template.duration;
            processedTemplate.appearConditions = template.appearConditions;
            processedTemplate.winConditions = template.winConditions;
            processedTemplate.terminationConditions = template.terminationConditions;
            processedTemplate.startPoints = template.startPoints;
            processedTemplate.endPoints = template.endPoints;
            processedTemplate.pointsPerMinute = template.pointsPerMinute;
            processedTemplate.options = template.options;
            // processedTemplate.cardType cannot be edited
        }
        else {
            processedTemplate = new db.models.gamecardTemplates();
            processedTemplate.text = template.text;
            processedTemplate.title = template.title;
            processedTemplate.image = template.image;
            processedTemplate.activationLatency = template.activationLatency;
            processedTemplate.duration = template.duration;
            processedTemplate.appearConditions = template.appearConditions;
            processedTemplate.winConditions = template.winConditions;
            processedTemplate.terminationConditions = template.terminationConditions;
            processedTemplate.startPoints = template.startPoints;
            processedTemplate.endPoints = template.endPoints;
            processedTemplate.pointsPerMinute = template.pointsPerMinute;
            processedTemplate.options = template.options;
            processedTemplate.cardType = template.cardType;
        }

        processedTemplate.save(function (error, done) {
            if (error)
                return callback(error);

            callback(null, done);
        });

    }
    catch (error) {
        return callback(error);
    }

};



gamecards.getDefinitions = function (state, callback) {
    if (!state || typeof (state) == 'function') {
        callback = state;
        state = 1; // get active ones
    }

    db.models.gamecardDefinitions.find({ state: state, isVisible: true }, function (error, data) {
        if (error)
            return callback(error);
        callback(null, data);
    });
};

// Added a new method because the old one returned only active ones and there was no sign of match id filtering
gamecards.getMatchDefinitions = function (mid, callback) {

    db.models.gamecardDefinitions.find({ matchid: mid }, function (error, data) {
        if (error)
            return callback(error);
        callback(null, data);
    });
};

gamecards.deleteMatchDefinition = function (gamecardId, callback) {
    db.models.gamecardDefinitions.findByIdAndRemove(gamecardId, function (error, result) {
        if (error)
            return callback(error);

        return callback(null, result);
    });
};

// Aris: Added a new method to post new match definitions in order to proceed
gamecards.addMatchDefinition = function (gamecard, callback) {

    var newDef = new db.models.gamecardDefinitions({
        matchid: gamecard.matchid,
        text: gamecard.text,
        title: gamecard.title,
        image: gamecard.image,
        activationTime: gamecard.activationTime,
        duration: gamecard.duration,
        appearConditions: gamecard.appearConditions,
        winConditions: gamecard.winConditions,
        terminationConditions: gamecard.terminationConditions,
        options: gamecard.options,
        startPoints: gamecard.startPoints,
        endPoints: gamecard.endPoints,
        pointsPerMinute: gamecard.pointsPerMinute,
        maxUserInstances: gamecard.maxUserInstances,
        isVisible: gamecard.isVisible || false,
        cardType: gamecard.cardType,
        status: 0
    });

    newDef.save(function (error, done) {
        if (error)
            return callback(error);
        callback(null, newDef);
        
        redisPublish.publish("socketServers", JSON.stringify({
                            sockets: true,
                            payload: {
                                type: "Message",
                                room: gamecard.matchid,
                                data: {
                                    icon: "gamecard",
                                    message: { "en": "A new game card has been created for your enjoyment." }
                                }
                            }
                        }));
    });
}

// Aris: Added a new method to update match definitions in order to proceed
gamecards.updateMatchDefinition = function (gamecard, callback) {
    if (gamecard._id) {
        db.models.gamecardDefinitions.findByIdAndUpdate(gamecard._id, gamecard, function (err, result) {
            if (!err)
                return callback(null, result);
            else
                return callback(err);
        })
    } else {
        return callback('bad request: The body does not contain a gamecard ID.');
    }
}


gamecards.upsertDefinition = function (gamecard, callback) {
    let processedDefinition = null;
    try {
        if (gamecards.validateDefinition(gamecard) == false)
            return callback(new Error('bad request: validation error in request body'));

        if (gamecard._id) {
            processedDefinition = db.models.gamecardDefinitions.findById(gamecard._id);
            processedDefinition.title = gamecard.title;
            processedDefinition.image = gamecard.image;
            processedDefinition.text = gamecard.text;
            processedDefinition.activationTime = gamecard.activationTime;
            processedDefinition.duration = gamecard.duration;
            processedDefinition.appearConditions = gamecard.appearConditions;
            processedDefinition.winConditions = gamecard.winConditions;
            processedDefinition.terminationConditions = gamecard.terminationConditions;
            processedDefinition.options = gamecard.options;
            processedDefinition.startPoints = gamecard.startPoints;
            processedDefinition.endPoints = gamecard.endPoints;
            processedDefinition.pointsPerMinute = gamecard.pointsPerMinute;
            processedDefinition.maxUserInstances = gamecard.maxUserInstances;
            processedDefinition.isVisible = gamecard.isVisible || false;
            processedDefinition.cardType = gamecard.cardType;
        }
        else {
            let existingDefinition = db.models.gamecardDefinitions.findById(gamecard._id);
            if (existingDefinition.state > 0)
                return callback(new Error('bad request: cannot modify a gamecard definition that is not in the pending activation state'));

            processedDefinition = new db.models.gamecardDefinitions({
                matchid: gamecard.matchid,
                text: gamecard.text,
                title: gamecard.title,
                image: gamecard.image,
                activationTime: gamecard.activationTime,
                duration: gamecard.duration,
                appearConditions: gamecard.appearConditions,
                winConditions: gamecard.winConditions,
                terminationConditions: gamecard.terminationConditions,
                options: gamecard.options,
                startPoints: gamecard.startPoints,
                endPoints: gamecard.endPoints,
                pointsPerMinute: gamecard.pointsPerMinute,
                maxUserInstances: gamecard.maxUserInstances,
                isVisible: gamecard.isVisible || false,
                cardType: gamecard.cardType,
                status: 0
            });
        }
        processedDefinition.save(function (error, done) {
            if (error)
                return callback(error);
            callback(null, done);
        });
    }
    catch (error) {
        return callback(error);
    }
};


// Validate the incoming gamecard definition
gamecards.validateDefinition = function (gamecardDefinition) {
    let itsNow = moment.utc();

    if (gamecardDefinition.creationTime && moment.utc(gamecardDefinition.creationTime) >= itsNow)
        return false;
    if (gamecardDefinition.activationTime && moment.utc(gamecardDefinition.activationTime) <= itsNow)
        return false;
    if (gamecardDefinition.terminationTime)
        return false;
    if (gamecardDefinition.wonTime)
        return false;
    // if (!gamecardDefinition.winConditions || gamecardDefinition.winConditions.length == 0)
    //     return false;
    // if (gamecardDefinition.startPoints < gamecardDefinition.endPoints)
    //     return false;
    // if (gamecardDefinition.maxUserInstances && gamecardDefinition.maxUserInstances <= 0)
    //     return false;
    // if (!gamecardDefinition.duration)
    //     return false;
    // if (gamecardDefinition.activationLatency && gamecardDefinition.activationLatency < 0)
    //     return false;

    return true;
};


gamecards.createDefinitionFromTemplate = function (template, match) {

    let replaceTeamNameLocale = function (teamname, prompt) {
        var promptKeys = _.keys(prompt);
        var newPrompt = {};
        _.forEach(promptKeys, function (key) {
            newPrompt[key] = prompt[key];
            if (teamname[key]) {
                newPrompt[key] = _.replace(newPrompt[key], "[[home_team_name]]", teamname[key]);
                newPrompt[key] = _.replace(newPrompt[key], "[[away_team_name]]", teamname[key]);
            }
        });
        return newPrompt;
    };

    let newDefinition = new db.models.gamecardDefinitions({
        matchid: match._id.toString(),
        gamecardTemplateId: template.id,
        creationTime: moment.utc().toDate(),
        text: template.text,
        title: template.title,
        image: template.image,
        //activationTime: template.activationTime,
        duration: template.duration,
        activationLatency: template.activationLatency,
        appearConditions: template.appearConditions,
        winConditions: template.winConditions,
        terminationConditions: template.terminationConditions,
        options: template.options,
        startPoints: template.startPoints,
        endPoints: template.endPoints,
        pointsPerMinute: template.pointsPerMinute,
        maxUserInstances: template.maxUserInstances,
        isVisible: template.isVisible || true,
        cardType: template.cardType,
        status: 1
    });

    // ToDo: replace text placeholders [[home_team_name]], [[away_team_name]], [[player_name]]

    newDefinition.save();
};


// Select all gamecardDefinitions, and filter for those that have remainingUserInstances in their userGamecards counterparts null or > 0
gamecards.getUserInstances = function (matchId, userId, cbk) {
    async.waterfall([
        function (callback) {
            db.models.gamecardDefinitions.find({ matchid: matchId, isVisible: true, status: { $ne: 2 } }, function (error, definitions) {
                if (error)
                    return callback(error);
                callback(null, definitions);
            });
        },
        function (definitions, callback) {
            // from the definitions, filter out those that the user has played maxUserInstances
            db.models.userGamecards.find({ matchid: matchId, userid: userId }, function (error, userCards) {
                if (error)
                    return callback(error);

                let definitionsLookup = {};
                _.forEach(definitions, function (definition) {
                    if (!definitionsLookup[definition.id])
                        definitionsLookup[definition.id] = definition;
                });

                // from the definitions, remove those that have as usercards eual or more instances than maxUserInstances
                let instancesPerDefinition = _.groupBy(userCards, 'gamecardDefinitionId');
                let definitionIdsToDrop = [];
                _.forEach(instancesPerDefinition, function (instancePerDefinition) {
                    if (instancePerDefinition.length > 0) {
                        let key = instancePerDefinition[0].gamecardDefinitionId;
                        if (definitionsLookup[key] && definitionsLookup[key].maxUserInstances && instancePerDefinition.length >= definitionsLookup[key].maxUserInstances)
                            definitionIdsToDrop.push(key);
                        //log.info(instancePerDefinition.length);
                    }
                });

                let userGamecardDefinitions = [];
                userGamecardDefinitions = _.dropWhile(definitions, function (definition) {
                    return _.indexOf(definitionIdsToDrop, definition.id) != -1;
                });
                callback(null, userGamecardDefinitions);
            });
        }
    ], function (error, definitions) {
        if (error)
            return cbk(error);

        cbk(null, definitions);
    });
};

/* 
* Each time a gamecard is played by a user, it has to be validated before being added to the userWildcards collection in Mongo
*
* Validation Rules:
* ----------------
* the userGamecard has to include a matchId to a scheduled_match instance
* this scheduled_match instance should be existent and active
* the userGamecard has to include a reference to a gamecard definition (wildcardDefinitionId)
* this definition should be existing and active in the gamecardDefinitions collection
* the userGamecard has to include the userid of the respective user
* this user has to be existent and valid
* the userGamecard has to include the creationTime (timestamp) of the actual time that the card has been played
* this timestamp should be in utc time, earlier than now, later than the gamecard definition's activation time
* the userGamecard is not played before the start of the scheduled match when the card type is Instant
* the user should not have played the same gamecard (gamecardDefinitionId) more than the maxUserInstances (if null ignore this rule)
*/
gamecards.validateUserInstance = function (matchId, userGamecard, callback) {

    if (!userGamecard.gamecardDefinitionId)
        return callback({ isValid: false, error: "Body is lacking of the gamecardDefinitionId property" });

    if (!userGamecard.matchid)
        return callback({ isValid: false, error: "Body is lacking of the matchid property" });

    if (userGamecard.matchid != matchId)
        return callback({ isValid: false, error: "The matchid in the body is different from the one in the url path" });

    if (!userGamecard.userid)
        return callback({ isValid: false, error: "Body is lacking of the userid property" });

    let itsNow = moment.utc();

    if (!userGamecard.creationTime || moment.utc(userGamecard.creationTime).isAfter(itsNow))
        log.warn("Body is lacking of the creationTime property or it is later than NOW " + itsNow.format() + " in UTC");
    //return callback({ isValid: false, error: "Body is lacking of the creationTime property or it is later than NOW " + itsNow.format() + " in UTC" });

    // search for the referenced wildcardDefinitionId in the defaultDefinitions first, then to the mongo collection
    let referencedDefinition = null;
    let sameInstanceCount = 0;
    let scheduledMatch = null;

    async.parallel([
        function (cbk) {
            db.models.users.findById(userGamecard.userid, function (error, data) {
                if (error)
                    return cbk(error);
                cbk(null, data);
            });
        },
        function (cbk) {
            db.models.gamecardDefinitions.findById(userGamecard.gamecardDefinitionId, function (error, data) {
                if (error)
                    return cbk({ isValid: false, error: error.message });

                if (data) {
                    referencedDefinition = data;

                    // Found referenced definition, keep validating
                    if (!referencedDefinition.matchid || matchId != referencedDefinition.matchid)
                        return cbk({ isValid: false, error: "The referenced gamecardDefinitionId document either does not include a matchid reference or is not related to the matchid in the body" });

                    if (data.status != 1)
                        return cbk({ isValid: false, error: "The referenced gamecardDefinitionId document is not in an active state" });

                    if (data.options && data.options.length > 0 && !userGamecard.optionId)
                        return cbk({ isValid: false, error: "The references gamecardDefinitionId document contains options, but no optionId property for the selected option is included in the Body" });

                    if (moment.utc(userGamecard.creationTime).isBefore(moment.utc(referencedDefinition.creationTime)))
                        return cbk({ isValid: false, error: "The creationTime in the body is before the creationTime in the gamecardDefinitionId document" });
                }

                cbk(null, referencedDefinition);
            });
        },
        function (cbk) {
            db.models.userGamecards.count({ matchid: matchId, userid: userGamecard.userid, gamecardDefinitionId: userGamecard.gamecardDefinitionId }, function (error, count) {
                if (error)
                    return cbk(error);
                sameInstanceCount = count;
                cbk(null, count);
            });
        },
        function (cbk) {
            db.models.scheduled_matches.findById(matchId, function (error, match) {
                if (error)
                    return cbk(error);

                scheduledMatch = match;
                cbk(null, match);
            });
        }
    ], function (error, results) {
        if (error)
            return callback({ isValid: false, error: error.message });

        let user = results[0];
        if (!user)
            return callback({ isValid: false, error: "The userid in the body does not correspond to an existing user" });
        // ToDo in the future: consider testing if the user is active and not banned.

        referencedDefinition = results[1];

        if (!referencedDefinition)
            return callback({ isValid: false, error: "The gamecardDefinitionId in the body does not correspond to an existing gamecard definition" });

        if (referencedDefinition.cardType == 'Instant' && scheduledMatch.start && itsNow.isBefore(moment.utc(scheduledMatch.start)))
            return callback({ isValid: false, error: "The gamecardDefinitionId document's cardType is Instant but the referenced match has not started yet (its start time is later than NOW in UTC)" });

        if (!referencedDefinition.status || referencedDefinition.status != 1)
            return callback({ isValid: false, error: "The gamecardDefinitionId document's status is not in an active state" });

        if (referencedDefinition.maxUserInstances && referencedDefinition.maxUserInstances <= sameInstanceCount)
            return callback({ isValid: false, error: "The gamecardDefinitionId document's maxUserInstances have been reached already, no more cards of the same type can be played by this user" });

        return callback({ isValid: true, error: null }, referencedDefinition, scheduledMatch);
    });
};


// Add a user played gamecard, after first validating it against fraud, latency and inconsistency
// {
//     "wildcardDefinitionId": "",
//     "userId": "",
//     "matchid": "",
//     "creationTime": "",
// }

gamecards.addUserInstance = function (matchId, gamecard, callback) {
    // First of all, validate this card
    gamecards.validateUserInstance(matchId, gamecard, function (validationOutcome, gamecardDefinition, scheduledMatch) {
        if (!validationOutcome.isValid) {
            return callback(null, new Error('Bad request, validation error in request body for this user gamecard: ' + validationOutcome.error));
        }

        let itsNow = moment.utc();
        let creationMoment = moment.utc(gamecard.creationTime);

        // Store the mongoose model
        let newCard = null;
        try {
            newCard = new UserGamecard({
                userid: gamecard.userid,
                gamecardDefinitionId: gamecardDefinition.id,
                matchid: gamecard.matchid,
                title: gamecardDefinition.title,
                image: gamecardDefinition.image,
                minute: gamecard.minute,
                segment: gamecard.segment,
                duration: gamecardDefinition.duration || null,
                activationLatency: gamecardDefinition.activationLatency || null,
                appearConditions: gamecardDefinition.appearConditions,
                winConditions: gamecardDefinition.winConditions,
                terminationConditions: gamecardDefinition.terminationConditions,
                pointsPerMinute: gamecardDefinition.pointsPerMinute || 0,
                startPoints: gamecardDefinition.startPoints || 0,
                endPoints: gamecardDefinition.endPoints || 0,
                optionId: gamecard.optionId || null,
                cardType: gamecardDefinition.cardType,
                creationTime: itsNow.toDate(),
                activationTime: !gamecardDefinition.activationTime ? itsNow.add(gamecardDefinition.activationLatency ? gamecardDefinition.activationLatency : 0, 'ms').toDate() : gamecardDefinition.activationTime,    // let the schema pre-save handle these times
                //terminationTime: gamecardDefinition.terminationTime,
                wonTime: null,
                pointsAwarded: null,
                status: gamecardDefinition.cardType == "Instant" ? 0 : (gamecardDefinition.status || 1)
            });

            if (newCard.duration && newCard.duration > 0)
                newCard.terminationTime = moment.utc().add(newCard.duration, 'ms').add(newCard.activationLatency ? newCard.activationLatency : 0, 'ms').toDate();

            if (gamecardDefinition.options && gamecard.optionId) {
                let optionsIndex = _.find(gamecardDefinition.options, function (option) {
                    return option.optionId == gamecard.optionId;
                });
                if (optionsIndex) {
                    newCard.winConditions = optionsIndex.winConditions || null;
                    if (optionsIndex.terminationConditions)
                        newCard.terminationConditions = optionsIndex.terminationConditions || null;
                    if (optionsIndex.text)
                        newCard.text = optionsIndex.text;
                    if (optionsIndex.startPoints)
                        newCard.startPoints = optionsIndex.startPoints;
                    if (optionsIndex.endPoints)
                        newCard.endPoints = optionsIndex.endPoints;
                    if (optionsIndex.pointsPerMinute)
                        newCard.pointsPerMinute = optionsIndex.pointsPerMinute;
                    if (optionsIndex.activationLatency)
                        newCard.activationLatency = optionsIndex.activationLatency;
                    if (optionsIndex.duration)
                        newCard.duration = optionsIndex.duration;
                    newCard.optionId = optionsIndex.optionId;

                    if (optionsIndex.duration && optionsIndex.duration > 0) {
                        newCard.terminationTime = moment.utc().add(optionsIndex.duration, 'ms').add(optionsIndex.activationLatency ? optionsIndex.activationLatency : 0, 'ms').toDate();
                    }
                }
            }

            if (newCard.cardType == "Overall" && newCard.pointsPerMinute && scheduledMatch && scheduledMatch.start) {
                // Compute the updated starting points (winning points if the card wins) if the match has already started (is live)
                if (scheduledMatch.state > 0) {
                    let timeDiff = itsNow.subtract(moment.utc(scheduledMatch.start.toISOString()));
                    let minutesSinceMatchStart = timeDiff.get('minutes');
                    newCard.startPoints -= Math.round(minutesSinceMatchStart * newCard.pointsPerMinute);
                }
            }

            newCard.save(function (error) {
                if (error)
                    return callback(error);
                    
                    db.models.useractivities.SetMatchPlayed(newCard.userid, newCard.matchid);
                    // Register user activity - 'PlayedCard'
                    db.models.useractivities.IncrementStat(newCard.userid, newCard.matchid, 'cardsPlayed', 1);
                    
                callback(null, null, gamecards.TranslateUserGamecard(newCard));
            });
        }
        catch (error) {
            return callback(error);
        }

    });
};


// First get the userGamecard from mongo and assert that it exists and that its status is 1.
// Then, update it accordingly
gamecards.updateUserInstance = function (userGamecardId, options, callback) {
    db.models.userGamecards.findById(userGamecardId, function (error, gamecard) {
        if (error)
            return callback(error);

        if (!gamecard)
            return callback(null, "userGamecardId is not found");

        if (options.doubleTime && gamecard.cardType == 'Overall')
            return callback(null, "Cannot add double time in an Overall card");

        // ToDo: Validate against maximum number of allowed double card extensions in the match.

        if (options.doublePoints && options.doublePoints == true) {
            if (gamecard.cardType == "Instant") {
                gamecard.startPoints = gamecard.startPoints * 2;
                gamecard.endPoints = gamecard.endPoints * 2;
            }
            else
                gamecard.startPoints = gamecard.startPoints * 2;
        }
        if (options.doubleTime && options.doubleTime == true) {
            if (gamecard.duration) {
                if (gamecard.terminationTime)
                    gamecard.terminationTime = moment.utc(gamecard.terminationTime).add(gamecard.duration, 'ms').toDate();
                gamecard.duration = gamecard.duration * 2;
            }
        }

        gamecard.save(function (err) {
            if (err)
                return callback(err);

            callback(null, null, gamecards.TranslateUserGamecard(gamecard));
        });
    });
};


gamecards.TranslateUserGamecard = function (userGamecard) {
    let retValue = {
        id: userGamecard.id,
        userid: userGamecard.userid,
        matchid: userGamecard.matchid,
        gamecardDefinitionId: userGamecard.gamecardDefinitionId,
        title: userGamecard.title,
        image: userGamecard.image,
        text: userGamecard.text,
        cardType: userGamecard.cardType,
        status: userGamecard.status
    };

    if (userGamecard.startPoints)
        retValue.startPoints = userGamecard.startPoints;
    if (userGamecard.endPoints)
        retValue.endPoints = userGamecard.endPoints;
    if (userGamecard.pointsPerMinute)
        retValue.pointsPerMinute = userGamecard.pointsPerMinute;

    if (userGamecard.activationLatency)
        retValue.activationLatency = userGamecard.activationLatency;
    if (userGamecard.pointsAwarded)
        retValue.pointsAwarded = userGamecard.pointsAwarded;
    if (userGamecard.duration)
        retValue.duration = userGamecard.duration;
    if (userGamecard.optionId)
        retValue.optionId = userGamecard.optionId;
    if (userGamecard.maxUserInstances)
        retValue.maxUserInstances = userGamecard.maxUserInstances;
    if (userGamecard.creationTime)
        retValue.creationTime = userGamecard.creationTime;
    if (userGamecard.activationTime)
        retValue.activationTime = userGamecard.activationTime;
    if (userGamecard.terminationTime)
        retValue.terminationTime = userGamecard.terminationTime;
    if (userGamecard.wonTime)
        retValue.wonTime = userGamecard.wonTime;

    return retValue;
};


// DELETE
// removes gamecard from CardsInplay &
// from the database.
// CAUTION: USE ONLY FOR TESTING PURPOSES IN DEVELOPMENT ENVIRONMENT
gamecards.deleteUserInstance = function (gamecardId, callback) {
    db.models.gamecards.findById({ _id: gamecardId }, function (error, gamecard) {
        if (error)
            return callback(error);

        gamecard.delete(function (error) {
            if (error)
                return callback(error);
            callback(null);
        });
    });
};


// Manage gamecards in time, activate the ones pending activation, terminate the ones pending termination
gamecards.Tick = function () {
    // Update all wildcards pending to be activated
    let itsNow = moment.utc().toDate();

    if (!db) {
        log.warn('Gamecards module is not yet connected to Mongo store. Aborting Tick.');
        return;
    }

    // Check terminationConditions on overall cards
    // Terminate active instant cards if terminationTime is passed

    async.parallel([
        function (callback) {
            // Update all wildcards that are due for activation
            // ToDo: Check that the appearance criteria are also met
            return db.models.gamecardDefinitions.update({ status: 0, activationTime: { $lt: itsNow } }, { $set: { status: 1 } }, { multi: true }, callback);
        },
        // function(callback) {
        //     // Update all wildcards that have terminated without success
        //     //return db.models.gamecardDefinitions.update({status: 1, terminationTime: { $lt: itsNow } }, { $set: {status: 2} }, {multi: true}, callback);
        // },
        function (callback) {
            // Update all user gamecards that have passed from their pending state into activation
            return db.models.userGamecards.update({ status: 0, cardType: "Instant", activationTime: { $lt: itsNow } }, { $set: { status: 1 } }, { multi: true }, callback);
        },
        function (callback) {
            // Find all instant gameCards that terminate, and decide if they have won or lost

            const cardsQuery = {
                status: 1,
                cardType: "Instant",
                activationTime: { $lt: itsNow },
                terminationTime: { $lt: itsNow },
                //matchid : event.matchid
            };


            db.models.userGamecards.find(cardsQuery, function (error, data) {
                if (error)
                    return callback(error);

                if (!data || data.length == 0)
                    return callback(null);

                let cardsWon = [];

                _.forEach(data, function (gamecard) {
                    if (gamecards.CheckIfWins(gamecard, true)) {
                        // Send an event through Redis pub/sub:
                        log.info("Detected a winning gamecard: " + gamecard);
                        redisPublish.publish("socketServers", JSON.stringify({
                            sockets: true,
<<<<<<< HEAD
                            clients: gamecard.userid,
=======
                            clients: [gamecard.userid],
>>>>>>> 278e84cc671cdba59dc2915053c3700dc9b57e5f
                            payload: {
                                type: "Card_won",
                                client: gamecard.userid,
                                room: gamecard.matchid,
                                data: gamecards.TranslateUserGamecard(gamecard)
                            }
                        }));
                        cardsWon.push(gamecard);


                    }
                    else {
                        gamecard.terminationTime = moment.utc().toDate();
                        gamecard.status = 2;
                        gamecard.pointsAwarded = 0;
                        // Send an event through Redis pu/sub:
                        log.info("Detected a losing gamecard: " + gamecard);
                        redisPublish.publish("socketServers", JSON.stringify({
                            sockets: true,
                            clients: [gamecard.userid],
                            payload: {
                                type: "Card_lost",
                                client: gamecard.userid,
                                room: gamecard.matchid,
                                data: gamecards.TranslateUserGamecard(gamecard)
                            }
                        }));
                    }
                    if (gamecard.cardType == 'IInstant')
                        gamecard.cardType = 'Instant';
                    gamecard.save();
                });
                callback(null);
            });
        }
    ], function (error) {
        if (error)
            return;
    });
};

<<<<<<< HEAD

=======
>>>>>>> 278e84cc671cdba59dc2915053c3700dc9b57e5f
gamecards.HandleUserCardRewards = function (uid, mid, pointsToGive, callback) {

    // Reward Points
    return db.models.scores.AddPoints(uid, mid, pointsToGive, function (err, result) {
        if (err)
<<<<<<< HEAD
        {
            log.error(err);
            return callback(err);
        }
        // Reward stats
        db.models.useractivities.IncrementStat(uid, mid, 'cardsWon', 1, function (err, result) {
            if (err)
            {
                log.error(err);
                return callback(err);
            }
                
            return callback(null,'Done');
        });
=======
            log.error(err);
        else {
            // Reward stats
            db.models.useractivities.IncrementStat(uid, mid, 'cardsWon', 1, function (err, result) {
                if (err)
                    log.error(err);
                    
                    if(callback)
                    return callback(null,'Done');
            });
        }
>>>>>>> 278e84cc671cdba59dc2915053c3700dc9b57e5f
    });

    // TODO: Reward Achievements
}


<<<<<<< HEAD
gamecards.CheckIfWins = function (gamecard, isCardTermination) {
=======
gamecards.CheckIfWins = function (gamecard) {
>>>>>>> 278e84cc671cdba59dc2915053c3700dc9b57e5f
    const itsNow = moment.utc();
    let conditions = gamecard.winConditions;
    // All winConditions have to be met to win the card
    for (let i = 0; i < conditions.length; i++) {
        let condition = conditions[i];
        if (isCardTermination == false && (condition.conditionNegation == true || condition.remaining > 0)) {
            return false;
        }
        if (isCardTermination == true && condition.remaining <= 0 && condition.conditionNegation == true) {
            return false;
        }
        if (isCardTermination == true && condition.remaining > 0 && condition.conditionNegation == false) {
            return false;
        }
        
    }
    gamecard.status = 2; // terminated
    if (!gamecard.terminationTime)
        gamecard.terminationTime = itsNow.toDate();
    gamecard.wonTime = itsNow.toDate();
    // Award points
    if (gamecard.cardType == "Instant") {
        let startInt = moment.utc(gamecard.activationTime);
        let endInt = itsNow;
        gamecard.pointsAwarded = gamecard.startPoints + Math.round((gamecard.endPoints - gamecard.startPoints) * (endInt.diff(startInt, 'milliseconds', true) / gamecard.duration));
    }
    else
        gamecard.pointsAwarded = gamecard.startPoints;

    // Give Platform Rewards (update scores for leaderboards, user score, stats, achievements)
    gamecards.HandleUserCardRewards(gamecard.userid, gamecard.matchid, gamecard.pointsAwarded);

    return true;
};


gamecards.CheckIfLooses = function (gamecard, isCardTermination) {
    const itsNow = moment.utc();
    let conditions = gamecard.winConditions;
    
    if (gamecard.cardType == 'Overall')
        return false;
        
    // If any winCondition is met then the card is lost
    let isLost = false;
    for (let i = 0; i < conditions.length; i++) {
        let condition = conditions[i];
        if (isCardTermination == false && condition.conditionNegation == true && condition.remaining == 0) {
            isLost = true;
        }
    }
    
    if (!isLost)
        return false;
        
    gamecard.status = 2; // terminated
    if (!gamecard.terminationTime)
        gamecard.terminationTime = itsNow.toDate();
    // Award points
    gamecard.pointsAwarded = 0;
    return true;
};





// Resolve an incoming match event and see if some matching wildcards win
gamecards.ResolveEvent = function (matchEvent) {

    const eventSplit = function (compositeEvent) {
        let events = [];
        let eventData = compositeEvent.data;
        for (let name in eventData.stats) {
            let newEvent = {
                id: eventData.id,
                sender: !eventData.sender ? null : eventData.sender,
                matchid: eventData.match_id,
                team: eventData.team,
                playerid: !eventData.players || eventData.players.length == 0 ? null : eventData.players[0].id,
                stat: name,
                incr: eventData.stats[name],
                state: eventData.state,
                timelineEvent: eventData.timeline_event
            };

            events.push(newEvent);
        }

        return events;
    };

    const gamecardsWinHandle = function (mongoGamecards, event, cbk) {
        //mongoGamecards.forEach(function (gamecard) {
        async.each(mongoGamecards, function(gamecard, cbk) {
            if (gamecard.status != 1) {
                async.setImmediate(function() {
                   return cbk() 
                });
                //return cbk();
            }
            gamecard.winConditions.forEach(function (condition) {
                if (condition.stat == event.stat && (condition.playerid == null || condition.playerid == event.playerid) && (condition.teamid == null || condition.teamid == event.team)) {
                    condition.remaining -= event.incr;
                    if (condition.remaining <= 0) {
                        condition.remaining = 0;
                    }
                }
            });                    
            if (gamecards.CheckIfWins(gamecard, false)) {
                // Send an event through Redis pu/sub:
                log.debug("Detected a winning gamecard: " + gamecard);
                redisPublish.publish("socketServers", JSON.stringify({
                    sockets: true,
                    clients: [gamecard.userid],
                    payload: {
                        type: "Card_won",
                        client: gamecard.userid,
                        room: event.matchid,
                        data: gamecards.TranslateUserGamecard(gamecard)
                    }
                }));
            }
            else
            if (gamecards.CheckIfLooses(gamecard, false)) {
                log.debug("Detected a losing gamecard: " + gamecard);
                redisPublish.publish("socketServers", JSON.stringify({
                    sockets: true,
                    clients: [gamecard.userid],
                    payload: {
                        type: "Card_lost",
                        client: gamecard.userid,
                        room: event.matchid,
                        data: gamecards.TranslateUserGamecard(gamecard)
                    }
                }));
            }
            
            if (gamecard.cardType == 'IInstant')
                gamecard.cardType = 'Instant';
            return gamecard.save(cbk);
        });
        
        cbk(null);
    };

    const gamecardsTerminationHandle = function (mongoGamecards, event, cbk) {
        mongoGamecards.forEach(function (gamecard) {
            if (gamecard.status != 1) {
                return cbk();
            }
            gamecard.terminationConditions.forEach(function (condition) {
                if (condition.stat == event.stat && (condition.playerid == null || condition.playerid == event.playerid) && (condition.teamid == null || condition.teamid == event.team)) {
                    condition.remaining -= event.incr;
                    if (condition.remaining <= 0) {
                        condition.remaining = 0;
                    }
                }
            });

            if (gamecards.CheckIfWins(gamecard, true)) {
                // Send an event through Redis pub/sub:
                log.debug("Detected a winning gamecard: " + gamecard);
                redisPublish.publish("socketServers", JSON.stringify({
                    sockets: true,
                    clients: [gamecard.userid],
                    payload: {
                        type: "Card_won",
                        client: gamecard.userid,
                        room: event.matchid,
                        data: gamecards.TranslateUserGamecard(gamecard)
                    }
                }));
            }
            else {
                gamecard.terminationTime = moment.utc().toDate;
                gamecard.status = 2;
                gamecard.pointsAwarded = 0;
                // Send an event through Redis pu/sub:
                log.debug("Detected a losing gamecard: " + gamecard);
                redisPublish.publish("socketServers", JSON.stringify({
                    sockets: true,
                    clients: [gamecard.userid],
                    payload: {
                        type: "Card_lost",
                        client: gamecard.userid,
                        room: event.matchid,
                        data: gamecards.TranslateUserGamecard(gamecard)
                    }
                }));
            }
            
            if (gamecard.cardType == 'IInstant')
                gamecard.cardType = 'Instant';
            gamecard.save();            
        });
        
        cbk(null);
    };


    // Split stats property in matchEvent.data into individual transformed simpler event objects and loop the resolution logic over each one
    let individualEvents = eventSplit(matchEvent);
    const itsNow = moment.utc();

    // Check for winConditions met in userGamecards
    async.each(individualEvents, function (event, callback) {
        try {
            const gamecardsQuery = {
                status: 1,
                creationTime: { $lt: event.time || itsNow },
                matchid: event.matchid,
            };
            //const statLogic = [{ stat: event.stat, conditionNegation: false }, { stat: { $ne: event.stat }, conditionNegation: true }];

            const orPlayerQuery = [{ playerid: null }];
            if (event.playerid != null) {
                orPlayerQuery.push({ playerid: event.playerid });
            }

            // ToDo: matching the team ids, not 'home' or 'away'

            const orTeamQuery = [{ teamid: null }];
            if (event.team != null) {
                orTeamQuery.push({ teamid: event.team });
            }

            gamecardsQuery.winConditions = { $elemMatch: { $and: [ { stat: event.stat }, { remaining: { $ne: 0 } }, { $or: orPlayerQuery }, { $or: orTeamQuery }] } };
            let mongoGamecards;
            db.models.userGamecards.find(gamecardsQuery, function (error, data) {
                if (error) {
                    log.error("Error while resolving event: " + error.message);
                    return callback(error);
                }

                mongoGamecards = data;
                gamecardsWinHandle(mongoGamecards, event, function(err) {
                    if (err)
                        return callback(error);
                    
                    try {
                        const wildcardsQuery = {
                            status: 1,
                            cardType: "Overall",
                            creationTime: { $lt: event.time || itsNow },
                            matchid: event.matchid
                        };
            
                        const orPlayerQuery = [{ playerid: null }];
                        if (event.playerid != null) {
                            orPlayerQuery.push({ playerid: event.playerid });
                        }
            
                        // ToDo: matching the team ids, not 'home' or 'away'
            
                        const orTeamQuery = [{ teamid: null }];
                        if (event.team != null) {
                            orTeamQuery.push({ teamid: event.team });
                        }
            
                        wildcardsQuery.terminationConditions = { $elemMatch: { $and: [{ stat: event.stat }, { remaining: { $ne: 0 } }, { $or: orPlayerQuery }, { $or: orTeamQuery }] } };
                        let mongoGamecards;
                        db.models.userGamecards.find(wildcardsQuery, function (error, data) {
                            if (error) {
                                log.error("Error while resolving event: " + error.message);
                                return callback(error);
                            }
            
                            mongoGamecards = data;
                            return gamecardsTerminationHandle(mongoGamecards, event, callback);
                        });
                    }
                    catch (innerError) {
                        log.error("Error while resolving event: " + innerError.message);
                        return callback(innerError);
                    }
                    
                });
            });
        }
        catch (error) {
            log.error("Error while resolving event: " + error.message);
            return callback(error);
        }
    }, function (error) {
        if (error) {
            log.error(error);
        }

        return;
    });


    // Check for terminationConditions met in userGamecards. 
    // Only overall cards can define terminationConditions, if encountered in instant cards they are ignored.
    // async.each(individualEvents, function (event, callback) {
    //     try {
    //         const wildcardsQuery = {
    //             status: 1,
    //             cardType: "Overall",
    //             creationTime: { $lt: event.time || itsNow },
    //             matchid: event.matchid
    //         };

    //         const orPlayerQuery = [{ playerid: null }];
    //         if (event.playerid != null) {
    //             orPlayerQuery.push({ playerid: event.playerid });
    //         }

    //         // ToDo: matching the team ids, not 'home' or 'away'

    //         const orTeamQuery = [{ teamid: null }];
    //         if (event.team != null) {
    //             orTeamQuery.push({ teamid: event.team });
    //         }

    //         wildcardsQuery.terminationConditions = { $elemMatch: { $and: [{ stat: event.stat }, { remaining: { $ne: 0 } }, { $or: orPlayerQuery }, { $or: orTeamQuery }] } };
    //         let mongoGamecards;
    //         db.models.userGamecards.find(wildcardsQuery, function (error, data) {
    //             if (error) {
    //                 log.error("Error while resolving event: " + error.message);
    //                 return callback(error);
    //             }

    //             mongoGamecards = data;
    //             return gamecardsTerminationHandle(mongoGamecards, event, callback);
    //         });
    //     }
    //     catch (error) {
    //         log.error("Error while resolving event: " + error.message);
    //         return callback(error);
    //     }
    // }, function (error) {
    //     if (error) {
    //         log.error(error);
    //     }

    //     return;
    // });

};



/************************************
 *           Routes                  *
 ************************************/

var app = null;

try {
    let testServer = require('./../../server');
    app = testServer.server;
    //module.exports = this;
} catch (ex) {
    // Start server
    app = module.exports = exports.app = express.Router();
    var port = process.env.PORT || 8081;
    app.listen(port, function () {
        console.log('Express server listening on port %d in %s mode', port, app.get('env'));
    });
}

app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, X-Access-Token");
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    next();
});
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));

// Loading gamecard API routes
var apiPath = path.join(__dirname, 'api');
fs.readdirSync(apiPath).forEach(function (file) {
    app.use('/', require(apiPath + '/' + file)(gamecards));
});



module.exports = gamecards;
