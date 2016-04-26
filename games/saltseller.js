/*
 Define the game parameters. 
 The first two arguments are required.
 The third argument is optional. It represents one or many validation
 expressions for the parameter. Every time the game is changed, the parameters
 will be matched against these expressions.
 This is useful if people other than the original game author
 have the password to edit the game.
 */
/*
 The number of rounds the game consists of. Every game must define this
 parameter.
 Later the players might be shown a different round number in order
 to avoid horizon effects. 
 */
game.addParameter("maxRounds", 5, [
    ">=1",
    "%1===0"
]);
game.addParameter("minPlayers", 2, ["===2"]);
game.addParameter("maxPlayers", 2, ["===2"]);
game.addParameter("roundTimeOut", 90, [
    ">=15",
    "%1===0"
]);
game.addParameter("marginalCost", 40, [">0"]);
game.addParameter("zeroRate", 2, [">0"]);
game.addParameter("sensitivityIndex", 3, [
    ">0",
    "%2===1"
]);
game.addParameter("zeroDelayPercentage", 0.5, [
    ">=0",
    "<=1"
]);
game.addParameter("zeroDemandPrice", 960, [">0"]);
game.addParameter("maximalDemand", 320, [">0"]);
/*
 Define variables and add them to the game. 
 The order is important. A variable which uses another variable
 for its calculation must be added after that.
 Input variables of a round are available even if the input is defined at the end.
 Nevertheless it is good practice to declare input variables first.
 */
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
/* 
 Additional remarks:
 Default attribute: placeholder in the form and as default value, if a player aborts the game.
 (if no calculationFunction is defined, this will be his input for the rest of the game)
 Calculation function is optional for inputs. It is used for game simulation, computer players and game 
 aborts. It is recommended to implement at least a simple calculation function for inputs as well.
 A game must define at least one input variable.
 */
var marketShare = {
    name: "marketShare",
    initialValue: 0.5,
    calculationFunction: calcMarketShare,
    validation: [
        ">=0",
        "<=1"
    ]
};
var msChart = {
    caption: "Market share",
    type: "pieChart",
    unit: "%"
};
/*
 A player specific variable is calculated in each round for each player individually. 
 In order to do so, it must define a calculation function. This function is called for 
 each player in each round with the index of the current player as parameter. 
 Already available variables of the currentRound as well as all variables of previous rounds 
 can be accessed for this calculation via the game.get(variableName, roundIndex, playerIndex) function,
 */
game.addPlayerVariable(marketShare, msChart);
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
/*
 A round specific variable is calculated once per round. Its value is the same for all players.
 Thus, a calculation function must be defined but without the player index as parameter.
 */
game.addRoundVariable(marketDemand, mdChart);
var sales = {
    name: "sales",
    initialValue: 0,
    calculationFunction: calcSales
};
var salesChart = {
    caption: "Sales",
    type: "columnChart",
    unit: "Million Euros",
    xInit: new Date().getFullYear(),
    xIncrement: 1
};
game.addPlayerVariable(sales, salesChart);
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
/*
 The accumulated score over all finished rounds is calculated automatically, 
 as long as the score function is defined (see below). The game.addScore() command
 is used to register the score function.
 As a second optional parameter it takes a chart in order to show the accumulated score.
 */
var accScoreChart = {
    caption: "Accumulated income",
    type: "columnChart",
    unit: "Million Euros",
    xInit: new Date().getFullYear(),
    xIncrement: 1
};
game.addScore(scoreFunction, accScoreChart);
/*
 Define questionnaires
 */
