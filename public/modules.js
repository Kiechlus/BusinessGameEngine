/* 
 * Business Game Engine (BGE): Create, play and analyze online multiplayer
 * business games used for education.
 * Copyright (C) 2015 Felix Kiechle <felix.kiechle@student.kit.edu>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

/* global esprima */

"use strict";
/*
 This file contains the following modules:
 - routes
 - utils
 - userFunctions
 - validate
 - gameFlow
 - simulate
 Each of them has an own sub-namespace.
 */

// Toplevel namespace of Business Game Engine (BGE)
var BGE = BGE || {};

/*
 -------------------------------------------------------------------
 ----------------------Module: routes-------------------------------
 -------------------------------------------------------------------
 */
BGE.routes = {
    games: "/",
    show: "/show",
    create: "/create",
    delete: "/delete",
    edit: "/edit/",
    simulate: "/simulate/",
    play: "/play/",
    analyse: "/analyse/",
    gameList: "/gameList",
    pwCheck: "/pwCheck",
    getCode: "/getCode",
    code: "/code",
    docu: "/docu",
};

/*
 -------------------------------------------------------------------
 ----------------------Module: utils--------------------------------
 -------------------------------------------------------------------
 */
BGE.utils = BGE.utils || {};

(function (ns) {
    // send CSRF token from html meta tag in every jqery ajax request
    var CSRF_HEADER = 'X-CSRF-Token';
    ns.setCSRFToken = function (securityToken) {
        jQuery.ajaxPrefilter(function (options, _, xhr) {
            if (!xhr.crossDomain)
                xhr.setRequestHeader(CSRF_HEADER, securityToken);
        });
    };

    // get the value of a variable in the url
    ns.getQueryVariable = function (variable) {
        var query = window.location.search.substring(1);
        var vars = query.split("&");
        for (var i = 0; i < vars.length; i++) {
            var pair = vars[i].split("=");
            if (pair[0] == variable) {
                return pair[1];
            }
        }
        return(false);
    };

    ns.emulateEval = function (code, game) {
        var s = $("<script>");
        s.append("var game = " + game + ";");
        console.dir(game);
        s.append(code);
        $("body").append(s);
    };
    
    ns.isNumeric = function(n) {
        return !isNaN(parseFloat(n)) && isFinite(n);
    };

    var insertPositions;
    var newCode;

    /*
     01/10/2015 Not in use. Falls es verwendet wird, dürfte ' replace Funktion Probleme
     in Corinnas Oligopol Spiel auslösen, da hier " und ' gebraucht werden.
     After reading the code from the client editor, some adaptions must be made in order to convert it to a string which is is still syntactically correct:
     - Replace line breaks (\n und \r) and tabs (\t) with blanks since they break the syntax.
     - Replace line comments (//) with multiline comments (*//*) since a line comment in a string (without line breaks) would comment out everything after.
      - Add a semicolon after every variable and function declaration. With line breaks they are not necessary but without they are.
      */
    ns.stringify = function (gameCode) {
        var syntaxTree;
        newCode = gameCode;
        // add semicolons after each declaration
        insertPositions = [];
        syntaxTree = ns.parse(newCode);
        if (syntaxTree) {
            addSemicolon(syntaxTree.body);
        }
        // convert line to block comments
        insertPositions = [];
        syntaxTree = undefined;
        syntaxTree = ns.parse(newCode);
        if (syntaxTree) {
            convertComments(syntaxTree.comments);
        }
        // replace ;; with ;
        newCode = newCode.replace(/;;/gm, ";");
        newCode = newCode.replace(/(\r\n|\n|\r|\t)/gm, " ");
        // use always "..." for strings
        newCode = newCode.replace(/\'/gm, '"');
        // check if the adapted code is still syntactically correct    
        ns.parse(newCode);
        return String(newCode);
    };

    // Parses the code and return the syntax tree
    ns.parse = function (gameCode) {
        var options = {
            range: true,
            comment: true,
        };
        return esprima.parse(gameCode, options);
    };

    /*
     Add a semicolon after each function declaration and variable declaration and write it to the global newCode string.
     Recursive function, since this can be nested (variable/function inside a function ...).
     */
    function addSemicolon(bodyArray) {
        var bodyObject;
        var rangeArray;
        var endPosition;
        var offset;
        for (var i = 0; i < bodyArray.length; i++) {
            bodyObject = bodyArray[i];
            // Add a semicolon
            if (bodyObject.type === "VariableDeclaration" || bodyObject.type === "FunctionDeclaration"
                    || bodyObject.type === "ExpressionStatement") {
                rangeArray = bodyObject.range;
                endPosition = rangeArray[1];
                insertPositions.push(endPosition);
                // calculate an eventual offset
                offset = 0;
                for (var j = 0; j < insertPositions.length; j++) {
                    if (endPosition > insertPositions[j]) {
                        offset += 1;
                    }
                }
                newCode = add(newCode, ";", endPosition, offset);
            }
            var blockStatementBody = bodyObject.body;
            if (typeof blockStatementBody === "object" && blockStatementBody.type === "BlockStatement") {
                var bodyInside = blockStatementBody.body;
                // Recursive call in case of nested bodies
                if (typeof bodyInside === "object") {
                    addSemicolon(bodyInside);
                }
            }
        }
    }

    // convert line comments (//blabla) to multiline comments (/*//blabla*/ and write to the global string newCode
    function convertComments(commentsArray) {
        var commentObject;
        var rangeArray;
        var startPosition;
        var endPosition;
        var offsetStart;
        var offsetEnd;
        for (var i = 0; i < commentsArray.length; i++) {
            commentObject = commentsArray[i];
            if (commentObject.type === "Line") {
                rangeArray = commentObject.range;
                startPosition = rangeArray[0];
                endPosition = rangeArray[1];
                insertPositions.push(startPosition);
                insertPositions.push(endPosition);
                offsetStart = 0;
                offsetEnd = 0;
                for (var j = 0; j < insertPositions.length; j++) {
                    if (startPosition > insertPositions[j]) {
                        offsetStart += 2;
                    }
                    if (endPosition > insertPositions[j]) {
                        offsetEnd += 2;
                    }
                }
                newCode = add(newCode, "/*", startPosition, offsetStart);
                newCode = add(newCode, "*/", endPosition, offsetEnd);
            }
        }
    }

    // Add stringToAdd into stringToChange at position with an optional positive offset
    function add(stringToChange, stringToAdd, position, offset) {
        if (typeof position === "number" && position >= 0
                && typeof stringToChange === "string" && typeof stringToAdd === "string") {
            var result = "ERROR";
            if (offset !== undefined) {
                if (typeof offset === "number" && offset >= 0) {
                    position = position + offset;
                } else {
                    throw new Error("offset of wrong type");
                }
            }
            var leftSide = stringToChange.substring(0, position);
            var rightSide = stringToChange.substring(position);
            result = leftSide + stringToAdd + rightSide;
            return result;
        } else {
            throw new Error("invalid add call, arguments missing or of wrong type");
        }
    }
})(BGE.utils);

/*
 -------------------------------------------------------------------
 ----------------------Module: userFunctions------------------------
 -------------------------------------------------------------------
 This module contains all the functions the user has access to via
 the game object. They are wrapped in a register function. If a new
 game is created this function is called with the game as parameter
 in order to register the user functions on the game object.
 -------------------------------------------------------------------
 ----------------------Module: userFunctions------------------------
 -------------------------------------------------------------------
 */
BGE.userFunctions = BGE.userFunctions || {};

(function (ns) {
    // The register function
    ns.register = function (game) {
        game.addParameter = addParameter.bind(game);
        game.getParameter = getParameter.bind(game);
        game.addInputVariable = addInputVariable.bind(game);
        game.addPlayerVariable = addPlayerVariable.bind(game);
        game.addRoundVariable = addRoundVariable.bind(game);
        game.get = get.bind(game);
        game.addScore = addScore.bind(game);
        game.addCollectiveScore = addCollectiveScore.bind(game);
        game.addQuestionnaire = addQuestionnaire.bind(game);
        game.getCurrentRound = getCurrentRound.bind(game);
        game.getNumberOfPlayers = getNumberOfPlayers.bind(game);
        game.utils = {
            getWeekNumber: getWeekNumber,
        };
        game.math = {
            random: random,
            randomInt: randomInt,
            proportionalDistribution: proportionalDistribution.bind(game),
            inverseDistribution: inverseDistribution.bind(game),
        };
    };

    ns.validUserFunctions = function (game) {
        var obj;
        var accessPermitted = ["math", "utils"];
        for (var objName in game) {
            obj = game[objName];
            if (typeof obj === "function") {
                accessPermitted.push(objName);
            }
        }
        return accessPermitted;
    }

    /* GAME FUNCTIONS */
    function addParameter(parameterName, parameterValue, validation) {
        if (typeof parameterName === "string" && (typeof parameterValue === "number" || typeof parameterValue === "string")) {
            var paramObject = {
                value: parameterValue,
                validation: validation
            };
            this.parameters[parameterName] = paramObject;
        } else {
            throw new Error("Invalid addParameter() call. Arguments missing or of wrong type.");
        }
    }
    function getParameter(parameterName) {
        if (typeof parameterName === "string") {
            var result = this.parameters[parameterName].value;
            if (result === undefined) {
                throw new Error("Parameter " + parameterName + " could not be found.");
            } else {
                return result;
            }
        } else {
            throw new Error("Invalid parameter name.");
        }
    }
    function addInputVariable(variableObject, chartObject) {
        if (checkType("object", variableObject)) {
            variableObject.scope = "perPlayer";
            if (chartObject) {
                if (checkType("object", chartObject)) {
                    variableObject.chart = chartObject;
                }
            }
            this.inputVariables.push(variableObject);
        }
    }
    function addPlayerVariable(variableObject, chartObject) {
        if (checkType("object", variableObject)) {
            variableObject.scope = "perPlayer";
            if (chartObject) {
                if (checkType("object", chartObject)) {
                    variableObject.chart = chartObject;
                }
            }
            this.variables.push(variableObject);
        }
    }
    function addRoundVariable(variableObject, chartObject) {
        if (checkType("object", variableObject)) {
            variableObject.scope = "perRound";
            if (chartObject) {
                if (checkType("object", chartObject)) {
                    variableObject.chart = chartObject;
                }
            }
            this.variables.push(variableObject);
        }
    }
    // Return the value of a variable of any kind. 
    function get(variableName, roundIndex, playerIndex) {
        if (typeof variableName === "string" && typeof roundIndex === "number") {
            var result = Number.MIN_VALUE;
            if (roundIndex < -1) {
                roundIndex = -1;
            }
            var value = this.rounds[roundIndex][variableName];
            // player-specific variable
            if (typeof value === "object") {
                result = value[playerIndex];
            }
            // round-specific variable, playerIndex is not needed and ignored if specified.
            else {
                result = value;
            }
            return result;
        } else {
            throw new Error("Parameters 'variableName' or 'roundIndex' missing or of wrong type");
        }
    }
    function addScore(functionObject, chartObject) {
        if (checkType("function", functionObject)) {
            // add the score function to the game object
            this.scoreFunction = functionObject;
            if (chartObject) {
                if (checkType("object", chartObject)) {
                    // Generate a variable object for the score, with the chart, add it to the variables collection
                    var scoreObject = {};
                    scoreObject.name = "accumulatedScore";
                    scoreObject.scope = "perPlayer";
                    scoreObject.isScore = true;
                    scoreObject.chart = chartObject;
                    this.variables.push(scoreObject);
                }
            }
        }
    }
    function addCollectiveScore(functionObject, chartObject) {
        if (checkType("function", functionObject)) {
            // add the collective score function to the game object
            this.collectiveScoreFunction = functionObject;
            if (chartObject) {
                if (checkType("object", chartObject)) {
                    // Generate a variable object for the score, with the chart, add it to the variables collection
                    var collectiveScoreObject = {};
                    collectiveScoreObject.name = "accumulatedCollectiveScore";
                    collectiveScoreObject.scope = "perRound";
                    collectiveScoreObject.isScore = true;
                    collectiveScoreObject.chart = chartObject;
                    this.variables.push(collectiveScoreObject);
                }
            }
        }
    }
    function addQuestionnaire(questionnaireName, questionnaireObject, positionArray) {
        if (typeof questionnaireName === "string" && typeof questionnaireObject === "object" && typeof positionArray === "object") {
            this.questionnaires[questionnaireName] = {};
            this.questionnaires[questionnaireName].positions = positionArray;
            this.questionnaires[questionnaireName].questions = questionnaireObject;
        } else {
            throw new Error("Invalid addQuestionnaire() call. Arguments missing or of wrong type.");
        }
    }
    function getCurrentRound() {
        return this.cr;
    }
    function getNumberOfPlayers() {
        return this.players.length;
    }

    /* (User)UTIL FUNCTIONS */
    function getWeekNumber(d) {
        if (d) {
            // Copy date so don't modify original
            d = new Date(+d);
        } else {
            d = new Date();
        }
        d.setHours(0, 0, 0);
        // Set to nearest Thursday: current date + 4 - current day number
        // Make Sunday's day number 7
        d.setDate(d.getDate() + 4 - (d.getDay() || 7));
        // Get first day of year
        var yearStart = new Date(d.getFullYear(), 0, 1);
        // Calculate full weeks to nearest Thursday
        var weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7)
        // Return array of year and week number
        //return [d.getFullYear(), weekNo];
        return weekNo;
    }

    /* MATH FUNCTIONS */
    function random(min, max) {
        return Math.random() * (max - min) + min;
    }
    function randomInt(min, max) {
        var result = -1;
        result = Math.floor(Math.random() * (max - min + 1) + min);
        return result;
    }
    /*
     - distributionValue: number (e.g. 1) or round-specific variable name (e.g. demand).
     - distributeByVariableName: name of a player-specific variable (e.g. price) by which the distributionValue will be proportionally distributed.
     - optionalRoundIndex: Optional parameter. An array with maximal two entries. optionalRoundIndex[0] will be used for the distributionValue, if it refers a variable. optionalRoundIndex[1] will be used for the distributeByVariable. If one or both values are not specified, the current round will be used.
     */
    function proportionalDistribution(playerIndex, distributionValue, distributeByVariableName, optionalRoundIndex) {
        var game = this;
        if (checkType("object", game) && checkType("number", playerIndex) && notUndefined(distributionValue) && notUndefined(distributeByVariableName)) {
            var result = Number.MIN_VALUE;
            var roundIndex = getRoundIndex(game, optionalRoundIndex, 1);
            // calculte the sum of the distributeByVariable over all players        
            var distributeByArray = this.rounds[roundIndex][distributeByVariableName];
            if (checkType("object", distributeByArray)) {
                var distributeBySum = 0;
                var distributeByPlayerValue;
                var checksum = 0;
                for (var i = 0; i < this.players.length; i++) {
                    var value = distributeByArray[i];
                    if (checkType("number", value)) {
                        distributeBySum += value;
                        checksum += Math.abs(value);
                        if (i === playerIndex) {
                            distributeByPlayerValue = value;
                        }
                    }
                }
                // distributeByPlayerValues must be eihter all positive or negative
                if (checksum !== Math.abs(distributeBySum)) {
                    throw new Error("distributeByPlayerValues must be eihter all positive or negative");
                }
            }
            // calculate the distribution value if it is a variable name
            var disVal = getDistributionValue(game, distributionValue, optionalRoundIndex);
            // calculate the distribution for the player
            if (disVal && distributeBySum && notUndefined(distributeByPlayerValue)) {
                result = (disVal / distributeBySum) * distributeByPlayerValue;
            } else {
                throw new Error("Value for calculation missing or disVal = 0 or distributeBySum = 0");
            }
        }
        else {
            throw new Error("Invalid proportionalDistribution() call. Arguments missing.");
        }
        return result;
    }

    function inverseDistribution(playerIndex, distributionValue, distributeBy, optionalRoundIndex) {
        var game = this;
        var result = Number.MIN_VALUE;
        var inverseSum = 0;
        var propDistr = 0;
        // calculation only needs to be done once: Save in game.temporary
        if (playerIndex === 0) {
            game.temporary.propDistrInvers = [];
            for (var i = 0; i < game.getNumberOfPlayers(); i++) {
                propDistr = game.math.proportionalDistribution(i, distributionValue, distributeBy, optionalRoundIndex);
                if (propDistr !== 0) {
                    game.temporary.propDistrInvers[i] = Math.pow(propDistr, -1);
                }
                else if (propDistr === 0) {
                    game.temporary.propDistrInvers[i] = 0;
                }
            }
            for (var j = 0; j < game.temporary.propDistrInvers.length; j++) {
                inverseSum += game.temporary.propDistrInvers[j];
            }
            game.temporary.inverseSum = inverseSum;
        }
        var disVal = getDistributionValue(game, distributionValue, optionalRoundIndex);
        if (game.temporary.inverseSum !== 0) {
            result = game.temporary.propDistrInvers[playerIndex] * disVal / game.temporary.inverseSum;
        } else {
            throw new Error("Inverse Sum cannot be zero.");
        }
        return result;
    }

    // used above, no user functions
    function checkType(type, object) {
        if (typeof object === type) {
            return true;
        } else {
            throw new Error("Invalid type. Must be of type: " + type);
        }
    }

    function notUndefined(object) {
        if (object !== undefined) {
            return true;
        } else {
            throw new Error("Invalid type. Cannot be undefined.");
        }
    }

    function getDistributionValue(game, distributionValue, optionalRoundIndex) {
        var result = 0;
        var roundIndex = getRoundIndex(game, optionalRoundIndex, 0);
        if (typeof distributionValue === "number" && distributionValue !== 0) {
            result = distributionValue;
        }
        else if (typeof distributionValue === "string") {
            var value = game.rounds[roundIndex][distributionValue];
            if (checkType("number", value)) {
                result = value;
            }
        } else {
            throw new Error("distributionValue must be a number unequal to zero or a string value (name of a variable)");
        }
        return result;
    }

    function getRoundIndex(game, optionalRoundIndex, index) {
        var result = -2;
        if (typeof optionalRoundIndex === "object") {
            if (optionalRoundIndex[index] !== undefined) {
                result = optionalRoundIndex[index];
            } else {
                result = game.getCurrentRound();
            }
        } else {
            result = game.getCurrentRound();
        }
        return result;
    }

})(BGE.userFunctions);



