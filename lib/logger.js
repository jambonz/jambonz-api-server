const opts = Object.assign({
  timestamp: () => {
    return `, "time": "${new Date().toISOString()}"`;
  }
}, {
  level: process.env.JAMBONES_LOGLEVEL || 'info'
});

const logger = require('pino')(opts);

module.exports = logger;
