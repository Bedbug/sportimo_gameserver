var request = require('supertest'),
express = require('express');

process.env.NODE_ENV = 'test';

var app = require('../app.js');
var _id = '';

/*
 *  ==== POST === 
 */ 

//Simple POST
describe('POST New Purchase', function(){
  it('creates new purchase and responds with json success message', function(done){
    request(app)
    .post('/api/purchase')
    .set('Accept', 'application/json')
    .expect('Content-Type', /json/)
    .send({"purchase": {"status":"John of Worcester's Chronicon ex chronicis appears to have had a manuscript that was either [A] or similar to it; he makes use of annals that do not appear in other versions, such as entries concerning Edward the Elder's campaigns and information about Winchester towards the end of the chronicle.","user":"Since the 1970s Wintjiya had created artefacts such as ininti seed necklaces, mats and baskets, using traditional artistic techniques including weaving of spinifex grass.","type":"Louise's early life was spent moving among the various royal residences in the company of her family.","info":"He was effectively the overlord of Britain south of the Humber from the early 660s, although not overlord of Northumbria as his father had been.","provider":"The male mates with the female by swimming close to her with his head lowered and tail raised, continually whistling.","method":") In the household of Henry Stafford in 1469, gentle members received 2.","receiptid":"of \"white\" plate."}})
    .expect(201)
    .end(function(err, res) {
      if (err) {
        throw err;
      }
      _id = res.body.data._id;
      done();
    });
  });
});

//Incorrect POST
describe('POST New Item Incorrectly', function(){
  it('Does not create new "item" and responds with json error message', function(done){
    request(app)
    .post('/api/purchase')
    .set('Accept', 'application/json')
    .expect('Content-Type', /json/)
    .send({"purchaseX": {"status":"John of Worcester's Chronicon ex chronicis appears to have had a manuscript that was either [A] or similar to it; he makes use of annals that do not appear in other versions, such as entries concerning Edward the Elder's campaigns and information about Winchester towards the end of the chronicle.","user":"Since the 1970s Wintjiya had created artefacts such as ininti seed necklaces, mats and baskets, using traditional artistic techniques including weaving of spinifex grass.","type":"Louise's early life was spent moving among the various royal residences in the company of her family.","info":"He was effectively the overlord of Britain south of the Humber from the early 660s, although not overlord of Northumbria as his father had been.","provider":"The male mates with the female by swimming close to her with his head lowered and tail raised, continually whistling.","method":") In the household of Henry Stafford in 1469, gentle members received 2.","receiptid":"of \"white\" plate."}})
    .expect(500)
    .end(function(err, res) {
      if (err) {
        throw err;
      }
      done();
    });
  });
});



/*
 *  ==== GET === 
 */ 

// Get List of Items
describe('GET List of Purchases', function(){
  it('responds with a list of purchase items in JSON', function(done){
    request(app)
    .get('/api/purchases')
    .set('Accept', 'application/json')
    .expect('Content-Type', /json/)
    .expect(200, done);
  });
});

// Get Single Item
describe('GET Purchase by ID', function(){
  it('responds with a single purchase item in JSON', function(done){
    request(app)
    .get('/api/purchase/'+ _id )
    .set('Accept', 'application/json')
    .expect('Content-Type', /json/)
    .expect(200, done);
  });
});


// Get Single Item Incorrectly
describe('GET Item by Incorrect ID', function(){
  it('responds with a error status for "item" in JSON', function(done){
    request(app)
    .get('/api/purchase/'+ _id+'X' )
    .set('Accept', 'application/json')
    .expect('Content-Type', /json/)
    .expect(404, done);
  });
});




/*
 *  ==== PUT === 
 */ 

//Simple PUT
describe('PUT Purchase by ID', function(){
  it('updates purchase item in return JSON', function(done){
    request(app)
    .put('/api/purchase/'+ _id )
    .set('Accept', 'application/json')
    .expect('Content-Type', /json/)
    .send({ "purchase": { "title": "Hell Is Where There Are No Robots" } })    
    .expect(202, done);
  });
});

// PUT with Incorrect id
describe('PUT Item by Incorrect ID', function(){
  it('Does not update "item" & return JSON with error status', function(done){
    request(app)
    .put('/api/purchase/'+ _id +'X')
    .set('Accept', 'application/json')
    .expect('Content-Type', /json/)
    .send({ "purchase": { "title": "Hell Is Where There Are No Robots" } })    
    .expect(404, done);
  });
});

// PUT with Incorrect data
describe('PUT Item by Incorrect data', function(){
  it('Does not update "item" & return JSON with error status', function(done){
    request(app)
    .put('/api/purchase/'+ _id )
    .set('Accept', 'application/json')
    .expect('Content-Type', /json/)
    .send({ "purchaseX": { "title": "Hell Is Where There Are No Robots" } })    
    .expect(500, done);
  });
});



/*
 *  ==== DELETE === 
 */ 

//Simple Delete
describe('DELETE Purchase by ID', function(){
  it('should delete purchase and return 200 status code', function(done){
    request(app)
    .del('/api/purchase/'+ _id) 
    .expect(202, done);
  });
});

//Incorrect Delete
describe('DELETE Item by Incorrect ID', function(){
  it('should NOT delete item and return 500 status code', function(done){
    request(app)
    .del('/api/purchase/'+ _id+'X') 
    .expect(500, done);
  });
});
