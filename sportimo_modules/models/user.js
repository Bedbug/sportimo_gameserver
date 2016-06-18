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


var achievement = new Schema({
    uniqueid: String,
    icon: String,
    title: mongoose.Schema.Types.Mixed,
    text: mongoose.Schema.Types.Mixed,
    has: Number,
    total: Number,
    completed: Boolean
});

var Achievements =  mongoose.model('achievements', achievement);

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
    social_id: String,
    pushToken: String,
    country: { type: String, required: false },
    admin: Boolean,
    stats: mongoose.Schema.Types.Mixed,
    level: { type: Number, default: 0 },
    achievements: [achievement],
    favoriteteams: [String]
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
    
    if(this.isNew){
       Achievements.find({},function(err,achievs){
            this.achievements = achievs;
        })
    }
    
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
        
        // Calculate achievements level
        var total = _.sumBy(user.achievements, 'total');
        var has = _.sumBy(user.achievements, 'has');
        user.level = has / total;
        
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
    return mongoose.model('users').findByIdAndUpdate(uid, { $inc: statChange }, { upsert: true }, function (err, result) {
        console.log('Stat Updated.');
    });
}

// Assign a method to increase achievements
// achievementChange should have the uniqueid of the achievemnt
// and the increment value
// e.g.
// {
//      unique: "123",
//      value:  1
// }
// Calback (cb) should handle 
// error: String - an error message
// success: String - a success message
// data: Achievement Object - The achievement object to forward to users in case of complettion

UserSchema.statics.addAchievementPoint = function (uid, achievementChange, cb) {
    return mongoose.model('users').findById(uid, function (err, user) {
        var achievement = _.find(user.achievements, { uniqueid: achievementChange.uniqueid });

        if (achievement) {
            if (achievement.completed)
                return cb(null, "No need to update. Achievement has been already completed.", null);

            achievement.has += achievementChange.value;

            if (achievement.has >= achievement.total) {
                achievement.has = achievement.total;
                achievement.completed = true;
            }

            //TODO: Should calculate level and return achievement object to clients
            cb(null, "Success. Achievement completed.", achievement);

            user.save(function(err,result){
                if(!err)
                console.log("User [%s] has raised their achievement count for achievement [%s]", uid, achievementChange.uniqueid);
            })
        }


    });
}

module.exports = mongoose.model('users', UserSchema);