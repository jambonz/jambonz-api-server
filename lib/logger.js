const opts = {
  level: process.env.JAMBONES_LOGLEVEL || 'info'
};
const pino = require('pino');
const logger = pino(opts);

module.exports = logger;
