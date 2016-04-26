/*
 *********************************************************
 DEFAULT PARAMETERS
 *********************************************************
 */
// Number of rounds to play
game.addParameter("maxRounds", 100, [
    ">=1",
    "%1===0"
]);
// Minimal number of players
game.addParameter("minPlayers", 2);
// Maximal number of players
game.addParameter("maxPlayers", 2);
// Decision time for the players
game.addParameter("roundTimeOut", 60, [
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
// --------------------------------------------
// Example of a scrolldown input variable
// --------------------------------------------
var options = [
    "Stone",
    "Scissors",
    "Paper"
];
var in2 = {
    name: "choice",
    checkBox: {
        values: options,
        default: "Stone"
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
var out = {
    name: "roundWinner",
    calculationFunction: calcWinner,
    initialValue: [
        0,
        0
    ],
    validation: [
        "<=1",
        ">=-1",
        "%1===0"
    ]
};
function calcWinner(playerIndex) {
    var result = Number.MIN_VALUE;
    var cr = game.getCurrentRound();
    var player1Choice = choiceToInt(game.get("choice", cr, 0));
    var player2Choice = choiceToInt(game.get("choice", cr, 1));
    var diff;
    if (playerIndex === 0) {
        diff = player1Choice - player2Choice;
    } else {
        diff = player2Choice - player1Choice;
    }
    if (diff === -1 || diff === 2) {
        result = 1;
    } else if (diff === 0) {
        result = 0;
    } else {
        result = -1;
    }
    return result;
}
function choiceToInt(choice) {
    var result = Number.MIN_VALUE;
    for (var i = 0; i < options.length; i++) {
        if (choice === options[i]) {
            result = i;
            break;
        }
    }
    return result;
}
game.addPlayerVariable(out);
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
    // return calcWinner(playerIndex);
    return game.get("roundWinner", game.getCurrentRound(), playerIndex);
}
var scoreChart = {
    caption: "Total game score",
    type: "columnChart",
    unit: "",
    xInit: 1,
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
    -1,
    1,
    999
]);