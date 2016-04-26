// Example game as described in the paper "A compiler for business simulations": 
// Towards business model development by yourselves" by K.Tsuda et al.
game.addParameter("maxRounds", 10, [
    "===10",
    "%1===0"
]);
game.addParameter("minPlayers", 3, [
    ">=2",
    "%1===0"
]);
game.addParameter("maxPlayers", 3, [
    "<=10",
    "%1===0"
]);
game.addParameter("roundTimeOut", 50, [
    ">=15",
    "%1===0"
]);
game.addParameter("ORDER_PRICE", 90);
game.addParameter("MINIMUM_PRICE", 50);
/*
 Input variable: SALES_PRICE
 */
var price = {
    name: "SALES_PRICE",
    textField: {
        type: "number",
        default: 120,
        validation: [
            ">=0",
            "<=1000"
        ]
    },
    calculationFunction: priceBot
};
game.addInputVariable(price);
function priceBot(playerIndex) {
    var result = Number.MIN_VALUE;
    result = game.math.randomInt(50, 1000);
    return result;
}
/*
 Round specific variable: DEMANDS
 */
var customerDemand = {
    name: "DEMANDS",
    calculationFunction: calcDemand,
    validation: [
        ">=0",
        "%1===0"
    ]
};
game.addRoundVariable(customerDemand);
function calcDemand() {
    var result = Number.MIN_VALUE;
    var cr = game.getCurrentRound();
    var demands = [
        497,
        1195,
        2447,
        4037,
        5406,
        6626,
        8177,
        9451,
        9945,
        10713
    ];
    result = demands[cr];
    return result;
}
/*
 An additional variable in order to faciliate the proportional calculation of NUMBER_OF_SALES (see below).
 */
var tmp = {
    name: "tmp",
    calculationFunction: calcTmp
};
game.addPlayerVariable(tmp);
function calcTmp(playerIndex) {
    var cr = game.getCurrentRound();
    return game.get("SALES_PRICE", cr, playerIndex) - game.getParameter("MINIMUM_PRICE");
}
/*
 Player specific variable: NUMBER_OF_SALES
 */
var sales = {
    name: "NUMBER_OF_SALES",
    calculationFunction: calcSales
};
game.addPlayerVariable(sales);
function calcSales(playerIndex) {
    var result = Number.MIN_VALUE;
    var cr = game.getCurrentRound();
    var DEMANDS = game.get("DEMANDS", cr);
    result = Math.round(game.math.inverseDistribution(playerIndex, DEMANDS, "tmp"));
    return result;
}
/*
 Player specific variable: PRICE_OF_PROCEED
 */
var popr = {
    name: "PRICE_OF_PROCEED",
    calculationFunction: calcPopr
};
game.addPlayerVariable(popr);
function calcPopr(playerIndex) {
    var result = Number.MIN_VALUE;
    var cr = game.getCurrentRound();
    var NUMBER_OF_SALES = game.get("NUMBER_OF_SALES", cr, playerIndex);
    var SALES_PRICE = game.get("SALES_PRICE", cr, playerIndex);
    result = SALES_PRICE * NUMBER_OF_SALES;
    return result;
}
/*
 Player specific variable: PRICE_OF_ORDER
 */
var poo = {
    name: "PRICE_OF_ORDER",
    calculationFunction: calcpoo
};
game.addPlayerVariable(poo);
function calcpoo(playerIndex) {
    var result = Number.MIN_VALUE;
    var cr = game.getCurrentRound();
    var NUMBER_OF_SALES = game.get("NUMBER_OF_SALES", cr, playerIndex);
    result = NUMBER_OF_SALES * game.getParameter("ORDER_PRICE");
    return result;
}
/*
 Player specific variable: AMOUNT_OF_PROFIT
 */
var aop = {
    name: "AMOUNT_OF_PROFIT",
    calculationFunction: calcaop
};
game.addPlayerVariable(aop);
function calcaop(playerIndex) {
    var result = Number.MIN_VALUE;
    var cr = game.getCurrentRound();
    var PRICE_OF_ORDER = game.get("PRICE_OF_ORDER", cr, playerIndex);
    var PRICE_OF_PROCEED = game.get("PRICE_OF_PROCEED", cr, playerIndex);
    result = PRICE_OF_PROCEED - PRICE_OF_ORDER;
    return result;
}
/*
 Player specific variable: AMOUNT_OF_DEPOSIT
 */
var aod = {
    name: "AMOUNT_OF_DEPOSIT",
    initialValue: -150000,
    calculationFunction: calcaod
};
game.addPlayerVariable(aod);
function calcaod(playerIndex) {
    var result = Number.MIN_VALUE;
    var cr = game.getCurrentRound();
    var depositLastYear = game.get("AMOUNT_OF_DEPOSIT", cr - 1, playerIndex);
    var AMOUNT_OF_PROFIT = game.get("AMOUNT_OF_PROFIT", cr, playerIndex);
    result = depositLastYear + AMOUNT_OF_PROFIT;
    return result;
}