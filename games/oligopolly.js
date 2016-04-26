/*
 The Oligopoly Game is an n-player roundbased business game with n ∈ {2, 3, 4, 5}.
 The n players represent an oligopoly with an almost homogenious product. The 'product differenciation' is simulated by the parameter
 'changeCosts'. (If a customer changes from one seller to another, he/she has to pay the 'changeCosts').
 By setting a 'numberOfCustomers' (which has to be atleast 10 or higher) and by defining the 'demandPerCustomer' the admin may
 influence the size of the Market. The winner is the player with the highest cummulative profit after all rounds (see the
 'scoreFunction'). Apart from the alread mentioned parameters, the profit is also influenced by the 'marginalCosts' and the 'fixCosts'
 which are both equal for each player.
 The game specific parameters are the number of rounds per game ('maxRounds') and the time limit for each round ('roundTimeout').
 */
/*
 PARAMETERS
 */
game.addParameter("maxRounds", 17, [
    ">=1",
    "%1===0"
]);
game.addParameter("minPlayers", 2, [">=2"]);
game.addParameter("maxPlayers", 2, ["<=5"]);
game.addParameter("roundTimeOut", 90, [
    ">=15",
    "%1===0"
]);
game.addParameter("marginalCosts", 70, [
    ">=0",
    "%1===0"
]);
game.addParameter("fixCosts", 0, [
    ">=0",
    "%1===0"
]);
game.addParameter("numberOfCustomers", 3, [">=2"]);
game.addParameter("changeCosts", 4.5, [">0"]);
/*
 INPUT VARIABLES
 Each player may set an individual price for each customer (price discrimination).
 So the number of imput variables per player eguals the 'numberOfCustomers'.
 */
for (var i = 0; i < game.getParameter("numberOfCustomers"); i++) {
    var price = {
        initialValue: 100,
        textField: {
            type: "number",
            default: 1005,
            validation: [
                ">=0",
                "<=999999",
                "%1===0"
            ]
        },
        calculationFunction: priceBot
    };
    var j = i + 1;
    price.name = "priceForCustomer" + j;
    var inChart = {
        caption: "Price for customer " + i,
        type: "lineChart",
        unit: "monetary unit",
        xInit: new Date().getFullYear(),
        xIncrement: 1
    };
    game.addInputVariable(price, inChart);
}
// Random inputs or concret inputs --> Needed for the simulation.
function priceBot(playerIndex) {
    var result = Number.MIN_VALUE;
    result = game.math.randomInt(100, 120);
    /*
     if (playerIndex === 0)
     result = 101;
     if (playerIndex === 1)
     result = 106;
     if (playerIndex === 2)
     result = 106;
     */
    return result;
}
/*
 VARIABLES
 */
/*
 demandPerCustomer: How much units do the customers ask for in each round?
 RoundVariable --> Within one round, all customers ask for the same amount of units.
 */
var demandPerCustomer = {
    name: "demandPerCustomer",
    initialValue: 1,
    calculationFunction: calcDemand,
    validation: [
        ">0",
        "%1===0"
    ]
};
game.addRoundVariable(demandPerCustomer);
// Here, the admin may add any kind of function to represent the customers demand.
// Right now, the demand is unelastic. In all rounds, all customers always consume 1 unit per round. So the total demand each round
// equals the numberOfCustomers'.
function calcDemand() {
    return 1;
}
/*
 sellToCustomer: One set of these variables for each customer (and the set equals the numberOfPlayers).
 Meaning: Which seller/player does the customer choose? --> The variable is either 1 oder 0 for each player. So, if the variable for
 one certain customer and one player equals 1, that means the customer buys his/her demand from this player and not from any other
 player. Each customer only buys from one player. So, each customers set of 'sellToCustomer' variables includes only one variable
 equals 1 while the others are equal to 0.
 Example: 3 players: customer1 buys from player 2 --> set of sellToCustomer variables: (0, 1, 0).
 If the price offers from two players are equal (including the 'changeCosts'), the customer buys from the player with the lower index.
 (In this case, the customer should actually choose randomly)
 */