/*
 -------------------------------------------------------------------
 ----------------------Module: validate-----------------------------
 -------------------------------------------------------------------
 
 Contains methods to check the game semantics and to match 
 variables/parameters against their validation expressions.
 
 -------------------------------------------------------------------
 ----------------------Module: validate-----------------------------
 -------------------------------------------------------------------
 */
BGE.validate = BGE.validate || {};

(function (ns) {

    var errors;
    var warnings;

    // Returns errors or warnings found during semantic check of the game
    ns.gameSemantics = function (gameCode) {
        errors = [];
        warnings = [];
        var controler = BGE.gameFlow;
        var game = controler.initializeNewGame();
        var permittedArray = BGE.userFunctions.validUserFunctions(game);
        checkGameAccess(gameCode, permittedArray);
        if (errors.length === 0) {
            eval(gameCode);
            checkParameters(game);
            checkNames(game);
            checkInput(game);
            checkVariables(game);
            checkScore(game);
            checkQuestionnaires(game);
        }
        var result = {
            errors: errors.toString(),
            warnings: warnings.toString()
        };
        return result;

    };
    // The user can only access a predefined set of user functions on the game object
    function checkGameAccess(gameCode, permittedArray) {
        // In comments we must omit the search
        var commentRanges = getCommentRange(gameCode);
        var regNonPoint = new RegExp("^game(?!\\.)|\\W{1}game(\\s*=|\\s*\\[|\\s*\\()");
        testAgainstRegex(regNonPoint, gameCode, commentRanges);
        var regexLeftPart = "^game(?!\\.";
        var regexRightPart = ")|(\\W{1}game(\\s*\\.))(?!";
        for (var i = 0; i < permittedArray.length; i++) {
            if (i < permittedArray.length - 1) {
                regexLeftPart += permittedArray[i] + "|\\.";
                regexRightPart += permittedArray[i] + "|";
            } else {
                regexLeftPart += permittedArray[i];
                regexRightPart += permittedArray[i];
            }
        }
        var regexString = regexLeftPart + regexRightPart + ")";
        var regex = new RegExp(regexString);
        testAgainstRegex(regex, gameCode, commentRanges);
    }
    
    function testAgainstRegex(regexObject, gameCode, commentRanges) {
        var position = 0;
        var realPosition = 0;
        var offset = 0;
        var shiftBy = 5;
        var codeCopy = gameCode;
        var errorMessageRightPart = " You can only access the predefined user-functions on the game object like for example game.addParameter(..), game.get(..) etc.";
        while (position !== -1) {
            position = codeCopy.search(regexObject);
            realPosition = position + offset;
            if (position !== -1 && !inComment(commentRanges, realPosition)) {
                errors.push("Invalid access on the game object at index " + realPosition + " (" +
                        gameCode.substring(realPosition, realPosition + 30) + "...)." + errorMessageRightPart);
            }
            offset = offset + position + shiftBy;
            codeCopy = codeCopy.substr(position + shiftBy);
            position = codeCopy.search(regexObject);
        }
        console.log(regexObject);
    }
    // Parse the game code and return the ranges of all comments
    function getCommentRange(gameCode) {
        var ranges = [];
        try {
            var comments = BGE.utils.parse(gameCode).comments;
            var commentObject;
            for (var i = 0; i < comments.length; i++) {
                commentObject = comments[i];
                ranges.push(commentObject.range);
            }
        } catch (e) {
            errors.push(e.stack);
        }
        return ranges;
    }
    // Check if a potential illegal game access is within a comment
    function inComment(commentRangesArray, position) {
        var result = false;
        for (var i = 0; i < commentRangesArray.length; i++) {
            if (position >= commentRangesArray[i][0] && position <= commentRangesArray[i][1]) {
                result = true;
                break;
            }
        }
        return result;
    }
    // Match parameters against their validation expression, if specified
    // Check if default parameters are set
    function checkParameters(game) {
        var paramObject;
        for (var paramName in game.parameters) {
            paramObject = game.parameters[paramName];
            // if validation fails, this will throw an error
            ns.validationExpression(paramObject.value, paramObject.validation, paramName);
        }
        if (!game.parameters.maxRounds) {
            errors.push("maxRounds parameter is not specified. Every game must define this parameter.");
        }
        if (!game.parameters.minPlayers) {
            errors.push("minPlayers parameter is not specified. Every game must define this parameter.");
        }
        if (!game.parameters.maxPlayers) {
            errors.push("maxPlayers parameter is not specified. Every game must define this parameter.");
        }
        if (!game.parameters.roundTimeOut) {
            errors.push("roundTimeOut parameter is not specified. Every game must define this parameter.");
        }
    }
    /*
     Each variable must have a name, no matter if input, player- or round specific. Names of variables must be   unique. 
     They cannot have the name: (collective)roundScore or accumulated(Collective)Score
     */
    function checkNames(game) {
        var names = [];
        var forbiddenNames = ["roundScore", "accumulatedScore", "collectiveRoundScore", "accumulatedCollectiveScore"];
        for (var variableName in game.inputVariables) {
            if (!game.inputVariables[variableName].isScore) {
                names.push(game.inputVariables[variableName].name);
            }
        }
        for (var variableName in game.variables) {
            if (!game.variables[variableName].isScore) {
                names.push(game.variables[variableName].name);
            }
        }
        names.sort();
        for (var i = 0; i < names.length; i++) {
            if (names[i] === undefined || names[i] === "" || typeof names[i] !== "string") {
                errors.push("Variable without name detected. All variable types must have a name and thus define a name attribute.");
            }
            // compare with the next to check uniqueness, if not the last 
            else if (i < names.length - 1) {
                if (names[i] === names[i + 1]) {
                    errors.push("variable " + names[i] + " is not unique. All variable names must be unique");
                }
            }
            for (var j = 0; j < forbiddenNames.length; j++) {
                if (names[i] === forbiddenNames[j]) {
                    errors.push("It is not allowed to use the protected names roundScore, accumulatedScore, collectiveRoundScore or accumulatedCollectiveScore as variable name.");
                }
            }
        }
    }
    /*
     Each game must define at least one input. Input must bei either a textfield, checkbox or scrolldown
     */
    function checkInput(game) {
        if (game.inputVariables.length === 0) {
            errors.push("A game must define at least one input variable");
        }
        var inputObject;
        for (var i = 0; i < game.inputVariables.length; i++) {
            inputObject = game.inputVariables[i];
            var textField = inputObject.textField ? 1 : 0;
            var scrollDown = inputObject.scrollDown ? 1 : 0;
            var checkBox = inputObject.checkBox ? 1 : 0;
            var sum = textField + scrollDown + checkBox;
            // must define exactly one of three
            if (sum < 1) {
                errors.push("An input variable must define a textField, scrollDown or checkBox attribute");
            }
            else if (sum > 1) {
                errors.push("An input variable must either have a textField, scrollDown or checkBox attribute, but not several of them");
            }
            // textfield
            if (textField === 1) {
                // textfield braucht type (in string, number) und default, default muss richtiger type
                var tf = inputObject.textField;
                if (tf.type) {
                    if (tf.type === "string" || tf.type === "number")
                        ;
                    else {
                        errors.push("Input variable '" + inputObject.name + "': A textField can be of type 'string' or 'number'");
                    }
                } else {
                    errors.push("Input variable '" + inputObject.name + "': textField must define a type (string or number).");
                }
                if (tf.default) {
                    if (tf.type && typeof tf.default !== tf.type) {
                        errors.push("Input variable '" + inputObject.name + "': default value in textField does not match type");
                    }
                } else {
                    errors.push("Input variable '" + inputObject.name + "': textField must define the default attribute");
                }
                // generelle methode: objekt darf maximal + array, andere attribute falsch? benötigt?
            }
            // scrolldown
            else if (scrollDown === 1) {
                scrollCheck(inputObject.scrollDown, inputObject.name);
            }
            // checkbox
            else if (checkBox === 1) {
                scrollCheck(inputObject.checkBox, inputObject.name);
            }
            // Warning if calculation function is not defined
            if (inputObject.calculationFunction) {
                if (typeof inputObject.calculationFunction !== "function") {
                    errors.push("Input variable '" + inputObject.name + "': calculationFunction must be a function.");
                }
            } else {
                warnings.push("Input variable '" + inputObject.name + "': No calculation function specified. Game cannot be used in simulation or with computer players");
            }
        }
    }
    // scrollbox and checkfield must define values and a default value, which must match one of the values
    function scrollCheck(inputType, inputName) {
        var values = inputType.values || [];
        console.log(!(Array.isArray(values)));
        if (!(Array.isArray(values)) || values.length < 1) {
            errors.push("Input variable '" + inputName + "': Scrollbox or checkbox must define the values attribute, which is of type array.");
        }
        if (inputType.default) {
            var match = false;
            if (values.length > 0) {
                for (var i = 0; i < values.length; i++) {
                    if (values[i] === inputType.default) {
                        match = true;
                    }
                }
                if (match === false) {
                    errors.push("Input variable '" + inputName + "': default must match a value");
                }
            }
        } else {
            errors.push("Input variable '" + inputName + "': Every input must define the default attribute.");
        }
    }

    // Every output variable must define a calculation function. It is safer if they define
    // initialValues and validation as well.
    function checkVariables(game) {
        var variableObject;
        for (var i = 0; i < game.variables.length; i++) {
            variableObject = game.variables[i];
            if (!variableObject.isScore) {
                if (typeof variableObject.calculationFunction !== "function") {
                    errors.push("Variable '" + variableObject.name + "': No calculationFunction specified or of wrong type (must be a function).");
                }
                if (!variableObject.isScore) {
                    if (variableObject.initialValue === undefined) {
                        warnings.push("Variable '" + variableObject.name + "': No initialValue specified. Any access to a negative round number will cause an error.");
                    }
                    if (!variableObject.validation) {
                        warnings.push("Variable '" + variableObject.name + "': No validation expression specified. Validation expressions help finding errors in calculation functions.");
                    }
                }
            }
        }
    }
    function checkScore(game) {
        if (typeof game.scoreFunction !== "function") {
            warnings.push("Score function undefined. A game needs a score function in order to determinate the winner. Add it with game.addScore(functionName);");
        }
    }
    
    /*
     * Questionnaires must have:
     * - a unique name
     * - positions array with numerical entries
     * - questions array:
     *      - anser: "string", "number" or array
     *      - questionName: string
     *      - questionText: string
     * 
     */
    function checkQuestionnaires(game) {
        var names = [];
        var positions;
        var questions;
        for (var questionnaireName in game.questionnaires) {
            names.push(questionnaireName);
            // Positions array must exist and have only numiercal entries
            if (game.questionnaires[questionnaireName].positions) {
                positions = game.questionnaires[questionnaireName].positions;
                if (typeof positions === "object") {
                    // Go through all postions
                    if (positions.length) {
                        for (var p = 0; p < positions.length; p++) {
                            if (typeof positions[p] !== "number") {
                                errors.push("Questionnaire " + questionnaireName + ": " + "A position can only be a numerical value. ");
                                break;
                            }
                        }
                    } else {
                        errors.push("Questionnaire " + questionnaireName + ": " + "At least one position must be defined");
                    }
                } else {
                    errors.push("Questionnaire "+questionnaireName+": "+"The positions parameter must be an array. ");
                }
            } else {
                errors.push("Questionnaire "+questionnaireName+": "+"Every questionnaire must define the positions array. ");
            }
            // A questionnaire must define a questions array
            if (game.questionnaires[questionnaireName].questions) {
                questions = game.questionnaires[questionnaireName].questions;
                if (typeof questions === "object") {
                    // A questionnaire must define at least one question
                    if (questions.length) {
                        // Go through all questions
                        var answer;
                        var questionName;
                        var questionText;
                        for (var q = 0; q < questions.length; q++) {
                            answer = questions[q].answer;
                            // Answer attribute must be "string", "number" or array
                            if (answer === "string" || answer === "number" || 
                                    typeof answer === "object") {
                                if (typeof answer === "object") {
                                    if (!answer.length) {
                                        errors.push("Questionnaire "+questionnaireName+": "+"A predefined answer must give at least one option:");
                                    }
                                }
                            }
                            else {
                                errors.push("Questionnaire "+questionnaireName+": "+'answer must be "string", "number" or an array');
                            }
                            // The attribute questionName must be a string
                            questionName = questions[q].questionName;
                            if (typeof questionName !== "string") {
                                errors.push("Questionnaire "+questionnaireName+": "+"The questionName must be of type String. ");
                            }
                            // The attribute questionText must be a string
                            questionText = questions[q].questionText;
                            if (typeof questionText !== "string") {
                                errors.push("Questionnaire "+questionnaireName+": "+"The questionText must be of type String. ");
                            }
                        }
                    }
                    else {
                        errors.push("Questionnaire "+questionnaireName+": "+
                                "A questionnaire must define at least one question. The questionnare object must be an array.");
                    }
                } else {
                    errors.push("Questionnaire "+questionnaireName+": "+"The questions parameter must be an array. ");
                }
            } else {
                errors.push("Questionnaire "+questionnaireName+": "+"A questionnaire must define the questions array. ");
            }
        // end for
        }
        names.sort();
        for (var n = 0; n < names.length; n++) {
            if (names[n] === names[n + 1]) {
                errors.push("Questionnaire "+questionnaireName+": "+ "is not unique. All questionnaire names must be unique");
            }
        }
    }

    /*
     Returns true if the value matches the expression(s) in the
     validation object.
     Throws an error if it does not.
     TODO: Auch den type an dieser Stelle checken?
     */
    ns.validationExpression = function (value, validationObject, variableName) {
        var result;
        var validationString = "";
        if (validationObject === undefined) {
            result = true;
        }
        else if (typeof validationObject === "string") { // @deprecated
            result = eval(String(value) + validationObject);
        }
        else if (typeof validationObject === "object") {
            result = true;
            for (var i = 0; i < validationObject.length; i++) {
                validationString = validationObject[i];
                if (!BGE.utils.isNumeric(value)) {
                    value = "'" + value + "'";
                }
                if (eval(value + validationString) === false) {
                    result = false;
                    break;
                }
            }
        } else {
            throw new Error("Invalid validation object.  ");
        }
        if (result === true) {
            return result;
        } else {
            throw new Error(variableName + " = " + value + " is invalid. It must match the following expression(s): " + validationObject + ".  ");
        }
    }


})(BGE.validate);

