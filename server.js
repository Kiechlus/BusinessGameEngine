"use strict";
// Wraps the http server, handles routing
var express = require("express"),
    app = express(),
    server = require("http").Server(app),
// Implementation of the WebSocket protocol
// Pass server to create instance of Socket.IO
    io = require("socket.io")(server),
    dbConnector = require("./db/connectionHandler"),
// Implements the application logic
    GameControler = require("./GameControler"),
    bodyParser = require('body-parser'),
    csrf = require('csurf'),
    cookieParser = require('cookie-parser'),
    url = require("url");

// TCP port the server is listening on
var port = 3000;

// Game controller. Will be instantiated after db-connection and server start.
var controler;

// Database object which is shared across the application (connection pooling)
var database;
function getDb() {
    return database;
}
module.exports.getDb = getDb;

// MongoDB collection where the code of the games + author, description etc. are stored
var gamesCollection;

//Set up the socket.io namespace for used for the Business Game Architecture.
//Like this, the server could run other websocket applications (e.g. a chat or the saltseller standalone) on other namespaces.
var businessGamesNamespace = io.of("/bgeNs");

app.set('view engine', 'jade');
app.set('views', __dirname + '/public/views');


// Connect the database
dbConnector.connect(dbConnector.url, connectionCallback);

function connectionCallback(err, db) {
    if (err) console.error(err);
    database = db;
    console.log("MongoDB default connection open to " + dbConnector.url);
    gamesCollection = database.collection("games");
    module.exports.gamesCollection = gamesCollection;
    // Start the TCP server    
    server.listen(port, function () {
        console.log("Server listening at port %d", port);
    });
    // Initialiaze and run the controler
    controler = new GameControler(businessGamesNamespace);
//    controler.run();
}

app.use(cookieParser());
app.use(csrf({cookie: true}));
app.use(bodyParser.json());       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
    extended: true
}));

/*
 Routing
 */

app.use(express.static(__dirname + "/public"));
// Index.html (Home) in /public wird automatisch geladen.

// A simple file server
app.use("/files", express.static(__dirname + "/files"));

app.use("/thesis", express.static(__dirname + "/thesis"));

//http://stackoverflow.com/questions/10849687/express-js-how-to-get-remote-client-address
app.enable('trust proxy');

// startpage
app.get("/", function (req, res) {
    // render games.jade in the /views folder. This injects the CSRF token into the html.
    res.render("games", {token: req.csrfToken()});
});

app.get("/create", function (req, res) {
    res.render("create", {token: req.csrfToken()});
});

app.get("/edit/", function (req, res) {
    res.render("edit", {token: req.csrfToken()});
});

app.get("/show/", function (req, res) {
    res.sendFile(__dirname + "/public/show.html");
});

app.get("/simulate", function (req, res) {
    res.sendFile(__dirname + "/public/simulate.html");
});
app.get("/play", function (req, res) {
    res.sendFile(__dirname + "/public/play.html");
});
app.get("/analyse", function (req, res) {
    var params = url.parse(req.url, true);
    var gameName = params.query.name;
    var collection = controler.db.collection(gameName);
    controler.dbf.find(collection, findCallback);
    function findCallback(err, data) {
        if (err) {
            console.error(err);
        }
        else if (data) {
            res.setHeader('Content-disposition', 'attachment; filename=gameData.json');
            res.set('Content-Type', 'text/csv');
            res.status(200).send(data);
        }
    }
});
app.get("/docu", function (req, res) {
    const bots = ['Bingbot', 'Googlebot', 'Yandex', 'Baidu'];
    let isBot = false;
    const details = {};
    details.timestamp = new Date();
    details.host = req.get('host');
    details.ip = req.ip;
    details.userIp = req.socket.remoteAddress;
    details.origin = req.get('origin');
    details.headers = req.headers;
    database.collection('logs').update({type: 'global'}, {$inc: {"docuCounter": 1}});
    bots.map(bot=> {
        if (req.headers['user-agent'].match(new RegExp(bot, 'i'))) {
            isBot = true;
        }
    });
    if (isBot) {
        details.type = 'robot';
        database.collection('logs').insert(details);
        database.collection('logs').update({type: 'global'}, {$inc: {"docuRobotCounter": 1}});
    } else {
        details.type = 'normal';
        database.collection('logs').insert(details);
    }

    res.sendFile(__dirname + "/thesis/thesis.html");
});

app.get("/docuPdf", function (req, res) {
    database.collection('logs').update({type: 'global'}, {$inc: {"docuPdfCounter": 1}});
    res.download(__dirname + '/public/files/Thesis_160111.pdf', 'Documentation.pdf');
});

app.get("/docu/googlec9f521b773a8e6db.html", function (req, res) {
    res.sendFile(__dirname + "/thesis/googlec9f521b773a8e6db.html");
});


