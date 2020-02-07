const config = require('config');
const opts = Object.assign({
  timestamp: () => {return `, "time": "${new Date().toISOString()}"`;}
}, config.get('logging'));
const logger = require('pino')(opts);
const express = require('express');
const app = express();
const cors = require('cors');
const passport = require('passport');
const authStrategy = require('./lib/auth')(logger);
const routes = require('./lib/routes');
const {
  retrieveCall,
  deleteCall,
  listCalls,
  purgeCalls
} = require('jambonz-realtimedb-helpers')(config.get('redis'), logger);
const PORT = process.env.HTTP_PORT || 3000;

passport.use(authStrategy);

app.locals = app.locals || {};
Object.assign(app.locals, {
  logger,
  retrieveCall,
  deleteCall,
  listCalls,
  purgeCalls
});

app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use('/v1', passport.authenticate('bearer', { session: false }));
app.use('/', routes);
app.use((err, req, res, next) => {
  logger.error(err, 'burped error');
  res.status(err.status || 500).json({msg: err.message});
});
logger.info(`listening for HTTP traffic on port ${PORT}`);
app.listen(PORT);

// purge old calls from active call set every 10 mins
async function purge() {
  try {
    const count = await purgeCalls();
    logger.info(`purged ${count} calls from realtimedb`);
  } catch (err) {
    logger.error(err, 'Error purging calls');
  }
  setTimeout(purge, 10 * 60 * 1000);
}
purge();

module.exports = app;