/*
 -------------------------------------------------------------------
 ----------------------Module: gameFlow-----------------------------
 -------------------------------------------------------------------
 
 -------------------------------------------------------------------
 ----------------------Module: gameFlow-----------------------------
 -------------------------------------------------------------------
 */

BGE.gameFlow = BGE.gameFlow || {};

BGE.gameFlow.initializeNewGame = function () {
    var game = {};
    game.parameters = {};
    game.inputVariables = [];
    game.variables = [];
    game.players = [];
    game.rounds = [];
    game.rounds[0] = {};
    game.questionnaires = {};
    game.questionnaireResults = [];
    // for saving temporary data
    game.temporary = {};
    game.temporary.isOpen = true;
    game.temporary.noSave = true;
    game.cr = 0;
    game.rounds[0].roundIndex = 0;
    game.rounds[0].roundNumber = 1;
    game.rounds[0].timeStamp = Date();
    BGE.userFunctions.register(game);
    return game;
};

BGE.gameFlow.advanceRound = function (game) {
    var newRound = game.cr + 1;
    game.cr = newRound;
    // initialize input variables arrays if it is not the last round
    if (game.getParameter("maxRounds") > newRound) {
        game.rounds[newRound] = {};
        // Write the round number to the rounds object (beginning at 0)
        game.rounds[newRound].roundIndex = newRound;
        game.rounds[newRound].roundNumber = newRound + 1;
        game.rounds[newRound].timeStamp = Date();
        for (var i = 0; i < game.inputVariables.length; i++) {
            game.rounds[newRound][game.inputVariables[i].name] = [];
        }
    }
};