var immigrationQuestionnaire = [
    {
        questionName: "firstName",
        questionText: "What is your first name?",
        answer: "string"
    },
    {
        questionName: "lastName",
        questionText: "What is your last name?",
        answer: "string"
    },
    {
        questionName: "age",
        questionText: "What is your age?",
        answer: "number"
    },
    {
        questionName: "nastyQuestion",
        questionText: "Have you ever been arrested or convicted for any offense or crime, even though subject of a pardon, amnesty or    other similar legal action? Have you ever unlawfully distributed or sold a controlled substance(drug), or been a prostitute or procurer for prostitutes?",
        answer: [
            "yes",
            "no",
            "maybe"
        ]
    },
    {
        questionName: "naziTest",
        questionText: "Do you seek to enter the United States to engage in export control violations, subversive or terrorist activities, or any other unlawful purpose? Are you a member or representative of a terrorist organization as currently designated by the U.S. Secretary of State? Have you ever participated in persecutions directed by the Nazi government of Germany; or have you ever participated in genocide? Have you ever participated in, ordered, or engaged in genocide, torture, or extrajudicial killings?",
        answer: [
            "yes",
            "no",
            "maybe",
            "I long for a righteous leader"
        ]
    }
];
/* 
 The first parameter is the name of the questionnaire.
 The last parameter defines the index of the round(s) before which the questionnaire will be 
 presented  to the players.
 0 means the questionnaire will be shown before the first round (round with index 0)
 It must be an array and can have one or several distinct numeric entries.
 A huge number will probably be after the last round.
 */
game.addQuestionnaire("immigration", immigrationQuestionnaire, [0]);
var tinyQuest = [{
    questionName: "q1",
    questionText: "Do you understand the game after now having played for three rounds?",
    answer: [
        "totally",
        "a little bit",
        "not at all"
    ]
}];
game.addQuestionnaire("understandGame", tinyQuest, [3]);
var endOfGameQuestionnaire = [
    {
        questionName: "q1",
        questionText: "Did you like the game?",
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
        questionName: "strategy",
        questionText: "What strategy do you think is most useful to win?",
        answer: "string"
    },
    {
        questionName: "strategyChange",
        questionText: "Did you change your strategy during the game?",
        answer: "string"
    },
    {
        questionName: "strategy3",
        questionText: "If yes, why was this necessary?",
        answer: "string"
    }
];
game.addQuestionnaire("endOfGame", endOfGameQuestionnaire, [999]);
/*
 FUNCTION SECTION
 These functions have been registered earlier in the variable descriptions or the 
 addScore command.
 */
// Random price generator either for bots or simulation 
function priceBot(playerIndex) {
    var result = Number.MIN_VALUE;
    var marginalCost = game.getParameter("marginalCost");
    result = game.math.random(marginalCost, game.getParameter("zeroRate") * 1.5 * marginalCost);
    return result;
}
/* 
 The score function defines how the score is calculated in each round. In the case
 of SaltSeller, the income is the score.
 If specified and registered, the score function is called automatically every round in order 
 to calculate the score of this round and the accumulated score over all finished 
 rounds. Both values are written to the database. In the end, the accumulated score 
 determines the winner of the game. If the score function is not specified, 
 the game has no winner. A chart of the accumulated score can be displayed to the 
 players by passing a chart object to the game.addScore() command. 
 Please look above for an example.
 */
