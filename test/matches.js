var expect = require('chai').expect,
request = require('supertest');
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

describe('Matches methods', function () {
    describe('#init', function () {
        
    //   TestSuite.moderation.mock = true;
        
        it('Moderation should not be set to mock enviroment',function(){
            expect(TestSuite.moderation.mock).to.be.false;
        })
        
        it('should load match into memory', function () {
            expect(TestSuite.moderation.count()).to.not.equal(0);
        });
    });
    
     describe('#Get /v1/live/match/565c4af6e4b030fba33dd459', function () {
       
        it('should return the match with id 565c4af6e4b030fba33dd459',function(done){
            request(TestSuite.server)
            .get('/v1/live/match/565c4af6e4b030fba33dd459')
            .expect(200)
            .end(function(err,res){
                expect(err).to.equal(null);
                expect(res.body.id).to.equal("565c4af6e4b030fba33dd459");
                done();
            })
        })
        
        // it('should load match into memory', function () {
        //     expect(app.moderation.count()).to.not.equal(0);
        // });
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