/* 
 Set the initial values of the variables, if specified in the game description. This defines the state of the game before the 
 first round (state zero). Since technically the first round has the index 0 of the round array, 
 the initial values are set at index -1 (games.round[-1]). In many games it makes sense to use relative round
 references, like e.g. (currentRound - 4). In order to avoid array out of bounds exceptions the "state zero" object
 at index -1 is also referenced from index -2, -3 and so on. (in game.get Function).
 Theoretically, input variables do not need an initial value. For some game implementations like the beergame
 it is nevertheless needed and therefore supported as well. 
 */
BGE.gameFlow.setInitialValues = function (game) {
    game.rounds[-1] = {};
    var variableName;
    var variableObject;
    // Initial values for inputVariables (normally not needed)
    for (var j = 0; j < game.inputVariables.length; j++) {
        variableName = game.inputVariables[j].name;
        variableObject = game.inputVariables[j];
        if (typeof variableObject.calculationFunction === "function") {
            variableObject.calculationFunction.bind(game);
        }
        BGE.gameFlow.initialize(game, variableName, variableObject);
    }
    // Initial values for variables
    for (var j = 0; j < game.variables.length; j++) {
        variableName = game.variables[j].name;
        variableObject = game.variables[j];
        if (!variableObject.isScore) {
            variableObject.calculationFunction.bind(game);
            BGE.gameFlow.initialize(game, variableName, variableObject);
        }
    }
    BGE.gameFlow.initializeScore(game);
};

