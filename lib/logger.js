const opts = {
  level: process.env.JAMBONES_LOGLEVEL || 'info'
};
const pino = require('pino');
const logger = pino(opts, pino.destination(1, {sync: false}));

module.exports = logger;
