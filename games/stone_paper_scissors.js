//Schnick Schnack Schnuck
game.addParameter("maxRounds", 10, [
    ">=1",
    "%1===0"
]);
game.addParameter("minPlayers", 2, ["===2"]);
game.addParameter("maxPlayers", 2, ["===2"]);
game.addParameter("roundTimeOut", 20, [
    ">=15",
    "%1===0"
]);
/* Choice-Set. Left term must beat the right term in order to make the winner function work. */
var choiceSet = [
    "Stone",
    "Scissors",
    "Paper"
];
/*var choiceSet = ["cockroach", "nuclear bomb", "foot"];*/
/*
 Input: Stone, Scissors or Paper
 */
var choice = {
    name: "choice",
    scrollDown: {
        values: choiceSet,
        default: choiceSet[0]
    },
    calculationFunction: bot
};
game.addInputVariable(choice);
function bot(playerIndex) {
    var result = "Error";
    var randomInt = game.math.randomInt(0, 2);
    result = choiceSet[randomInt];
    return result;
}
/*
 Integer variable. -1 if a player looses the round, 1 if he wins, 0 for tie
 */
var winner = {
    name: "roundWinner",
    type: Number,
    initialValue: [
        0,
        0
    ],
    calculationFunction: calcWinner,
    validation: [
        ">=-1",
        "<=1",
        "%1===0"
    ]
};
game.addPlayerVariable(winner);
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
    for (var i = 0; i < choiceSet.length; i++) {
        if (choice === choiceSet[i]) {
            result = i;
            break;
        }
    }
    return result;
}
/*
 Score Function
 */
function scoreFunction(playerIndex) {
    var result = Number.MIN_VALUE;
    var cr = game.getCurrentRound();
    result = game.get("roundWinner", cr, playerIndex);
    // result = calcWinner(playerIndex);
    return result;
}
var winner = {
    caption: "Game score",
    type: "lineChart",
    unit: "points",
    xInit: game.utils.getWeekNumber(new Date()),
    xIncrement: 1
};
game.addScore(scoreFunction, winner);