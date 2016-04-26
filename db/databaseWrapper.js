var assert = require("assert");
var async = require("async");


// Insert the document to the targetCollection. Use auto-incremented integer IDs instead of UIDs. 
function insert(targetCollection, document, callback) {
    var keepRunning = true;
    var seq = 1;
    // $type 16/18: Integer Values
    var isNumericQuery = {$or : [{"_id" : { $type : 16 }}, {"_id" : { $type : 18 }}]};
    async.whilst(testFunction, mainFunction, afterFinishFunction);
    // Called before each execution of mainFunction(). Works like the stop criteria of a while function.
    function testFunction() { 
        return keepRunning; 
    }
    // Called each time the testFunction() passes. It is passed a function (next) which must be called after it has completed.
    function mainFunction(next) {
        findCursor(targetCollection, findCursorCallback, isNumericQuery, { _id: 1 });
        function findCursorCallback(cursor) {
            cursor.sort( { _id: -1 } ).limit(1);
            cursor.each(cursorEachCallback);
        }
        function cursorEachCallback(err, doc) {
            if (err) console.error("ERROR: " + err);
            if (doc != null) {
                seq = doc._id + 1;
                document._id = seq;
                targetCollection.insert(document, insertCallback);
            }
            if (seq === 1) {
                document._id = 1;
                targetCollection.insert(document, insertCallback);
            }
        }
        function insertCallback(err, result) {
            if (err) {
                console.dir(err);
            }
            else {
                keepRunning = false;
            }
            next();
        }
    }
    // Called once after the testFunction() fails and the loop has ended. 
    function afterFinishFunction(err) {
        callback(err, document);
    }
}

// Call find() with optional query and projection criteria and return the cursor object.
function findCursor(collection, callback, optQueryObject, optProjectionObject) {
    if (optProjectionObject === undefined) {
        optProjectionObject = {};
    }
    var cursor = collection.find(optQueryObject, optProjectionObject);
    callback(cursor);
}

// TODO: this one is faster? use rather this
function insertDocument2(doc, collection) {
    var isNumericQuery = {$or : [{"_id" : { $type : 16 }}, {"_id" : { $type : 18 }}]};
    collection.find(isNumericQuery, {
        limit: 1,
        fields: {
            _id: 1
        },
        sort: {
            _id: -1
        }
    }).toArray(function (err, docs) {
        var _next = docs.length ? docs[0]._id + 1 : 1;
        doc._id = _next;
        collection.insert(doc, function (err, result) {
            if (err && err.message.indexOf("11000") > -1) {
                //try again
                insertDocument(doc, collection);
            }
        });
    });

}

 //TODO: collection must be defined
function find2(collection, callback, optQueryObject, optProjectionObject) {
    if (optProjectionObject === undefined) {
        optProjectionObject = {};
    }
    var cursor = collection.find(optQueryObject, optProjectionObject);
    var data = [];
    cursor.each(function(err, doc) {
        assert.equal(err, null);
        if (doc != null) {
            data.push(doc);
        } else {
            callback(err, data);
        }
    });
}

// Return an array of results
function find(collection, callback, optQueryObject, optProjectionObject) {
    if (optProjectionObject === undefined) {
        optProjectionObject = {};
    }
    collection.find(optQueryObject, optProjectionObject).toArray(arrayCallback);
    function arrayCallback(err, dataArray) {
        if (err) {
            callback(err, null);
        } else {
            callback(null, dataArray);
        }
    }
}

// Return one single result
function findOne(collection, callback, optQueryObject, optProjectionObject) {
    if (optProjectionObject === undefined) {
        optProjectionObject = {};
    }
    collection.findOne(optQueryObject, optProjectionObject, callback);
}

// Return a password from the database
function getGamePassword(collection, gameName, callback) {
    var query = {"name": gameName};
    var projection = {
        fields: {
            password: 1
        }
    }
    findOne(collection, callback, query, projection);
}

// Removes a game given his name from the target collection.
function removeGame(collection, gameName, callback) {
    if (callback) {
        if (collection && gameName) {
            var removeQuery = {
                name: gameName,
            }
            collection.remove(removeQuery, callback);
        } else {
            var errorMessage = "Arguments missing.";
            callback(errorMessage, null);
        }
    }
}

// returns true if the game with gameName is unique in the collection
function uniqueGameName(gameName, collection, callback) {
    var query = {name: gameName};
    collection.find(query).toArray(resultCallback);
    function resultCallback(err, data) {
        if (err) {
            callback(err, null);
        }
        else if (data.length === 0) {
            callback(null, true);
        } else {
            callback(null, false);
        }
    }
}

module.exports.insert = insert;
module.exports.getGamePassword = getGamePassword;
module.exports.removeGame = removeGame;
module.exports.find = find;
module.exports.findOne = findOne;
module.exports.uniqueGameName = uniqueGameName;

