var expect = require('chai').expect,
    request = require('supertest'),
    _ = require('lodash');

/****************************************************
 * Test helper objects
 */
var eventobj = require("./testObjects/eventYellow");
var playCard = require("./testObjects/playCard");

var addEventData = {
    type: "Add",
    match_id: "56a38549e4b067030e9f871d",
    data: eventobj
};

var removeEventData = {
    type: "Delete",
    match_id: "56a38549e4b067030e9f871d",
    data: eventobj
};

/***************************************************/


// var mockgoose = require('mockgoose');
// mockgoose(mongoose);  

var TestSuite = require('../server');
TestSuite.moderation.testing = true;

before(function (done) {
    // TestSuite.moderation.mock = true;
    TestSuite.moderation.callback = done;
    // setTimeout(done, 6000);
});

describe('MODERATION Module', function () {

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

    //    describe("Services", function () {
    //        describe("Manual Service", function () {


    describe('GET [/v1/live/match/56a38549e4b067030e9f871d]', function () {

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

    //            describe('- Post Match [/v1/live/match]', function () {
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
    //            });

    describe('POST [/v1/moderation/:id/event]', function () {



        var returnedEvent;
        it('event type: Add, should add a new event', function (done) {
            request(TestSuite.server)
                .post('/v1/moderation/56a38549e4b067030e9f871d/event')
                .send(addEventData)
                .expect(200)
                .end(function (err, res) {
                    if (err) return done(err);
                    returnedEvent = res.body.data.timeline[res.body.data.state].events[res.body.data.timeline[res.body.data.state].events.length - 1];
                    removeEventData.data = returnedEvent;
                    expect(res.body.data.timeline[0].events.length).to.equal(1);
                    done();
                })
        });

        it('should have 3 new stat modifications', function () {

            var length = returnedEvent.linked_mods.length;
            expect(length).to.equal(3);
            //                    setTimeout(function(){console.log("done");done();}, 5000);
        });

        it('event type: Delete, should delete the last event', function (done) {
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
    //        });
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



    //    });
});
var match = null;
var service = null;



describe('WILDCARDS Module', function () {


    var cardid = "";
    describe('Play card / 2 yellows', function () {
        it('should add a new wildacard', function (done) {
            request(TestSuite.server)
                .post('/v1/wildcards')
                .send(playCard)
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

    var returnedYellowOne;
    var returnedYellowTwo;

    /** ***********************************************
     *   2 Yellow Events to test winning wildcard
     */
    describe('Sent two yellow events', function () {

        it('first one should incerement stat "yellow" to 1', function (done) {
            request(TestSuite.server)
                .post('/v1/moderation/56a38549e4b067030e9f871d/event')
                .send(addEventData)
                .expect(200)
                .end(function (err, res) {
                    if (err) return done(err);
                    returnedYellowOne = res.body.data.timeline[res.body.data.state].events[res.body.data.timeline[res.body.data.state].events.length - 1];

                    var stats = TestSuite.moderation.GetMatch("56a38549e4b067030e9f871d").data.stats;

                    var stat = _.find(stats, {
                        id: "56a385413eb067030e9f87dd1"
                    });

                    expect(stat.yellow).to.be.equal(1);
                    done();
                })
        });

        it('second one should incerement stat "yellow" to 2', function (done) {
            request(TestSuite.server)
                .post('/v1/moderation/56a38549e4b067030e9f871d/event')
                .send(addEventData)
                .expect(200)
                .end(function (err, res) {
                    if (err) return done(err);

                    returnedYellowTwo = res.body.data.timeline[res.body.data.state].events[res.body.data.timeline[res.body.data.state].events.length - 1];

                    var stats = TestSuite.moderation.GetMatch("56a38549e4b067030e9f871d").data.stats;

                    var stat = _.find(stats, {
                        id: "56a385413eb067030e9f87dd1"
                    });

                    expect(stat.yellow).to.be.equal(2);
                    done();
                })
        });

        it('should win the played card', function (done) {
            expect(TestSuite.wildcards.CardsInPlay[0].model.won).to.not.be.equal(null);
        })



        it('should delete the first yellow event', function (done) {
            removeEventData.data = returnedYellowOne;
            request(TestSuite.server)
                .post('/v1/moderation/56a38549e4b067030e9f871d/event')
                .send(removeEventData)
                .expect(200)
                .end(function (err, res) {
                    if (err) return done(err);
                    expect(res.body.data.timeline[0].events.length).to.equal(1);
                    done();
                })
        });

        it('should delete the second yellow event', function (done) {
            removeEventData.data = returnedYellowTwo;
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

    })

    /************************************************************/


    describe('Clean Up', function () {

        it('should delete the last wildacard from the database', function (done) {
            request(TestSuite.server)
                .delete('/v1/wildcards')
                .send({
                    id: cardid
                })
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

    //    });

});
