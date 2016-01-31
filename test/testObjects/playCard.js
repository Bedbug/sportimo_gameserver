module.exports = {
    userid: "56a6800f6304484833115a2c",
    gameid: "56a38549e4b067030e9f871d",
    minute: 5,
    segment: 1,
    activates_in: 1000,
    duration: 10000, // 10"
    timer: 0,
    appear_conditions: [], // empty - always avalable
    win_conditions: {
        match: [], // empty - no match conditions 
        stats: [{
            "yc": {
                "@gt": 3
            }
        }]
    },
    points: 0,
    minpoints: 10,
    maxpoints: 100,
    created: null,
    activated: null,
    ended: null,
    status: 0,
    linked_event: 0

}


// Sample dollar conditions checking

//if (options && options.upsert) {
//    paths = Object.keys(query._conditions);
//    numPaths = keys.length;
//    for (i = 0; i < numPaths; ++i) {
//      var path = paths[i];
//      var condition = query._conditions[path];
//      if (condition && typeof condition === 'object') {
//        var conditionKeys = Object.keys(condition);
//        var numConditionKeys = conditionKeys.length;
//        var hasDollarKey = false;
//        for (j = 0; j < numConditionKeys; ++j) {
//          if (conditionKeys[j].charAt(0) === '$') {
//            hasDollarKey = true;
//            break;
//          }
//        }
//        if (hasDollarKey) {
//          continue;
//        }
//      }
//      updatedKeys[path] = true;
//      modified[path] = true;
//    }