var calcSell = [];
for (var i = 0; i < game.getParameter("numberOfCustomers"); i++) {
    var j = i + 1;
    var functionString = "var result = 1; \n";
    functionString += "cr = this.getCurrentRound(); \n";
    functionString += "var changeCosts = this.calculateChangeCosts(this, " + i + ", cr, playerIndex); \n";
    functionString += "var myPrice = this.get('priceForCustomer' + " + j + ", cr, playerIndex) + changeCosts; \n";
    functionString += "for (var k = 0; k < this.getNumberOfPlayers(); k++) { \n";
    functionString += "if (k !== playerIndex) { \n";
    functionString += "changeCosts = this.calculateChangeCosts(this, " + i + ", cr, k); \n";
    functionString += "var othersPrice = this.get('priceForCustomer' + " + j + ", cr, k) + changeCosts; \n";
    functionString += "if (othersPrice < myPrice || (othersPrice === myPrice && playerIndex > k)) { \n";
    functionString += "result = 0; \n";
    functionString += "}}} return result;";
    calcSell[i] = new Function("playerIndex", functionString);
    var gameCopy = game;
    var sell = { calculationFunction: calcSell[i].bind(gameCopy) };
    sell.name = "sellToCustomer" + j;
    game.addPlayerVariable(sell);
}
// Problem by initialisation or the sellToCostumer variables. Therefore first try with hard code: 3 players and 10 customers.
/*gameCopy.calculateChangeCosts = function (game, customerIndex, currentRoundIndex, playerIndex) {
 var changeCosts = game.getParameter("changeCosts");
 if (cr === 0) {
 if (customerIndex < 3 && playerIndex === 0) {
 changeCosts = 0;
 } else if (customerIndex >= 3 && customerIndex < 6 && playerIndex === 1) {
 changeCosts = 0;
 } else if (customerIndex >= 6 && customerIndex < 10 && playerIndex === 2) {
 changeCosts = 0;
 }
 } else {
 if (game.get("sellToCustomer" + (customerIndex + 1), cr - 1, playerIndex) === 1) {
 changeCosts = 0;
 }
 }
 return changeCosts;
 };*/
// Here is the indirect initialisation for the sellToCustomer variables included and the caltulation is independent of the
// 'numberOfCustomers' and the 'numberOfPlayers'.
// The actual initialisation shall represent a mature market with almost equal market shares for each player.
gameCopy.calculateChangeCosts = function (game, customerIndex, currentRoundIndex, playerIndex) {
    var changeCosts = game.getParameter("changeCosts");
    var n = game.getNumberOfPlayers();
    var m = game.getParameter("numberOfCustomers");
    var customersPerPlayer = m / n;
    var rest = m - customersPerPlayer;
    //In cr === 0 is the indirect initialisation for the sellToCustomer variables included by setting the 'changeCosts'.
    if (cr === 0) {
        //First sort the same number of customers to each player.
        if (customerIndex < customersPerPlayer && playerIndex === 0) {
            changeCosts = 0;
        }
        for (var i = 0; i < n; i++) {
            var ci1 = (i + 1) * customersPerPlayer;
            var ci2 = (i + 2) * customersPerPlayer;
            var j = i + 1;
            if (customerIndex >= ci1 && customerIndex < ci2 && playerIndex === j) {
                changeCosts = 0;
            }
        }
        // If not all customers can be sorted in a fair way to the players, there is a 'rest' of customers which is smaller than
        //  the 'numberOfPlayers'. These customers are sorted equaly to the players with the higher index numbers.
        for (var i = 0; i < rest; i++) {
            var j = i + 1;
            var player = n - i;
            var ci = customersPerPlayer * n + j;
            if (playerIndex === player && customerIndex === ci) {
                changeCosts = 0;
            }
        }
    }    //For all other rounds, see here the conditions for the 'changeCosts'.
    else {
        if (game.get("sellToCustomer" + (customerIndex + 1), cr - 1, playerIndex) === 1) {
            changeCosts = 0;
        }
    }
    return changeCosts;
};
/*
 Profit per period and cummulative profit:
 */
function scoreFunction(playerIndex) {
    var result = Number.MIN_VALUE;
    var cr = game.getCurrentRound();
    // for all customers
    for (var i = 0; i < game.getParameter("numberOfCustomers"); i++) {
        var z = i + 1;
        var priceForCust = game.get("priceForCustomer" + z, cr, playerIndex);
        var soldToCust = game.get("sellToCustomer" + z, cr, playerIndex);
        result = result + (priceForCust - game.getParameter("marginalCosts")) * game.get("demandPerCustomer", cr) * soldToCust;
    }
    result = result - game.getParameter("fixCosts");
    // only two numbers after the decimal point
    result = Math.round(result * 100) / 100;
    return result;
}
var accScoreChart = {
    caption: "Cumulative profit",
    type: "columnChart",
    unit: "monetary unit",
    xInit: new Date().getFullYear(),
    xIncrement: 1
};
game.addScore(scoreFunction, accScoreChart);