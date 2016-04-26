/* 
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
"use strict";

function googleReady() {
    // Get the client socket of the specific namespace.
    // The io-object comes from the socket.io.js script which is send from 
    // the server implicitely. 
    var socket;
    if (document.location.hostname === 'localhost') {
        // use this local
        socket = io.connect('http://localhost:3000/bgeNs');
    } else {
        // use this on the server
         socket = io('/bgeNs');
    }
    // If set true, round outputs will additionally be written to an editor below the charts
    var editor = true;
    // DOM elements
    var $window;
    var $usernameInput;
    var $inputs; // Div where all the inputs are rendered
    var $infoBox; // Info Box with status information about the game
    var $loginPage; // The login page
    var $playPage;
    var $currentInput;
    var $submitInput; // The button to submit the inputs

    var username = '';
    var gameName;
    // The central game object. Grows while the game is progressing.
    var game;
    // Timer for input and questionnaire answer time
    var timer;
    var questionnaireTimer;
    var inputDefaults = {}; // In the render input method: Mapping input name <--> Default Value
    var allCharts;
    var playerId;
    var questionnaireQueue = [];
    var lastQuestShown = '';
    var questQueueFilled = false;
    var lastRound = false;
    var messageOfLastRound;

    // Time to decide the inputs
    var time;
    // Time for questionnaires. TODO: As parameter
    var questionnaireTime;

    // Ask if the user wants to refresh, leave the page, etc.
    var preventUnload = false;
    window.onbeforeunload = function() {
        if(preventUnload) {
            return "Attention, you are leaving this site!";
        }
    };

    $(document).ready(function () {

        $window = $(window);
        $usernameInput = $('.usernameInput');
        $inputs = $('#inputs');
        $infoBox = $('#info');
        $loginPage = $('.login.page');
        $playPage = $('.play.page');
        $currentInput = $usernameInput.focus();
        $submitInput = $("#submitInput");
        gameName = BGE.utils.getQueryVariable("name");

        if (editor) {
            try {
                require(['custom/editor'], function (editor) {
                    window.editor = editor({parent: 'editor', lang: 'js'});
                });
            } catch (e) {
            }
        } else {
            $("#editor").hide();
        }
        // Keyboard events
        $window.keydown(function (event) {
            // Auto-focus the current input when a key is typed.
            if (!(event.ctrlKey || event.metaKey || event.altKey)) {
                $currentInput.focus();
            }
            // When the client hits ENTER on their keyboard
            if (event.which === 13) {
                // At the game page.
                if (username) {
                    // At the login page.
                } else {
                    setUsername();
                }
            }
        });

        // Click events
        // Focus input when clicking anywhere on login page.
        $loginPage.click(function () {
            $currentInput.focus();
        });

        $submitInput.click(submitInput);

        $('#playAgain').click(userDisconnect);

    });

    // Socket events

    socket.on('init', function(initObject) {
        $submitInput.removeAttr('disabled');
        try {
            game = BGE.gameFlow.initializeNewGame();
            game.players = initObject.players;
            BGE.userFunctions.register(game);
            eval(initObject.gameCode);
            BGE.gameFlow.setInitialValues(game);
            renderInput(game.inputVariables);
            renderQuestionnaires();
            allCharts = collectChartObjects();
            nextToShow();
            preventUnload = true;
        } catch (e) {
            console.log(e);
        }
    });

    socket.on('wait join', function(numberOfPlayers) {
        writeInfo('secondary', (numberOfPlayers - 1) + ' other players have joined the game.'
            + ' Please wait for more players to join.');
        $submitInput.attr('disabled', 'disabled');
    });

    socket.on('set input', function() {
        nextToShow();
    });

    socket.on('calculate', function(inputs) {
        var cr = game.getCurrentRound();
        for (var inputName in inputs) {
            // Handle game aborts
            // When already one round was played: input object
            // holds the old values from the last round.
            // If we are in the first round, the default value is taken.
            for (var p = 0; p < game.players.length; p++) {
                if (inputs[inputName][p] === undefined || inputs[inputName][p] === null) {
                    inputs[inputName][p] = inputDefaults[inputName];
                }
            }
            // Write inputs to the game.round object
            game.rounds[cr][inputName] = inputs[inputName];
        }
        // Calculate round results and write them to the game.round object
        BGE.gameFlow.calculateRoundResult(game);
        // Output (results) rendering: draw charts and write to editor
        drawCharts();
        if (editor) {
            rewriteSourceCode(JSON.stringify(game.rounds));
            window.editor.getTextView().setOptions({readonly: true});
            window.editor.removeAllErrorMarkers();
        }
        questQueueFilled = false;
        $('.play.page').css({'display': 'none'});
        // Before the last round
        if (cr + 1 < game.getParameter('maxRounds')) {
            socket.emit('result', game.rounds[cr]);
            BGE.gameFlow.advanceRound(game);
        }
        // In the last round: game has finished
        else {
            lastRound = true;
            var message = 'The game has finished. ';
            if (game.scoreFunction) {
                message += 'You have reached a total score of ';
                message += Math.round(game.rounds[game.getCurrentRound()].accumulatedScore[playerId]*100)/100;
                message += '. ';
            }
            messageOfLastRound = message;
            nextToShow();
        }
    });

    socket.on('player id', function(id) {
        playerId = id;
    });

    socket.on('error', function(err){
        console.log(err);
    });

    // Generate a textfield or scrolldown for each input variable of the game
    function renderInput(inputVariableArray) {
        var inputWidth = '"four columns"';
        var inPerColumn = 3; // 12 : inputWidth
        var inputCounter = 0;
        $inputs.append('<div class="row"><div id="inputRow1" class="twelve columns" > </div></div>');
        var rowCounter = 1;
        for (var i = 0; i < inputVariableArray.length; i++) {
            inputCounter++;
            // currently: three inputs per row
            if (inputCounter > inPerColumn) {
                rowCounter++;
                $inputs.append('<div class="row"><div id="inputRow' + rowCounter + '" class="twelve columns" > </div></div>');
                inputCounter = 1;
            }
            var inputName = inputVariableArray[i].name;
            var inputString;
            // Variable input (textfield)
            if (inputVariableArray[i].textField && !inputVariableArray[i].scrollDown && !inputVariableArray[i].checkBox) {
                var defaultValue = inputVariableArray[i].textField.default;
                inputDefaults[inputName] = defaultValue;
                inputString = '<input id="' + inputName + '" class=' + inputWidth;
                inputString += ' placeholder="Please type ' + inputName + ' (e.g. ' + defaultValue + ')"/>';
            }
            // Predefined input (checkBox or scrollDown, both will be displayed as scrolldown)
            if (!inputVariableArray[i].textField && (inputVariableArray[i].scrollDown || inputVariableArray[i].checkBox)) {
                var type = inputVariableArray[i].scrollDown ? 'scrollDown' : 'checkBox';
                var values = inputVariableArray[i][type].values;
                inputDefaults[inputName] = inputVariableArray[i][type].default;
                inputString = '<select id="' + inputName + '" class=' + inputWidth + '>';
                inputString += '<option disabled="disabled" selected="selected"> Please decide ' + inputName + '</option>';
                for (var j = 0; j < values.length; j++) {
                    inputString += '<option>' + values[j] + '</option>';
                }
                inputString += '</select>';
            }
            $('#inputRow'+rowCounter).append(inputString);
        }
    }

    function clearInput(inputVariableArray) {
        for (var i = 0; i < inputVariableArray.length; i++) {
            var inputName = inputVariableArray[i].name;
            if (inputVariableArray[i].textField && !inputVariableArray[i].scrollDown
                && !inputVariableArray[i].checkBox) {
                $('#' + inputName).val('');
            }
        }
    }

    function clearQuestionnaires() {
        var questions;
        var id;
        for (var questionnaireName in game.questionnaires) {
            questions = game.questionnaires[questionnaireName].questions;
            for (var q = 0; q < questions.length; q++) {
                id = 'question' + questions[q].questionName + questionnaireName;
                // Clear variable inputs
                if (typeof questions[q].answer !== 'object') {
                    $('#' + id).val('');
                }
            }
        }
    }

    // Create a new page for each questionnaire
    function renderQuestionnaires() {
        var questions;
        var questionText;
        var answer;
        var questionId;
        var html;
        // Go through all questionnaires
        for (var questName in game.questionnaires) {
            questions = game.questionnaires[questName].questions;
            html = '<li class="'+questName+'page"><div class="row">';
            html += '<div class="twelve columns">';
            html += '<div id="'+questName+'info" class="ten columns alert-box"></div>';
            html += '<input id="'+questName+'submit" class="two columns" type="button" value="Submit questionnaire"/>';
            html += '</div></div>';
            html += '<div id="separator" class="row"></div>';
            // Go through all questions of the questionnaire
            for (var q = 0; q < questions.length; q++) {
                questionText = questions[q].questionText;
                answer = questions[q].answer;
                questionId = 'question' + questions[q].questionName + questName;
                html += '<div class="row"><div class="twelve columns">' + questionText + '</div></div>';
                // Textfield (variable answer)
                if (answer === 'string' || answer === 'number') {
                    html += '<div class="row"><div class="twelve columns"><input id="' + questionId + '" class="twelve columns"';
                    html += ' placeholder="Please type the answer of the question here"/></div></div>';
                }
                // Scrolldown (predefined answer)
                else if (typeof answer === 'object') {
                    html += '<div class="row"><div class="twelve columns"><select id="' + questionId + '">';
                    html += '<option disabled="disabled" selected="selected"> Please decide between one of these options</option>';
                    // Go through all answer options
                    for (var a = 0; a < answer.length; a++) {
                        html += '<option>' + answer[a] + '</option>';
                    }
                    html += '</select></div></div>';
                }
                // Dashed line
                if (q < questions.length - 1) {
                    html += '<div class="row"><div class="twelve columns"><div id="separator2"></div></div></div>';
                }
            }
            html += '</li>';
            $('.pages').append(html);
            $('#'+questName+'submit').click(submitQuestionnaire);
            $('#'+questName+'submit').css({'padding': '6px 7px 7px'});
            $('.'+questName+'page').css({'display': 'none'});
        }
    }

    /*
     * Determine which questionnaires have to be shown in this round (if any).
     * This is done once per round, after the calculate event has fired.
     * Show a questionnaire page or the normal play page depending on
     * whether there are questionnaires to show in this round or not.
     */
    function nextToShow() {
        // Define which questionnaires have to be shown in this round
        if (!questQueueFilled) {
            var positions;
            var cr = game.getCurrentRound();
            // Go through all questionnaires
            for (var questName in game.questionnaires) {
                positions = game.questionnaires[questName].positions;
                // Go through all positions of this specific questionnaire
                for (var p = 0; p < positions.length; p++) {
                    if ((!lastRound && positions[p] === cr) || (lastRound && positions[p] >= cr)) {
                        questionnaireQueue.push(questName);
                    }
                }
            }
            questQueueFilled = true;
        }
        var questToShow = questionnaireQueue.shift();
        time = game.getParameter('roundTimeOut');
        var message = messageOfLastRound || '';
        // Show a questionnaire
        if (questToShow !== undefined) {
            if (lastQuestShown !== '' && questToShow !== lastQuestShown) {
                $('.' + lastQuestShown + 'page').css({'display': 'none'});

            } else {
                $('.play.page').fadeOut();
            }
            $('.' + questToShow + 'page').show();
            // Update last shown questionnaire
            lastQuestShown = questToShow;
            questionnaireTime = 3 * time;
            questionnaireTimer = setInterval(refreshTimeQuest, 1000);
            writeInfo('success', message + ' Please fill in the questionnaire. You have \n\
                    <span id="timer'+questToShow+'"></span> seconds left.',
                undefined, $('#'+questToShow+'info'));
            clearQuestionnaires();
        }
        // Show a normal round
        else if (!lastRound) {
            if (lastQuestShown !== '') {
                $('.' + lastQuestShown + 'page').fadeOut();
            }
            $('.play.page').show();
            lastQuestShown = '';
            $submitInput.removeAttr('disabled');
            clearInput(game.inputVariables);
            timer = setInterval(refreshTime, 1000);
            writeInfo('success', 'Round ' + game.rounds[game.getCurrentRound()].roundNumber + ': Please decide upon the input values. You have \n\
                    <span id="timer"></span> seconds left.');
            // Redraw editor
            if (editor) {
                window.editor.getTextView().redraw();
            }
            // Set focus to first input
            document.getElementById(game.inputVariables[0].name).focus();
        }
        else if (lastRound) {
            if (lastQuestShown !== '') {
                $('.' + lastQuestShown + 'page').fadeOut();
            }
            $('.play.page').show();
            writeInfo('success', message);
            socket.emit('finish', game);
            preventUnload = false;
            $submitInput.hide();
            $('#playAgain').show();
            // Redraw editor
            if (editor) {
                window.editor.getTextView().redraw();
            }
            // Set focus to first input
            document.getElementById(game.inputVariables[0].name).focus();
        }
        function refreshTimeQuest() {
            if (questionnaireTime > 0) {
                questionnaireTime--;
            } else {
                clearInterval(questionnaireTimer);
                nextToShow();
            }
            $('#timer' + questToShow).text(questionnaireTime);
        }
    }

    function refreshTime() {
        if (time > 0) {
            time--;
            // Timer ran down. --> User gets disconnected
        } else {
            socket.emit('abort', null);
            userDisconnect();
        }
        if (time > 20) {
            $('#timer').text(time);
        }
        else {
            $('#timer').html('<span id="zeitFarbe"> only ' + time + ' </span>');
        }
    }

    // Show the login page again.
    function userDisconnect() {
        clearInterval(timer);
        console.log('user disconnect performed, timer cleared');
        username = '';
        // Disconnect the user.
        preventUnload = false;
        location.reload();
        // Show login page again.
        $('.play.page').fadeOut();
        $('.login.page').show();
    }

    /*
     * Write something to an info box.
     * Alert levels: success, secondary, alert
     * If append=true: Message will be appended
     * If div is set: write not to the standard info box of the play page,
     * but to the div specified (for infos on questionnaire pages)
     */
    function writeInfo(alertLevel, message, append, div) {
        var writeOn = div || $infoBox;
        if (!append) {
            writeOn.text(''); // clear
        }
        writeOn.append(message);
        writeOn.removeClass('success secondary alert');
        writeOn.addClass(alertLevel);
        writeOn.css({'margin-top': '0px'});
    }

    function submitQuestionnaire() {
        var currentQuestions = game.questionnaires[lastQuestShown].questions;
        var domain;
        var value;
        var error = false;
        var questionnaireResult = {
            timeStamp: Date(),
            questionnaireName: lastQuestShown,
            position: game.getCurrentRound(),
            answers: {}
        };
        // Clear info box
        writeInfo('success', '', undefined, $('#'+lastQuestShown+'info'));
        var questionName;
        for (var q = 0; q < currentQuestions.length; q++) {
            domain = currentQuestions[q].answer;
            questionName = currentQuestions[q].questionName;
            value = $('#question' + questionName + lastQuestShown).val();
            if (BGE.utils.isNumeric(value)) {
                value = Number(value);
            }
            // Variable input
            if (domain === 'number' || domain === 'string') {
                if (typeof value === domain && value !== "" && value !== undefined) {
                    questionnaireResult.answers[questionName] = value;
                }
                // Error: answer has wrong domain
                else {
                    writeInfo('alert', 'Question ' + (q+1) + ' must be of type ' + domain + '!  ',
                        true, $('#'+lastQuestShown+'info'));
                    error = true;
                }
            }
            // Predefined input
            else if (typeof domain === 'object') {
                var fitsDomain = false;
                for (var j = 0; j < domain.length; j++) {
                    if (domain[j] === value) {
                        fitsDomain = true;
                        break;
                    }
                }
                if (fitsDomain) {
                    questionnaireResult.answers[questionName] = value;
                }
                // Error
                else {
                    writeInfo('alert', 'Question ' + (q+1) + ' incorrect. Please choose one of the options.  ',
                        true, $('#'+lastQuestShown+'info'));
                    error = true;
                }
            }
        }
        if (error) {
            writeInfo('alert', '<span id="timer'+lastQuestShown+'"></span> seconds left. ',
                true, $('#'+lastQuestShown+'info'));
        }
        if (!error) {
            game.questionnaireResults.push(questionnaireResult);
            clearInterval(questionnaireTimer);
            nextToShow();
        }
    }

    // Check if all inputs are set and if they match the domain.
    // Emit inputs to the server if all inputs are correct.
    function submitInput() {
        var inputVariableArray = game.inputVariables;
        var inputValues = {};
        var inputName;
        var type; // variable or predefined input type
        var value;
        var error = false;
        // Clear info box
        writeInfo('success', '');
        // Go through all input variables
        for (var i = 0; i < inputVariableArray.length; i++) {
            inputName = inputVariableArray[i].name;
            type = inputVariableArray[i].textField ? 'textField' : 'scrollDown';
            type = inputVariableArray[i].checkBox ? 'checkBox' : type;
            value = $('#'+inputName).val();
            if (BGE.utils.isNumeric(value)) {
                value = Number(value);
            }
            // Check if all variable inputs (textfield) matches domain and validation expression (if any)
            if (type === 'textField') {
                var domain = inputVariableArray[i][type].type; // number or string
                var valExpr = inputVariableArray[i][type].validation; // array of strings
                if (typeof value === domain && value !== "" && value !== undefined) {
                    if (valExpr) {
                        try {
                            if (BGE.validate.validationExpression(value, valExpr, inputName)) {
                                inputValues[inputName] = value;
                            }
                        } catch (e) {
                            writeInfo('alert', e.message, true);
                            error = true;
                        }
                    } else {
                        inputValues[inputName] = value;
                    }
                } else {
                    writeInfo('alert', inputName + ' must be of type ' + domain + '!  ', true);
                    error = true;
                }
            }
            // Check if all predefined inputs have been chosen correctly
            else if (type === 'scrollDown' || type === 'checkBox') {
                var values = inputVariableArray[i][type].values;
                var fitsDomain = false;
                for (var j = 0; j < values.length; j++) {
                    if (values[j] === value) {
                        fitsDomain = true;
                        break;
                    }
                }
                if (fitsDomain) {
                    inputValues[inputName] = value;
                } else {
                    writeInfo('alert', inputName + ' incorrect. Please choose one of the options.  ', true);
                    error = true;
                }
            }
        }
        if (error) {
            writeInfo('alert', '<span id="timer"></span> seconds left. ', true);
        }
        if (!error) {
            writeInfo('success', 'Inputs successfully submitted. Please wait for the other players to decide. ');
            $submitInput.attr('disabled', 'disabled');
            var inputObject = {
                inputValues: inputValues,
                cr: game.cr
            };
            socket.emit('input', inputObject);
            clearInterval(timer);
        }
    }

    function drawCharts() {
        // Go through all charts
        var chart;
        for (var i = 0; i < allCharts.length; i++) {
            chart = allCharts[i];
            var type = chart.type;
            var googleChart;
            // Column and Line chart
            if (type === 'columnChart' || type === 'lineChart') {
                var headRow = [];
                var firstRound = [];
                headRow.push('Period');
                firstRound.push(String(chart.xInit));
                // Player-specific charts
                if (chart.perPlayer) {
                    // Header and first round
                    for (var p = 0; p < game.players.length; p++) {
                        headRow.push(chart.caption + ' ' + game.players[p].nickName);
                        firstRound.push(game.rounds[0][chart.belongsTo][p]);
                    }
                    var data = google.visualization.arrayToDataTable([headRow, firstRound]);
                    // All data beginning from the second round
                    for (var r = 1; r < game.rounds.length; r++) {
                        var oneRow = [];
                        var xTick = chart.xInit + chart.xIncrement * r;
                        oneRow.push(String(xTick));
                        for (var p = 0; p < game.players.length; p++) {
                            oneRow.push(game.rounds[r][chart.belongsTo][p]);
                        }
                        data.addRows([oneRow]);
                    }
                }
                // Round specific charts
                else if (chart.perRound) {
                    headRow.push(chart.caption);
                    firstRound.push(game.rounds[0][chart.belongsTo]);
                    var data = google.visualization.arrayToDataTable([headRow, firstRound]);
                    // All data beginning from the second round
                    for (var r = 1; r < game.rounds.length; r++) {
                        var oneRow = [];
                        var xTick = chart.xInit + chart.xIncrement * r;
                        oneRow.push(String(xTick));
                        oneRow.push(game.rounds[r][chart.belongsTo]);
                        data.addRows([oneRow]);
                    }
                }
                var options = {
                    title: chart.caption,
//                    legend: 'none',
                    vAxis: {minValue: 0},
                    enableInteractivity: true
                };
                if (type === 'columnChart') {
                    googleChart = new google.visualization.ColumnChart(document.getElementById('chart'+i));
                }
                else if (type === 'lineChart') {
                    googleChart = new google.visualization.LineChart(document.getElementById('chart' + i));
                }
            }
            // Pie chart
            else if (type === 'pieChart' && chart.perPlayer) {
                var headRow = [];
                var allData = [];
                headRow.push(chart.caption);
                headRow.push(chart.unit);
                allData.push(headRow);
                for (var p = 0; p < game.players.length; p++) {
                    var row = new Array();
                    row.push(chart.caption + ' ' +  game.players[p].nickName);
                    row.push(game.rounds[game.getCurrentRound()][chart.belongsTo][p]);
                    allData.push(row);
                }
                var data = google.visualization.arrayToDataTable(allData);
                var options = {
                    title: chart.caption,
                    is3D: true
                };
                googleChart = new google.visualization.PieChart(document.getElementById('chart' + i));
            }
            googleChart.draw(data, options);
        }
    }

    // Called on init. Fetch all chart objects from in and output variables
    // and collect them together. Create a div for each of them.
    function collectChartObjects() {
        var result = [];
        var chart;
        var inputName;
        var counter = 0;
        for (var i = 0; i < game.inputVariables.length; i++) {
            chart = game.inputVariables[i].chart;
            inputName = game.inputVariables[i].name;
            if (chart !== undefined) {
                chart.perPlayer = true;
                chart.belongsTo = inputName;
                result.push(chart);
                $('#charts').append('<div class="six columns"><div id="chart'+counter
                    +'" class="diagram"></div></div>');
                counter++;
            }
        }
        for (var i = 0; i < game.variables.length; i++) {
            chart = game.variables[i].chart;
            inputName = game.variables[i].name;
            if (chart !== undefined) {
                if (game.variables[i].scope === 'perPlayer') {
                    chart.perPlayer = true;
                }
                else if (game.variables[i].scope === 'perRound') {
                    chart.perRound = true;
                }
                chart.belongsTo = inputName;
                result.push(chart);
                $('#charts').append('<div class="six columns"><div id="chart'
                    + counter + '" class="diagram"></div></div>');
                counter++;
            }
        }
        return result;
    }


    // from the esprima and escodegen project
    function rewriteSourceCode(code) {
        var newCode;
        if (typeof window.editor !== 'undefined') {
            var option = {
                comment: true,
                format: {
                    indent: {
                        style: "    "
                    },
                    quotes: "double"
                }
            };
            try {
                var syntax;
                syntax = window.esprima.parse(code, {raw: true, tokens: true, range: true, comment: true});
                syntax = window.escodegen.attachComments(syntax, syntax.comments, syntax.tokens);
                newCode = window.escodegen.generate(syntax, option);
                window.editor.setText(newCode);
            } catch (e) {
                writeInfo("error", e.stack);
            }
        }
    }

    // Requests a new game telling the server the username.
    function setUsername() {
        username = cleanInput($usernameInput.val().trim());
        // Fade out the login page, show the game page.
        if (username) {
            $loginPage.fadeOut();
            $playPage.show();
            // Remove click event handler.
            $loginPage.off('click');
            var player = {nickName: username};
            var play = {
                player: player,
                gameName: gameName
            };
            socket.emit('play', play);
        }
    }

    // Prevents input from having injected markup
    function cleanInput(input) {
        var result = $('<div/>').text(input).text();
        return result;
    }
}
