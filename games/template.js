/*
 *********************************************************
 DEFAULT PARAMETERS
 *********************************************************
 */
// Number of rounds to play
game.addParameter("maxRounds", 5, [
    ">=1",
    "%1===0"
]);
// Minimal number of players
game.addParameter("minPlayers", 2);
// Maximal number of players
game.addParameter("maxPlayers", 10);
// Decision time for the players
game.addParameter("roundTimeOut", 90, [
    ">=15",
    "%1===0"
]);
/*
 ********************************************************
 CUSTOM PARAMETERS
 ********************************************************
 */
// Define your custom parameters here
//
// game.addParameter("parameterName", parameterValue, optionalValidationExpression)
//
/*
 *********************************************************
 INPUT VARIABLES
 *********************************************************
 */
// Example for a text field input variable
var in1 = {
    name: "input1",
    textField: {
        type: "number",
        default: 45,
        validation: [">=0"]
    },
    calculationFunction: calcIn1
};
// Example for a line chart
var chart = {
    caption: "Some input variable",
    type: "lineChart",
    unit: "$",
    xInit: new Date().getFullYear(),
    xIncrement: 1
};
// Add input variable
game.addInputVariable(in1, chart);
// calculation function of the input variable: used in simulation
function calcIn1(playerIndex) {
    return game.math.random(1, 999);
}
// --------------------------------------------
// Example of a scrolldown input variable
// --------------------------------------------
var options = [
    "Stone",
    "Scissors",
    "Paper"
];
var in2 = {
    name: "input2",
    checkBox: {
        values: options,
        default: options[0]
    },
    calculationFunction: calcIn2
};
game.addInputVariable(in2);
function calcIn2(playerIndex) {
    var randomInt = game.math.randomInt(0, 2);
    return options[randomInt];
}
/*
 *********************************************************
 OUTPUT VARIABLES
 *********************************************************
 */
// Define your output variables here
//
// Player-specific output variable:
// game.addPlayerVariable(outputVariable, optChart);
//
// Round-specific output variable:
// game.addRoundVariable(outputVariable, optChart);
//
/*
 *********************************************************
 SCORE FUNCTION
 *********************************************************
 */
function score(playerIndex) {
    // This score function just returns input1 of this round
    return game.get("input1", game.getCurrentRound(), playerIndex);
}
var scoreChart = {
    caption: "Input1 accumulated",
    type: "columnChart",
    unit: "$",
    xInit: new Date().getFullYear(),
    xIncrement: 1
};
game.addScore(score, scoreChart);
/*
 *********************************************************
 QUESTIONNAIRES
 *********************************************************
 */
var q1 = [
    {
        questionName: "q1",
        questionText: "Do you like the game?",
        answer: [
            "yes",
            "no"
        ]
    },
    {
        questionName: "q2",
        questionText: "Would you play it again?",
        answer: [
            "yes",
            "no",
            "maybe"
        ]
    },
    {
        questionName: "q3",
        questionText: "What strategy do you think is most useful to win?",
        answer: "string"
    }
];
game.addQuestionnaire("endOfGame", q1, [
    3,
    999
]);