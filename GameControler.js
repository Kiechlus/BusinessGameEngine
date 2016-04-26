
/*
Game controler implements the server-side game logic of BGE. The server 
holds one instance of it.
*/

"use strict";
var uuid = require("node-uuid");
var BGE = require("./public/modules.js").BGE;

// Constructor
function GameControler(namespace) { 
    this.nsp = namespace; 
    this.runningGames = {};
    // database connection pool
    this.db = require("./server").getDb();
    // database functionality
    this.dbf = require("./db/databaseWrapper");
    this.gamesCollection = require("./server").gamesCollection;
    this.registerHandlers();
};

// Add the "connection" and "disconnect" event handlers.
// Call addCustomHandlers() to register the custom handlers.
GameControler.prototype.registerHandlers = function() {
  var self = this;
  self.nsp.on("connection", nspOnConnection);
  function nspOnConnection(socket) {
    // Add the event handlers.   
    self.addCustomHandlers(socket);   
    // When the user disconnects perform this.
    socket.on("disconnect", socketOnDisconnect);
    function socketOnDisconnect() {
        self.handleAbort(socket.gameId, socket.playerId);
        if (self.runningGames[socket.gameId]) {
            if (self.runningGames[socket.gameId].delete) {
                delete self.runningGames[socket.gameId];
                console.log(socket.gameId + ' deleted from the game table. ');
            }
        }
    }
  } 
};

// Add the event handlers for custom events the client emits.
// These events are: play, input, result, finish, abort
GameControler.prototype.addCustomHandlers = function(socket) {
    var self = this;
    // A client emits play after hitting the play button on the startpage
    socket.on("play", socketOnPlay);
    function socketOnPlay(play){
        // Fetch game code from database
        var query = {"name": play.gameName};
        self.dbf.findOne(self.gamesCollection, getCode, query);
        function getCode(err, gameData) {
            if (err) {
                self.handleError(err);
            } else {
                if(gameData === null){
                    try{
                        throw new Error("Game not found. Name correct?");
                    } catch(e){
                        self.handleError(e);
                    }
                } else {
                    // Join an existing game or create new game
                    var ids = self.joinOrCreateGame(play.gameName, play.player);
                    var gameId = ids.gameId;
                    var playerId = ids.playerId;
                    // Add gameData (code, author, etc.)
                    if (self.runningGames[gameId].gameData === undefined) {
                        self.runningGames[gameId].gameData = gameData;
                    }
                    // Add socket to sockets array and save IDs on the socket
                    socket.gameId = gameId;
                    socket.playerId = playerId;
                    self.runningGames[gameId].sockets.push(socket);
                    // Start the game if the minimum number of players is reached
                    var minPlayers = self.getParameterValue(gameData.gameCode, "minPlayers");
                    if (playerId + 1 >= minPlayers) {
                        var initObject = {
                            gameCode: gameData.gameCode,
                            players: self.getGameFromId(gameId).players
                        };
                        self.emitAll(gameId, "init", initObject);
                        self.runningGames[gameId].isOpen = false;
                    }
                    // Minimum number of players is not yet reached
                    else {
                        self.emitAll(gameId, "wait join", self.runningGames[gameId].game.players.length);
                    }
                    socket.emit("player id", playerId);
                }
            }
        }
    }
    
    // A client sends input values
    socket.on("input", inputFunction);
    function inputFunction(inputObject){
        self.setInput(socket.gameId, socket.playerId, inputObject);
    }
    
    // A client sends calculation results
    socket.on("result", resultFunction);
    function resultFunction(round) {
        var gameId = socket.gameId;
        socket.emit("set input");
        // Nice to have: Check if all results are identical in order to prevent cheating.
//        if (self.runningGames[gameId].currentRound < round.roundIndex) {
//            self.runningGames[gameId].calculatedCounter = 0;
//        }
//        self.runningGames[gameId].calculatedCounter++;
//        // Check if all players have submitted an input
//        if (self.runningGames[gameId].calculatedCounter === self.runningGames[gameId].game.players.length) {
//            self.emitAll(gameId, "set input");
//            
//        }
    }
    
    socket.on("finish", finishFunction);
    function finishFunction(game) {
        var g = self.runningGames[socket.gameId];
        if (g) {
            // Backsave players array since it has abort information
            game.players = g.game.players;
            // Save game data (game name, author, game code ...)
            game.gameData = g.gameData;
            // Save to database
            var targetCollection = self.db.collection(g.gameData.name);
            self.dbf.insert(targetCollection, game, saveCallback);
            // Delete game from running games table
            delete self.runningGames[socket.gameId];
        }
        function saveCallback(err, data) {
            if (err) {
                console.error(err);
            } else {
                console.log(new Date() + ": " + data.gameData.name + " saved successfully.");
            }
        }
    }
    
    socket.on("abort", abortFunction);
    function abortFunction() {
        self.handleAbort(socket.gameId, socket.playerId);
    }
};