BGE.gameFlow.initialize = function (game, variableName, variableObject) {
    var initialValue;
    if (variableObject.initialValue !== undefined) {
        // round specific variables
        if (variableObject.scope === "perRound") {
            if (typeof variableObject.initialValue === "number" || typeof variableObject.initialValue === "string") {
                initialValue = variableObject.initialValue;
                if (BGE.validate.validationExpression(initialValue, variableObject.validation, variableName)) {
                    game.rounds[-1][variableName] = variableObject.initialValue;
                }
            }
        }
        // player specific variables
        else if (variableObject.scope === "perPlayer") {
            game.rounds[-1][variableName] = [];
            // initialValue is an array (player dependant)
            if (typeof variableObject.initialValue === "object") {
                if (variableObject.initialValue.length === game.players.length) {
                    game.rounds[-1][variableName] = [];
                    for (var i = 0; i < game.players.length; i++) {
                        initialValue = variableObject.initialValue[i];
                        if (BGE.validate.validationExpression(initialValue, variableObject.validation, variableName)) {
                            game.rounds[-1][variableName][i] = initialValue;
                        }
                    }
                }
                // Todo: Evtl. mit stabiler Routine ersetzen. Alle nicht definierten Spieler kriegen einfach den letzten init Wert
                else {
                    throw new Error("Number of initial values does not match number of players.");
                }
            }
            // initialValue is the same for all players (player independant)
            else if (typeof variableObject.initialValue === "number" || typeof variableObject.initialValue === "string") {
                game.rounds[-1][variableName] = [];
                initialValue = variableObject.initialValue;
                for (var i = 0; i < game.players.length; i++) {
                    if (BGE.validate.validationExpression(initialValue, variableObject.validation, variableName)) {
                        game.rounds[-1][variableName][i] = initialValue;
                    }
                }
            }
        }
    }
};

