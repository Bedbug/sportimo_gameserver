// =======================
// get the packages we need 
// =======================
var express = require('express');
var bodyParser = require('body-parser');
var morgan = require('morgan');
var mongoose = require('mongoose');

var jsonwebtoken = require('jsonwebtoken'); // used to create, sign, and verify tokens
var jwtDecode = require('jwt-decode');
var config = require('./config'); // get our config file
var User = require('./models/user'); // get our mongoose model


var app = null;

try {
    app = require('./../../server');

} catch (ex) {
    // Start server
    app = module.exports = exports.app = express.Router();
    var port = process.env.PORT || 3000;
    app.listen(port, function() {
        console.log('Express server listening on port %d in %s mode', port, app.get('env'));
    });
}

app.set('superSecret', config.secret); // secret variable


app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, X-Access-Token");
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    next();
});


// use body parser so we can get info from POST and/or URL parameters
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());


// ================
// API ROUTES -------------------
// ================
app.get('/v1/users/setup', function(req, res) {

    // create a sample user
    var nick = new User({
        name: 'Nick Cerminara',
        username: 'nickG',
        password: 'password',
        admin: true
    });

    // save the sample user
    nick.save(function(err) {
        if (err) throw err;

        console.log('User saved successfully');
        res.json({ success: true });
    });
});



// get an instance of the router for api routes
var apiRoutes = express.Router();



// route middleware to verify a token
var jwtMiddle = function(req, res, next) {
 
    // check header or url parameters or post parameters for token
    var token = req.body.token || req.query.token || req.headers['x-access-token'];
   
    // decode token
    if (token) {

        // verifies secret and checks exp
        jsonwebtoken.verify(token, app.get('superSecret'), function(err, decoded) {       
            if (err) {
                return res.json({ success: false, message: 'Failed to authenticate token.' });
            } else {
                // if everything is good, save to request for use in other routes
                req.decoded = decoded;
                next();
            }
        });

    } else {

        // if there is no token
        // return an error
        return res.status(403).send({
            success: false,
            message: 'No token provided.'
        });

    }
};

// Route to create a new user (POST /v1/users)
apiRoutes.post('/v1/users', function(req, res) {
    // save the sample user
    var newUser = new User(req.body);
    newUser.save(function(err, user) {
        if (err) res.status(500).send(err);
        else {
            var token = jsonwebtoken.sign(user, app.get('superSecret'), {
                expiresInMinutes: 1440 // expires in 24 hours
            });
            user = user.toObject();
            user.token = token;
            user.success = true;
            // return the information including token as JSON
            res.status(200).send(user);
        }
    });
});



//Route to authenticate a user (POST /v1/users/authenticate)
apiRoutes.post('/v1/users/authenticate', function(req, res) {

    // find the user
    User.findOne({
        username: req.body.username
    }, function(err, user) {

        if (err) throw err;

        if (!user) {
            res.json({ success: false, message: 'Authentication failed. User not found.' });
        } else if (user) {

            // check if password matches
            user.comparePassword(req.body.password, function(err, isMatch) {
                if (!isMatch || err) {
                    res.json({ success: false, message: 'Authentication failed. Wrong password.' });
                } else {

                    // if user is found and password is right
                    // create a token
                    user = user.toObject();
                    var token = jsonwebtoken.sign(user, app.get('superSecret'), {
                        expiresInMinutes: 1440 // expires in 24 hours
                    });
                    user.token = token;
                    user.success = true;
                    // return the information including token as JSON
                    res.status(200).send(user);
                }
            });
        }

    });
});

// Route to return all users (GET http://localhost:8080/api/users)
apiRoutes.get('/v1/users', jwtMiddle, function(req, res) {
    User.find({}, function(err, users) {
        res.json(users);
    });
});

// Route to return specific user (GET http://localhost:8080/api/users)
apiRoutes.get('/v1/users/:id', jwtMiddle, function(req, res) {

    var token = req.body.token || req.query.token || req.headers['x-access-token'];
    var decoded = jwt_decode(token);
    console.log(decoded);
    if (decoded.admin) {
        // Full user Profile
        User.findById(req.params.id, function(err, user) {
            res.json(user);
        });
    }
    else
    {
        // Mini Profile
         User.findById(req.params.id, function(err, user) {
            res.json(user);
        });
    }
});

// apply the routes to our application with the prefix /api
app.use('/', apiRoutes);