// Join player to an existing game or create new game.
// Return player and game ID
GameControler.prototype.joinOrCreateGame = function(gameName, player){
    // join player to an existing, open game
    var gameId = this.findOpenGame(gameName);
    var playerId;
    if(gameId){
        playerId = this.addPlayer(gameId, player);
    } 
    // create a new game and add the player
    else {
        var game = BGE.gameFlow.initializeNewGame();
        gameId = uuid.v4();
        game.id = gameId;
        this.runningGames[gameId] = {};
        this.setGameToId(gameId, game);
        playerId = this.addPlayer(gameId, player);
        this.runningGames[gameId].isOpen = true;
        this.runningGames[gameId].sockets = [];
        this.runningGames[gameId].inputs = {};
        this.runningGames[gameId].currentRound = 0;
        this.runningGames[gameId].inputCounter = 0;
        this.runningGames[gameId].abortCounter = 0;
    }
    var result = {
        gameId: gameId,
        playerId: playerId
    };
    return result;
};

// Check if there are open games of the requested type
// Return gameID or undefined
GameControler.prototype.findOpenGame = function(gameName){
    var result = undefined;
    for (var id in this.runningGames){
        var gameData = this.runningGames[id].gameData;
        if(gameData.name === gameName && this.runningGames[id].isOpen){
            result = id;
            break;
        }
    }
    return result;
};

// Save incoming input and emit 'calcuate' if all players have submitted the input of a round
GameControler.prototype.setInput = function(gameId, playerId, inputObject){
    var inputsCopy = this.runningGames[gameId].inputs;
    var inputValue;
    if (this.runningGames[gameId].currentRound < inputObject.cr) {
        this.runningGames[gameId].currentRound ++;
        this.runningGames[gameId].inputCounter = 0;
    }
    // In case of player where already one round was played: The value of the
    // last round will be taken for the next rounds
    for (var inputName in inputObject.inputValues) {
        inputValue = inputObject.inputValues[inputName];
        inputsCopy[inputName] = inputsCopy[inputName] || [];
        inputsCopy[inputName][playerId] = inputValue;
    }  
    this.runningGames[gameId].inputs = inputsCopy;
    this.runningGames[gameId].inputCounter ++;
    
    var g = this.runningGames[gameId];
    // Check if all players have submitted an input, then emit "calculate"
    if (g.inputCounter === g.game.players.length - g.abortCounter) {
        this.emitAll(gameId, 'calculate', inputsCopy);
    }
};

GameControler.prototype.handleAbort = function(gameId, playerId){
    if (this.runningGames[gameId]) {
        var g = this.runningGames[gameId];
        if (!g.game.players[playerId].abort) {
            this.runningGames[gameId].abortCounter++;
            g = this.runningGames[gameId];
            // Mark for deletion
            if (g.abortCounter === g.game.players.length) {
                this.runningGames[gameId].delete = true;
            }
        }
        // Check if all others have submitted
        if (g.abortCounter + g.inputCounter === g.game.players.length 
                && !g.game.players[playerId].abort) {
            this.emitAll(gameId, "calculate", g.inputs);
        }
        // Mark player abort
        this.runningGames[gameId].game.players[playerId].abort = true;
    }
};

// Add player to the game in question
// Return the playerID
GameControler.prototype.addPlayer = function(gameId, player){
    var game = this.getGameFromId(gameId);
    var playerId;
    if (game) {
        var playerArrayLength = game.players.push(player);
        var playerId = playerArrayLength - 1;
        game.players[playerId].id = playerId;
        this.setGameToId(gameId, game);
    }
    return playerId;
};

// Get the value of a parameter from the game code.
// Since code is never executed on server-side, we search it using regex.
GameControler.prototype.getParameterValue = function(gameCode, parameterName){
    var regexString = parameterName + '",\\s*\\d+';
    var regex = new RegExp(regexString);
    var targetPattern = regex.exec(gameCode)[0];
    regex = new RegExp('\\d+');
    var parameterValue = regex.exec(targetPattern)[0];
    return parameterValue;
};

// Emit an event (with the same data) to all players
GameControler.prototype.emitAll = function(gameId, event, data) { 
    var sockets = this.runningGames[gameId].sockets;
    for(var i = 0; i < sockets.length; i++){
        sockets[i].emit(event, data);
    }
};

// Returns the game object or undefined
GameControler.prototype.getGameFromId = function(gameId){
    var result;
    if(this.runningGames[gameId]) {
        result = this.runningGames[gameId].game;
    }
    return result;
};

GameControler.prototype.setGameToId = function(gameId, game){
    var result = false;
    if(this.runningGames[gameId]) {
        this.runningGames[gameId].game = game;
        result = true;
    }
    return result;
};

GameControler.prototype.handleError = function(err, gameId) {
    // Todo: if instance of error
    console.error(err.message + " --- Stacktrace: " + err.stack);
    if(gameId) {
        this.emitAll(gameId, "error", err);
    }
};

// Export the constructor so that an object of GameControler can be build after import.
module.exports = GameControler;
