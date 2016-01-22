var expect = require('chai').expect,
    request = require('supertest'),
    _ = require('lodash');
// var mongoose = require('mongoose');  
// var mockgoose = require('mockgoose');
// mockgoose(mongoose);  
var TestSuite = require('../server');
//var LiveMatches = require('../sportimo_modules/match-moderation');

before(function (done) {
    // TestSuite.moderation.mock = true;
    TestSuite.moderation.callback = done;
    // setTimeout(done, 6000);
});

describe('Moderation Module', function () {


    describe('#MongoDB', function () {

        it('should have connected to the database', function () {
            expect(TestSuite.moderation.mongoose).to.not.be.equal(null);
        });
    });

    describe('#init', function () {

        //   TestSuite.moderation.mock = true;

        it('should not be set to mock enviroment', function () {
            expect(TestSuite.moderation.mock).to.be.false;
        })

        it('should have loaded matches from database', function () {
            expect(TestSuite.moderation.count()).to.not.equal(0);
        });
    });
    
      var match = null;
    var service = null;
    
    describe("Manual API", function () {


        describe('#Get Match [/v1/live/match/565c4af6e4b030fba33dd459]', function () {
          
            it('should return the match with id 565c4af6e4b030fba33dd459', function (done) {
                request(TestSuite.server)
                    .get('/v1/live/match/565c4af6e4b030fba33dd459')
                    .expect(200)
                    .end(function (err, res) {
                        expect(err).to.equal(null);
                        expect(res.body.id).to.equal("565c4af6e4b030fba33dd459");
                        match = res.body;
                        done();
                    })
            })

           


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
    //   describe('#hook', function() {
    //     it('hook to live match', function(done) {
    //       request(app)
    //         .post('/users/signup')
    //         .send({email: 'test@test.com', password: 'password'})
    //         .expect(200)
    //         .end(function(err, res) {
    //           if (err) return done(err); 
    //           expect(err).to.equal(null);
    //           expect(res.body.success).to.equal(true);
    //           expect(res.body.user).to.be.an('object');
    //           expect(res.body.user.email).to.equal('test@test.com');
    //           // we will filter the user object and not return the 
    //           // password hash back
    //           expect(res.body.user.password).to.equal(undefined);
    //           done();
    //         });
    //     });
    //   });
});

// var assert = require('assert');
// describe('Array', function () {
//     describe('#indexOf()', function () {
//         it('should return -1 when the value is not present', function () {
//             assert.equal(-1, [1, 2, 3].indexOf(5));
//             assert.equal(-1, [1, 2, 3].indexOf(0));
//         });
//     });
// });
