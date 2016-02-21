var request = require('supertest'),
express = require('express');

process.env.NODE_ENV = 'test';

var app = require('../app.js');
var _id = '';


describe('POST New Item', function(){
  it('creates new item and responds with json success message', function(done){
    request(app)
    .post('/api/item')
    .set('Accept', 'application/json')
    .expect('Content-Type', /json/)
    .send({"item": {"name":"9 rebounds per game earned him his second MVP award, and the Lakers reached the 1989 NBA Finals, in which they again faced the Pistons.","price":-37.36870144493878}})
    .expect(201)
    .end(function(err, res) {
      if (err) {
        throw err;
      }
      _id = res.body._id;
      done();
    });
  });
});

describe('GET List of Items', function(){
  it('responds with a list of item items in JSON', function(done){
    request(app)
    .get('/api/items')
    .set('Accept', 'application/json')
    .expect('Content-Type', /json/)
    .expect(200, done);
  });
});

describe('GET Item by ID', function(){
  it('responds with a single item item in JSON', function(done){
    request(app)
    .get('/api/item/'+ _id )
    .set('Accept', 'application/json')
    .expect('Content-Type', /json/)
    .expect(200, done);
  });
});


describe('PUT Item by ID', function(){
  it('updates item item in return JSON', function(done){
    request(app)
    .put('/api/item/'+ _id )
    .set('Accept', 'application/json')
    .expect('Content-Type', /json/)
    .send({ "item": { "title": "Hell Is Where There Are No Robots" } })    
    .expect(200, done);
  });
});

describe('DELETE Item by ID', function(){
  it('should delete item and return 200 status code', function(done){
    request(app)
    .del('/api/item/'+ _id) 
    .expect(204, done);
  });
});