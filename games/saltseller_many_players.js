game.addParameter("maxRounds", 10);
game.addParameter("minPlayers", 3, [">2"]);
game.addParameter("maxPlayers", 20, [">2"]);
game.addParameter("roundTimeOut", 90, [
    ">=15",
    "%1===0"
]);
game.addParameter("zeroDemandPrice", 960, [">0"]);
game.addParameter("maximalDemand", 320, [">0"]);
game.addParameter("marginalCost", 40, [">0"]);
game.addParameter("zeroRate", 2, [">0"]);
var price = {
    name: "price",
    description: "The price per ton of salt. Every round, the players have to decide upon this parameter ",
    textField: {
        type: "number",
        default: 45,
        validation: [">=0"]
    },
    calculationFunction: priceBot
};
var priceChart = {
    caption: "Salt price",
    type: "lineChart",
    unit: "Euros",
    xInit: new Date().getFullYear(),
    xIncrement: 1
};
game.addInputVariable(price, priceChart);
var marketDemand = {
    name: "marketDemand",
    initialValue: 0,
    calculationFunction: calcDemand,
    validation: [">=0"]
};
var mdChart = {
    caption: "Market demand",
    type: "lineChart",
    unit: "million tons",
    xInit: new Date().getFullYear(),
    xIncrement: 1
};
game.addRoundVariable(marketDemand, mdChart);
var marketShare = {
    name: "marketShareAbsolute",
    calculationFunction: calcMarketShare,
    validation: [">=0"]
};
var msChart = {
    caption: "Market share",
    type: "pieChart",
    unit: "Million tons"
};
game.addPlayerVariable(marketShare, msChart);
var income = {
    name: "income",
    initialValue: 0,
    calculationFunction: calcIncome
};
var incomeChart = {
    caption: "Income",
    type: "columnChart",
    unit: "Million Euros",
    xInit: new Date().getFullYear(),
    xIncrement: 1
};
game.addPlayerVariable(income, incomeChart);
var accScoreChart = {
    caption: "Accumulated income",
    type: "columnChart",
    unit: "Million Euros",
    xInit: new Date().getFullYear(),
    xIncrement: 1
};
game.addScore(scoreFunction, accScoreChart);
/*
 FUNCTION SECTION
 These functions have been registered earlier in the variable descriptions or the 
 addScore command.
 */
// Random price generator either for bots or simulation 
function priceBot(playerIndex) {
    var result = Number.MIN_VALUE;
    var marginalCost = game.getParameter("marginalCost");
    result = game.math.random(marginalCost, game.getParameter("zeroRate") * 10 * marginalCost);
    return result;
}
function scoreFunction(playerIndex) {
    return game.get("income", game.getCurrentRound(), playerIndex);
}
function calcDemand() {
    var result = Number.MIN_VALUE;
    var cr = game.getCurrentRound();
    var lowerPrice = Number.MAX_VALUE;
    var price;
    // go through all players in order to find the lowest price
    for (var i = 0; i < game.getNumberOfPlayers(); i++) {
        price = game.get("price", cr, i);
        if (price < lowerPrice) {
            lowerPrice = price;
        }
    }
    if (lowerPrice > game.getParameter("zeroDemandPrice")) {
        result = 0;
    } else {
        result = game.getParameter("maximalDemand") - lowerPrice / 3;
    }
    return result;
}
function calcMarketShare(playerIndex) {
    var result = Number.MIN_VALUE;
    result = game.math.inverseDistribution(playerIndex, "marketDemand", "price");
    return result;
}
function calcIncome(playerIndex) {
    var result = Number.MIN_VALUE;
    var cr = game.getCurrentRound();
    var marketShare = game.get("marketShareAbsolute", cr, playerIndex);
    var price = game.get("price", cr, playerIndex);
    result = marketShare * price - marketShare * game.getParameter("marginalCost");
    return result;
}