// Set initial value of score to 0 if scoreFunction is defined
BGE.gameFlow.initializeScore = function (game) {
    game.rounds[-1].accumulatedScore = [];
    game.rounds[-1].roundScore = [];
    for (var i = 0; i < game.players.length; i++) {
        game.rounds[-1].accumulatedScore[i] = 0;
        game.rounds[-1].roundScore[i] = 0;
    }
    game.rounds[-1].accumulatedCollectiveScore = 0;
};

BGE.gameFlow.calculateInputs = function (game) {
    var calculationResult;
    var variableName;
    var variableObject;
    var cr = game.getCurrentRound();
    for (var j = 0; j < game.inputVariables.length; j++) {
        variableName = game.inputVariables[j].name;
        variableObject = game.inputVariables[j];
        game.rounds[cr][variableName] = [];
        // go through all players call their inputVariable calculation function and write the result to the rounds object
        for (var k = 0; k < game.players.length; k++) {
            calculationResult = variableObject.calculationFunction(k);
            //if (controler.validate(calculationResult, variableObject.validation, variableName)) { 
            //TODO: validateInput Methode. Wenn textfield, dann validate, sonst check if in values
            game.rounds[cr][variableName][k] = calculationResult;
            //}
        }
    }
};

// Calculate and validate the (output) variables. Write them to the game.rounds[currentRound] object if they are valid.
BGE.gameFlow.calculateRoundResult = function (game) {
    var calculationResult;
    var variableName;
    var variableObject;
    var cr = game.getCurrentRound();
    // Go through all variables in the order of their declaration in the game description
    for (var j = 0; j < game.variables.length; j++) {
        variableName = game.variables[j].name;
        variableObject = game.variables[j];
        if (!variableObject.isScore) {
            if (variableObject.scope === "perRound") {
                // Calculate the variable calling the calculation function (as specified in the game description)
                calculationResult = variableObject.calculationFunction();
                if (BGE.validate.validationExpression(calculationResult, variableObject.validation, variableName)) {
                    game.rounds[cr][variableName] = calculationResult;
                }
            } else if (variableObject.scope === "perPlayer") {
                game.rounds[cr][variableName] = [];
                for (var i = 0; i < game.players.length; i++) {
                    calculationResult = variableObject.calculationFunction(i);
                    if (BGE.validate.validationExpression(calculationResult, variableObject.validation, variableName)) {
                        game.rounds[cr][variableName][i] = calculationResult;
                    }
                }
            }
        }
    }
    BGE.gameFlow.calculateScore(game);
};

