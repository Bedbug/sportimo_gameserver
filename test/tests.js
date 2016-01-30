var expect = require('chai').expect,
    request = require('supertest'),
    _ = require('lodash');


var cardObject = require("./testObjects/cardObject");

// var mongoose = require('mongoose');  
// var mockgoose = require('mockgoose');
// mockgoose(mongoose);  
var TestSuite = require('../server');
//var LiveMatches = require('../sportimo_modules/match-moderation');

TestSuite.moderation.testing = true;

before(function (done) {
    // TestSuite.moderation.mock = true;
    TestSuite.moderation.callback = done;
    // setTimeout(done, 6000);
});

describe('Moderation Module', function () {

    describe('MongoDB', function () {

        it('expect to be connected to the database', function () {
            expect(TestSuite.moderation.mongoose).to.not.be.equal(null);
        });
    });

    describe('Init', function () {

        //   TestSuite.moderation.mock = true;

        it('expect to not be set to mock enviroment', function () {
            expect(TestSuite.moderation.mock).to.be.false;
        })

        it('expect to have loaded matches from database', function () {
            expect(TestSuite.moderation.count()).to.not.equal(0);
        });
    });
    
    describe("Services", function () {
    describe("Manual Service", function () {


        describe('- Get Match [/v1/live/match/56a38549e4b067030e9f871d]', function () {

            it('should return the match with id 56a38549e4b067030e9f871d', function (done) {
                request(TestSuite.server)
                    .get('/v1/live/match/56a38549e4b067030e9f871d')
                    .expect(200)
                    .end(function (err, res) {
                        expect(err).to.equal(null);
                        expect(res.body.id).to.equal("56a38549e4b067030e9f871d");
                        match = res.body;
                        done();
                    })
            })
        });

        describe('- Post Match [/v1/live/match]', function () {
            //            it('should return the match with id 56a38549e4b067030e9f871d', function (done) {
            //                request(TestSuite.server)
            //                    .post('/v1/live/match')
            //                    .send({
            //                        id: '56a38549e4b067030e9f871d'
            //                    })
            //                    .expect(200)
            //                    .end(function (err, res) {
            //                        if (err) return done(err);
            //                        expect(err).to.equal(null);
            //                        expect(res.body.id).to.equal("56a38549e4b067030e9f871d");
            //                        match = res.body;
            //                        done();
            //                    })
            //            });
        });

        describe('- Post Event [/v1/moderation/:id/event]', function () {

            var eventobj = {
                "id": 16,
                "match_id": "56a38549e4b067030e9f871d",
                "type": "yellow",
                "stats": {
                    "yc": 1
                },
                "playerscount": 1,
                "status": "active",
                "timeline_event": true,
                "state": 0,
                "sender": "Moderator",
                "time": "54",
                "team": "away_team",
                "players": [
                    {
                        "id": "565c4af6e",
                        "team": "away_team",
                        "name": "jekhis",
                        "$$hashKey": "object:108"
                    }
                ]
            }

            // Add
            var addEventData = {
                type: "Add",
                match_id: "56a38549e4b067030e9f871d",
                data: eventobj
            };
            // Remove
            var removeEventData = {
                type: "Delete",
                match_id: "56a38549e4b067030e9f871d",
                data: eventobj
            };

            it('Add: should add a new event', function (done) {
                request(TestSuite.server)
                    .post('/v1/moderation/56a38549e4b067030e9f871d/event')
                    .send(addEventData)
                    .expect(200)
                    .end(function (err, res) {
                        if (err) return done(err);
                        expect(res.body.data.timeline[0].events.length).to.equal(1);
                        done();
                    })
            });

            it('Delete: should delete the last event', function (done) {
                request(TestSuite.server)
                    .post('/v1/moderation/56a38549e4b067030e9f871d/event')
                    .send(removeEventData)
                    .expect(200)
                    .end(function (err, res) {
                        if (err) return done(err);
                        expect(res.body.data.timeline[0].events.length).to.equal(0);
                        done();
                    })
            });


        });
    });
    describe('RSS-Feed Service', function () {
        it('match should have an RSS-Feed service registered', function () {
            service = _.findWhere(match.MODERATION_SERVICES, {
                type: 'rss-feed'
            });
            expect(service).to.not.be.equal(null);
        });

        it('should use a STATS parser', function () {
            //                console.log(service);
            expect(service.parsername).to.be.equal("Stats");
            expect(service.parser.name).to.be.equal("Stats");
        });
    });



});
});
var match = null;
var service = null;



describe('Wildcards Module', function () {

    //    describe('#Init', function () {
    //        it('the CardsInPlay List should be empty', function () {
    //            expect(TestSuite.wildcards.CardsInPlay.length).to.be.equal(0);
    //        });
    //    });

    describe('API', function () {
        var cardid = "";
        describe('ADD:', function () {
            it('should add a new wildacard', function (done) {
                request(TestSuite.server)
                    .post('/v1/wildcards')
                    .send(cardObject)
                    .expect(200)
                    .end(function (err, res) {
                        if (err) return done(err);
                        cardid = res.body.id;                    
                        expect(res.body.model.userid).to.equal("56a6800f6304484833115a2c");
                        done();
                    })
            });
            
            it('expect CardsInPlay to have been raised to 1', function () {
                expect(TestSuite.wildcards.CardsInPlay.length).to.be.equal(1);
            });
        });
         describe('DELETE:', function () {
            it('should delete the last wildacard from the database', function (done) {
                request(TestSuite.server)
                    .delete('/v1/wildcards')
                    .send({id:cardid})
                    .expect(200)
                    .end(function (err, res) {
                        if (err) return done(err);
                        expect(TestSuite.wildcards.CardsInPlay.length).to.be.equal(0);
                        done();
                    })
            });
             it('expect CardsInPlay to fall back to 0', function (done) {
       
                        expect(TestSuite.wildcards.CardsInPlay.length).to.be.equal(0);
                        done();
       
            });
            
        });

    });

});
