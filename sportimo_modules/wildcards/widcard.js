
var wildcards = {};

//  The list that holds all active cards 
wildcards.CardsInPlay = [];

// the database connection
wildcards.db = null;

// load models and setup database connection
wildcards.SetupMongoDB = function(dbconenction){
    this.db = dbconenction;
    var modelsPath = path.join(__dirname, 'models');
        fs.readdirSync(modelsPath).forEach(function (file) {
            require(modelsPath + '/' + file);
        });
        wildcardModel = this.mongoose.models.team;  
}


module.exports = wildcards;