// Return the code of a specific game
app.get("/getCode", function (req, res) {
    var params = url.parse(req.url, true);
    var gameName = params.query.name;
    var query = {"name": gameName};
    controler.dbf.findOne(gamesCollection, findCallback, query);
    function findCallback(err, data) {
        if (err) {
            console.error(err);
        } else {
            if (data) {
                var response = {
                    name: data.name,
                    description: data.description,
                    author: data.author,
                    code: data.gameCode,
                }
                // TODO: If you need to respond with data, instead use methods such as res.send() and res.json().
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify(response));
            }
        }
    }
});

// Search all available games
app.get("/gameList", function (req, res) {
    var gameList;
    var projection = {
        fields: {
            name: 1
        },
        sort: {
            name: 1
        }
    };
    controler.dbf.find(gamesCollection, findCallback, undefined, projection);
    function findCallback(err, data) {
        if (err) {
            console.error(err);
        } else {
            gameList = data;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(gameList));
        }
    }
});

// Not in use. Send whole select as html to client
app.get("/gameSelect", function (req, res) {
    console.log("in /gameSelect");
    var select = '<select id="games" class="four columns" size="2"><option value="serverPower">serverPower</option></select>';
    res.set('Content-Type', 'text/html');
    res.setHeader('Content-Type', 'text/html');
    res.send(select);
});

// Delete a game
app.post("/delete", function (req, res) {
    var name = req.body.name;
    controler.dbf.getGamePassword(gamesCollection, name, pwCallback);
    function pwCallback(err, passwordObject) {
        if (err) {
            console.error(err);
        } else {
            // password the user entered
            var password = req.body.password;
            // check if password hashes match
            if (passwordObject && password === passwordObject.password && typeof name === "string") {
                var response = {
                    pwFail: false,
                };
                controler.dbf.removeGame(gamesCollection, name, deleteCallback);
            } else {
                var response = {
                    pwFail: true,
                };
            }
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(response));
        }
    }
});

function deleteCallback(err, result) {
    if (err) {
        console.error(err);
    } else {
        console.log("game deleted successfully");
    }
}

// Check passwords
app.get("/pwCheck", function (req, res) {
    var params = url.parse(req.url, true);
    var gameName = params.query.name;
    var hash = params.query.password;
    controler.dbf.getGamePassword(gamesCollection, gameName, pwCallback);
    function pwCallback(err, passwordObject) {
        if (err) {
            console.error(err);
        } else {
            if (passwordObject) {
                var pwMatch = (hash === passwordObject.password);
                var response = {
                    pwMatch: pwMatch,
                };
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify(response));
            }
        }
    }
});

// Receive code from the create or edit page and save it to the database
app.post("/code", function (req, res) {
    var code = req.body.code;
    var name = req.body.name.toLowerCase();
    var description = req.body.description;
    var author = req.body.author;
    var edit = req.body.edit;
    var password = req.body.password;
    var response = {
        errors: undefined,
        warnings: undefined,
    };
    try {
        var saveGameObject = {
            name: name,
            description: description,
            author: author,
            creationDate: new Date(),
//            gameCode: codeString,
            gameCode: code,
        };
    } catch (e) {
        console.error("Error stringifying game");
        response.errors = e.stack;
    }
    // comes from gameValidation:
    if (!response.errors) {
        if (edit) {
            gamesCollection.update({'name': name}, {$set: {'gameCode': code}}, updateCallback);

        } else {
            controler.dbf.uniqueGameName(name, gamesCollection, uniqueCallback);
        }
    }
    function uniqueCallback(err, result) {
        if (err) {
            console.error(err);
        }
        else if (result === false) {
            response.errors = "A game with the name of " + name + " already exists in the database. Game names must be unique.";
            res.setHeader("Content-Type", "application/json");
            res.send(JSON.stringify(response));
        }
        else {
            saveGameObject.password = password;
            // save game to database
            controler.dbf.insert(gamesCollection, saveGameObject, saveCallback);
        }
    }

    function updateCallback(err) {
        if (err) {
            console.error(err);
            response.errors = err.stack;
        } else {
            console.log(new Date() + ": " + name + " updated successfully");
        }
        res.setHeader("Content-Type", "application/json");
        res.send(JSON.stringify(response));
    }

    function saveCallback(err, data) {
        if (err) {
            console.error(err);
            response.errors = err.stack;
        } else {
            console.log(new Date() + ": " + name + " saved successfully");
        }
        res.setHeader("Content-Type", "application/json");
        res.send(JSON.stringify(response));
    }
});

// CSRF error handling
app.use(function (err, req, res, next) {

    if (err.code !== 'EBADCSRFTOKEN') return next(err)

    // handle CSRF token errors here
    console.log(Date() + "csrf attack detected");
    res.status(403);
    res.send('permission denied');
});