/*
 Calls the calculateScore() and calculateCollectiveScore() function, if specified in the game description.
 Writes the accumulated score and the score of this round for the individual as 
 well as for the collective score to the round object.
 */
BGE.gameFlow.calculateScore = function (game) {
    var cr = game.getCurrentRound();
    if (game.scoreFunction) {
        game.rounds[cr].accumulatedScore = [];
        game.rounds[cr].roundScore = [];
        var calculationResult = Number.MIN_VALUE;
        for (var i = 0; i < game.players.length; i++) {
            calculationResult = game.scoreFunction(i);
            // score must be number
            if (typeof calculationResult === "number") {
                // Accumulate the score
                var scoreLastRound = game.rounds[cr - 1].accumulatedScore[i];
                var newScore = scoreLastRound + calculationResult;
                game.rounds[cr].accumulatedScore[i] = newScore;
                // Write also score value of this round
                game.rounds[cr].roundScore[i] = calculationResult;
            }
            else {
                throw new Error("Result of scoreFunction must be a number.");
            }
        }
    }
    if (game.collectiveScoreFunction) {
        var calculationResult = Number.MIN_VALUE;
        calculationResult = game.collectiveScoreFunction();
        // score must be number
        if (typeof calculationResult === "number") {
            // Accumulate the score
            var scoreLastRound = game.rounds[cr - 1].accumulatedCollectiveScore;
            var newScore = scoreLastRound + calculationResult;
            game.rounds[cr].accumulatedCollectiveScore = newScore;
            // Write also score value of this round
            game.rounds[cr].collectiveRoundScore = calculationResult;
        }
        else {
            throw new Error("Result of scoreFunction must be a number.");
        }
    }
};


