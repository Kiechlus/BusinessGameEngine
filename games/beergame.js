/* 
 Beer distribution game for 4 players with different roles (Retailer, Wholesaler, Distributor, Factory).
 "Role-behaviour" is not yet implemented, maybe in version 2.
 Therefore: Player 1 --> Retailer (R), Player 2 --> Wholesaler (W), Player 3 --> Distributor (D), Player 4 --> Factory (F)
 */
game.addParameter("maxRounds", 30, [
    ">=1",
    "%1===0"
]);
// show more to players to avoid horizon effects
game.addParameter("minPlayers", 4, ["===4"]);
game.addParameter("maxPlayers", 4, ["===4"]);
game.addParameter("roundTimeOut", 90, [
    ">=15",
    "%1===0"
]);
game.addParameter("orderReceivingDelay", 1, [
    ">=0",
    "%1===0"
]);
// 1 round (=1 week)
game.addParameter("shipping/productionDelay", 4, [
    ">=1",
    "%1===0"
]);
// 4 weeks
game.addParameter("inventoryHoldingCosts", 0.5, [">0"]);
// 0.5$ per case per week
game.addParameter("backlogCosts", 1, [">0"]);
// 1$ per case per week
/*
 Order (cases/week) input variable
 */
var order = {
    name: "orders",
    initialValue: 4,
    textField: {
        type: "number",
        default: 6,
        validation: [
            ">=0",
            "%1===0"
        ]
    },
    calculationFunction: orderBot
};
var orderChart = {
    caption: "Beer orders",
    type: "lineChart",
    unit: "cases of beer",
    xInit: game.utils.getWeekNumber(new Date()),
    xIncrement: 1
};
game.addInputVariable(order, orderChart);
function orderBot(playerIndex) {
    var result = Number.MIN_VALUE;
    // as described in Sterman's Paper: the first four rounds everybody orders 4 cases
    var cr = game.getCurrentRound();
    if (cr < 4) {
        result = 4;
    }    // after 4 rounds the players can order as they want
    else if (cr >= 4) {
        result = game.math.randomInt(6, 20);
    }
    return result;
}
/*
 Collective and individual score functions.
 Aim of the players: Minimize the total (collective) cost of
 the whole beer distributing organisation while only having
 local information about the individual costs (the costs for
 backlog and inventory in each round).
 --> costs = score are a negative number.
 */
function scoreFunction(playerIndex) {
    var result = Number.MAX_VALUE;
    var cr = game.getCurrentRound();
    result = game.get("totalCost", cr, playerIndex);
    return result;
}
var totalCostss = {
    caption: "Total cost",
    type: "columnChart",
    unit: "Euros",
    xInit: game.utils.getWeekNumber(new Date()),
    xIncrement: 1
};
game.addScore(scoreFunction, totalCostss);
function collectiveScoreFunction() {
    var result = 0;
    var cr = game.getCurrentRound();
    for (var i = 0; i < game.getNumberOfPlayers(); i++) {
        result += Number(game.get("roundScore", cr, i));
    }
    return result;
}
game.addCollectiveScore(collectiveScoreFunction);
/*
 Customer demand (cases/week) variable
 */
var customerDemand = {
    name: "customerDemand",
    initialValue: 4,
    calculationFunction: getCustDemand,
    validation: [
        ">=0",
        "%1===0"
    ]
};
game.addRoundVariable(customerDemand);
function getCustDemand() {
    var result = Number.MIN_VALUE;
    var cr = game.getCurrentRound();
    // "The first four weeks of play are used to familiarize the subjects with the mechanics..." of the game
    if (cr >= 0 && cr <= 3) {
        result = 4;
    }    // "There is an unannounced, one-time increase in customer demand to eight cases per week in week 5"
    else if (cr > 3) {
        result = 8;
    }
    return result;
}
/*
 Incoming beer cases from the next bigger in the supply chain.
 */
var incomingInventory = {
    name: "incomingInventory",
    initialValue: 4,
    calculationFunction: calcIncoming,
    validation: [
        ">=0",
        "%1===0"
    ]
};
game.addPlayerVariable(incomingInventory);
function calcIncoming(playerIndex) {
    // playerIndex always starts at 0 (for Player 1)
    var result = Number.MIN_VALUE;
    var cr = game.getCurrentRound();
    var incomingRoundNumber = cr - game.getParameter("shipping/productionDelay");
    // R, W, D incoming inventory is defined by outgoing inventory of the next bigger in the supply chain (after shipping delay)
    if (playerIndex < 3) {
        result = game.get("outgoingInventory", incomingRoundNumber, playerIndex + 1);
    }    // Factory (Player 4): Incoming is what Factory ordered to produce 
    else if (playerIndex === 3) {
        result = game.get("orders", incomingRoundNumber, 3);
    }
    return result;
}
/*
 Total orders are incoming orders from the next smaller in the supply chain
 plus an eventual backlog from last week.
 */