function scoreFunction(playerIndex) {
    return game.get("income", game.getCurrentRound(), playerIndex);
}
// Market delay only needs to be calculated once per round, 
// so we only calculate it for the first player.
var marketDelayBuffer = 0;
function calcMarketShare(playerIndex) {
    var cr = game.getCurrentRound();
    var result = Number.MIN_VALUE;
    var p1 = 0;
    var p2 = 0;
    var marketShareNow = 0;
    var marketSharePrev = 0;
    if (playerIndex === 0) {
        p1 = game.get("price", cr, 0);
        p2 = game.get("price", cr, 1);
        marketDelayBuffer = marketDelay(p1, p2);
    } else if (playerIndex === 1) {
        p1 = game.get("price", cr, 1);
        p2 = game.get("price", cr, 0);
    }
    marketShareNow = ms(p1, p2);
    marketSharePrev = game.get("marketShare", cr - 1, playerIndex);
    result = marketSharePrev * marketDelayBuffer + marketShareNow * (1 - marketDelayBuffer);
    return result;
}
function ms(p1, p2) {
    var priceRatio = p1 / p2;
    var result = Number.MIN_VALUE;
    var y;
    var zeroDelayCoeff = 0.5 * Math.pow(1 / (game.getParameter("zeroRate") - 1), 1 / game.getParameter("sensitivityIndex"));
    if (priceRatio >= game.getParameter("zeroRate")) {
        result = 0;
    } else if (1 / priceRatio >= game.getParameter("zeroRate")) {
        result = 1;
    } else if (0 < priceRatio && priceRatio < 1) {
        priceRatio = 1 / priceRatio;
        y = 0.5 - zeroDelayCoeff * Math.pow(priceRatio - 1, 1 / game.getParameter("sensitivityIndex"));
        result = 1 - y;
    } else if (1 <= priceRatio && priceRatio < game.getParameter("zeroRate")) {
        y = 0.5 - zeroDelayCoeff * Math.pow(priceRatio - 1, 1 / game.getParameter("sensitivityIndex"));
        result = y;
    }
    return result;
}
/*
 Returns the percentage of the market participants who do not react imideately 
 to a price change but with a delay of one round.
 If both players demand the same price the market_delay will be (1-ZERO_DELAY_PERCENTAGE).
 If a player demands [zero_rate] times the price of his opponent, the market_delay will be zero.
 */
function marketDelay(p1, p2) {
    var priceRatio = p1 / p2;
    var result = -1;
    if (priceRatio === 1) {
        result = 1 - game.getParameter("zeroDelayPercentage");
    } else if (priceRatio > 1) {
        result = marketDelayFunction(priceRatio);
    } else if (0 < priceRatio && priceRatio < 1) {
        result = marketDelayFunction(1 / priceRatio);
    }
    return result;
}
/*
 Parable function used to determine the decreasing market_delay the more the price_ratio differs from 1.
 f(x) = -konst(1-x)^2+konst  für x >= 1.
 */
function marketDelayFunction(priceRatio) {
    var result = Number.MIN_VALUE;
    var zeroDelayCoeff = (1 - game.getParameter("zeroDelayPercentage")) / Math.pow(1 - game.getParameter("zeroRate"), 2);
    var md = -zeroDelayCoeff * Math.pow(1 - priceRatio, 2) + (1 - game.getParameter("zeroDelayPercentage"));
    if (md > 0)
        result = md;
    else
        result = 0;
    return result;
}
function calcIncome(playerIndex) {
    var result = Number.MIN_VALUE;
    var cr = game.getCurrentRound();
    var marketShare = game.get("marketShare", cr, playerIndex);
    var sales = game.get("sales", cr, playerIndex);
    var demand = game.get("marketDemand", cr);
    result = sales - demand * marketShare * game.getParameter("marginalCost");
    return result;
}
function calcSales(playerIndex) {
    var result = Number.MIN_VALUE;
    var cr = game.getCurrentRound();
    var price = game.get("price", cr, playerIndex);
    var marketShare = game.get("marketShare", cr, playerIndex);
    var demand = game.get("marketDemand", cr);
    result = marketShare * demand * price;
    return result;
}
// MarketDemand is a round specific variable. Thus, its function
// is called without playerIndex.
function calcDemand() {
    var result = Number.MIN_VALUE;
    var cr = game.getCurrentRound();
    var lowerPrice = 0;
    var p1 = game.get("price", cr, 0);
    var p2 = game.get("price", cr, 1);
    if (p1 <= p2) {
        lowerPrice = p1;
    } else {
        lowerPrice = p2;
    }
    if (lowerPrice > game.getParameter("zeroDemandPrice")) {
        result = 0;
    } else {
        result = game.getParameter("maximalDemand") - lowerPrice / 3;
    }
    return result;
}