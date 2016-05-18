// get an instance of mongoose and mongoose.Schema
var mongoose = require('mongoose'),
    bcrypt = require("bcryptjs"),
    Schema = mongoose.Schema;

var userStats = new Schema({
    matchesVisited: { type: Number, default: 0 },
    matchesPlayed: { type: Number, default: 0 },
    cardsPlayed: { type: Number, default: 0 },
    cardsWon: { type: Number, default: 0 },
    prizesWon: { type: Number, default: 0 }
})

var UserSchema = new Schema({
    name: {
        type: String
        // ,required: true
    },
    username: {
        type: String,
        unique: true,
        required: true
    },
    password: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true
    },
    picture: String,
    inbox: [{
        type: String,
        ref: 'messages'
    }],
    unread: Number,
    pushToken: String,
    country: { type: String, required: false },
    admin: Boolean,
    stats: mongoose.Schema.Types.Mixed
}, {
     timestamps: { updatedAt: 'lastActive' },
        toObject: {
            virtuals: true
        }, toJSON: {
            virtuals: true
        }
    });

UserSchema.pre('save', function (next) {
    var user = this;
  
    if (this.isModified('password') || this.isNew) {
        bcrypt.genSalt(10, function (err, salt) {
            if (err) {
                return next(err);
            }
            bcrypt.hash(user.password, salt, function (err, hash) {
                if (err) {
                    return next(err);
                }
                user.password = hash;
                next();
            });
        });
    } else {
        return next();
    }
});

UserSchema.methods.comparePassword = function (passw, cb) {
    bcrypt.compare(passw, this.password, function (err, isMatch) {
        if (err) {
            return cb(err);
        }
        cb(null, isMatch);
    });
};

// Assign a method to create and increment stats
// statChange can be any new value and should follow
// this format: {'stats.@statToIncr': @valueToIncr}

UserSchema.statics.IncrementStat = function (uid, statChange, cb) {
   
  return  mongoose.model('users').findByIdAndUpdate(user.uid, {  $inc: statChange}, { upsert: true }, function (err, result) {
                        console.log('Stat Updated.');
                    });
}

module.exports = mongoose.model('users', UserSchema);