var totalOrders = {
    name: "totalOrders",
    calculationFunction: calcTotalOrders,
    validation: [
        ">=0",
        "%1===0"
    ]
};
game.addPlayerVariable(totalOrders);
function calcTotalOrders(playerIndex) {
    var result = Number.MIN_VALUE;
    var cr = game.getCurrentRound();
    var orderRoundNumber = cr - game.getParameter("orderReceivingDelay");
    var ordersFromDownstream = Number.MIN_VALUE;
    // R receives orders from customers    
    if (playerIndex === 0) {
        ordersFromDownstream = game.get("customerDemand", orderRoundNumber);
    }    // W,D,F receive orders from the next smaller in the supply chain
    else if (playerIndex > 0) {
        ordersFromDownstream = game.get("orders", orderRoundNumber, playerIndex - 1);
    }
    // Total orders are the incoming orders + an eventual backlog from last week
    var backlogLastWeek = Number.MIN_VALUE;
    var inventoryLastWeek = game.get("inventory", cr - 1, playerIndex);
    if (inventoryLastWeek < 0) {
        backlogLastWeek = -1 * inventoryLastWeek;
    } else if (inventoryLastWeek >= 0) {
        backlogLastWeek = 0;
    }
    result = backlogLastWeek + ordersFromDownstream;
    return result;
}
/*
 Outgoing beer cases which are shipped to the next smaller in the supply chain.
 */
var outgoingInventory = {
    name: "outgoingInventory",
    initialValue: 4,
    calculationFunction: calcOutgoing,
    validation: [
        ">=0",
        "%1===0"
    ]
};
game.addPlayerVariable(outgoingInventory);
function calcOutgoing(playerIndex) {
    var result = Number.MIN_VALUE;
    var cr = game.getCurrentRound();
    var incoming = game.get("incomingInventory", cr, playerIndex);
    var inventoryLastWeek = game.get("inventory", cr - 1, playerIndex);
    var totalOrders = game.get("totalOrders", cr, playerIndex);
    // calculate number of outgoing beer cases. 
    if (inventoryLastWeek < 0) {
        result = Math.min(incoming, totalOrders);
    } else if (inventoryLastWeek >= 0) {
        result = Math.min(inventoryLastWeek + incoming, totalOrders);
    }
    return result;
}
/*
 A negative inventory means backlog.
 */
var inventory = {
    name: "inventory",
    initialValue: 12,
    calculationFunction: calcInventory,
    validation: ["%1===0"]
};
var inventChart = {
    caption: "Inventory",
    type: "columnChart",
    unit: "Cases of beer",
    xInit: game.utils.getWeekNumber(new Date()),
    xIncrement: 1
};
game.addPlayerVariable(inventory, inventChart);
function calcInventory(playerIndex) {
    var result = -0.5;
    var cr = game.getCurrentRound();
    var totalOrders = game.get("totalOrders", cr, playerIndex);
    var incoming = game.get("incomingInventory", cr, playerIndex);
    var inventoryLastWeek = game.get("inventory", cr - 1, playerIndex);
    if (inventoryLastWeek < 0) {
        result = incoming - totalOrders;    // backlog of last week is already in the total orders
    } else if (inventoryLastWeek >= 0) {
        result = inventoryLastWeek + incoming - totalOrders;
    }
    return result;
}
/*
 Backlog costs.
 Costs are a negative number. --> the bigger the number, the better.
 */
var backlogCost = {
    name: "backlogCost",
    initialValue: 0,
    calculationFunction: calcBacklogCost,
    validation: ["<=0"]
};
var backlogChart = {
    caption: "Backlog costs",
    type: "columnChart",
    unit: "Euros",
    xInit: game.utils.getWeekNumber(new Date()),
    xIncrement: 1
};
game.addPlayerVariable(backlogCost, backlogChart);
function calcBacklogCost(playerIndex) {
    var result = 0;
    var cr = game.getCurrentRound();
    var inventory = game.get("inventory", cr, playerIndex);
    if (inventory < 0) {
        result = game.getParameter("backlogCosts") * inventory;
    }
    return result;
}
/*
 Inventory holding costs.
 Costs are a negative number.
 */
var invHolding = {
    name: "inventoryHoldingCost",
    initialValue: 0,
    calculationFunction: calcInvHolding,
    validation: ["<=0"]
};
var invHoldingChart = {
    caption: "Inventory holding costs",
    type: "columnChart",
    unit: "Euros",
    xInit: game.utils.getWeekNumber(new Date()),
    xIncrement: 1
};
game.addPlayerVariable(invHolding, invHoldingChart);
function calcInvHolding(playerIndex) {
    var result = 0;
    var cr = game.getCurrentRound();
    var inventory = game.get("inventory", cr, playerIndex);
    if (inventory > 0) {
        result = game.getParameter("inventoryHoldingCosts") * -1 * inventory;
    }
    return result;
}
/*
 Total costs = backlog costs + inventory holding costs
 Costs are a negative number.
 */
var totalCost = {
    name: "totalCost",
    initialValue: 0,
    calculationFunction: calcTotalCost,
    validation: ["<=0"]
};
game.addPlayerVariable(totalCost);
function calcTotalCost(playerIndex) {
    var result = Number.MAX_VALUE;
    var cr = game.getCurrentRound();
    var bc = game.get("backlogCost", cr, playerIndex);
    var ihc = game.get("inventoryHoldingCost", cr, playerIndex);
    result = bc + ihc;
    return result;
}