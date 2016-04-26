var MongoClient = require('mongodb').MongoClient;
var databaseUrl = "mongodb://localhost/BusinessGames";

module.exports.connect = MongoClient.connect;
module.exports.url = databaseUrl;

