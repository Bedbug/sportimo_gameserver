module.exports = {
    userid: "56a6800f6304484833115a2c",
    gameid: "56a38549e4b067030e9f8111",
    minute: 5,
    segment: 1,
    activates_in: 50,
    duration: 90000, // 90"
    timer: 0,
    text: "Jokovic will get 2 yellow cards",
    appear_conditions: [], // empty - always avalable
    win_conditions: {
        match: [], // empty - no match conditions 
        stats: [{
            id:  "56a385413eb067030e9f87dd1",
            "yellow": 2
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
