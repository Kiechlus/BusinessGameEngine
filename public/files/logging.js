'use strict';

/*
Winston is a famous logging library for node.

In order to install it, you go to the root of the integration
test folder and type in the console: npm install winston --save
The save options means, that the dependency is automatically
written to the package.json file.
 */

/*
This is how the module is loaded in standard node.js.
 */
const winston = require('winston');

/*
But intern uses a different (AMD) module loader.
Here it looks like this:
 */
define([
  'intern/dojo/node!winston',
], function (winston) {

});

/*
Initialize the logger. There are more options and stuff to change,
this is just copied form stackoverflow.
 */
const logger = new (winston.Logger)({
  transports: [
    new (winston.transports.Console)({ json: false, timestamp: false }),
    // Here we can specify the path of the log file
    new winston.transports.File({ filename: __dirname + '/debug.log', json: true, timestamp: false })
  ],
  exceptionHandlers: [
    new (winston.transports.Console)({ json: false, timestamp: true }),
    new winston.transports.File({ filename: __dirname + '/exceptions.log', json: false })
  ],
  exitOnError: false
});

/*
Set the logging level.
 */
logger.level = 'debug';
//logger.level = 'info';

/*
The actual logging is done like this:
 */
logger.debug('This is some logging message on debug level.');
logger.info('This is some logging message on info level.');


/*
This is a hack so that console.log will also go to the log files...
Not sure if we need it.
 */
console.log = function () {
  logger.debug(util.format.apply(null, arguments));
  process.stdout.write(util.format.apply(null, arguments) + '\n');
};
console.dir = console.log;
console.error = function () {
  logger.error(util.format.apply(null, arguments));
  process.stderr.write(util.format.apply(null, arguments) + '\n');
};