/*
 -------------------------------------------------------------------
 ----------------------Module: simulate-----------------------------
 -------------------------------------------------------------------
 
 -------------------------------------------------------------------
 ----------------------Module: simulate-----------------------------
 -------------------------------------------------------------------
 */

// returns an error or the round object
BGE.simulate = function (gameCode) {
    var result;
    try {
        var controler = BGE.gameFlow;
        var game = controler.initializeNewGame();
        eval(gameCode);
        var minPlayers = game.getParameter("minPlayers");
        var maxPlayers = game.getParameter("maxPlayers");
        var randomPlayerNumber = game.math.randomInt(minPlayers, maxPlayers);
        for (var i = 0; i < randomPlayerNumber; i++) {
            game.players[i] = {
                name: "TestPlayer" + String(i),
                eMail: "AutomaticTestPlayer" + String(i) + "@bgl.org",
            };
        }

        controler.setInitialValues(game);

        // Simulate all rounds of the game
        var maxRounds = game.getParameter("maxRounds");
        for (var i = 0; i < maxRounds; i++) {
            // Get input variables from Bot functions
            controler.calculateInputs(game);
            // Calculate the results of the round
            controler.calculateRoundResult(game);
            // Start the next round
            controler.advanceRound(game);
        }
        result = game.rounds;
    } catch (e) {
        result = e;
    }
    return result;
};

// Export in order to use on server-side
if(module) {
    if(module.exports) {
        module.exports.BGE = BGE;
    }
}
