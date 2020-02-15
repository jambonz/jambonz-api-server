const assert = require('assert');
const opts = Object.assign({
  timestamp: () => {return `, "time": "${new Date().toISOString()}"`;}
}, {level: process.env.JAMBONES_LOGLEVEL || 'info'});
const logger = require('pino')(opts);
const express = require('express');
const app = express();
const cors = require('cors');
const passport = require('passport');
const authStrategy = require('./lib/auth')(logger);
const routes = require('./lib/routes');

assert.ok(process.env.JAMBONES_MYSQL_HOST &&
  process.env.JAMBONES_MYSQL_USER &&
  process.env.JAMBONES_MYSQL_PASSWORD &&
  process.env.JAMBONES_MYSQL_DATABASE, 'missing JAMBONES_MYSQL_XXX env vars');
assert.ok(process.env.JAMBONES_REDIS_HOST, 'missing JAMBONES_REDIS_HOST env var');
assert.ok(process.env.JAMBONES_CREATE_CALL_URL, 'missing JAMBONES_CREATE_CALL_URL env var');

const {
  retrieveCall,
  deleteCall,
  listCalls,
  purgeCalls
} = require('jambonz-realtimedb-helpers')({
  host: process.env.JAMBONES_REDIS_HOST || 'localhost',
  port: process.env.JAMBONES_REDIS_PORT || 6379
}, logger);
const {
  lookupApplicationBySid,
  lookupAccountBySid
} = require('jambonz-db-helpers')({
  host: process.env.JAMBONES_MYSQL_HOST,
  user: process.env.JAMBONES_MYSQL_USER,
  password: process.env.JAMBONES_MYSQL_PASSWORD,
  database: process.env.JAMBONES_MYSQL_DATABASE,
  connectionLimit: process.env.JAMBONES_MYSQL_CONNECTION_LIMIT || 10
}, logger);
const PORT = process.env.HTTP_PORT || 3000;

passport.use(authStrategy);

app.locals = app.locals || {};
Object.assign(app.locals, {
  logger,
  retrieveCall,
  deleteCall,
  listCalls,
  purgeCalls,
  lookupApplicationBySid,
  lookupAccountBySid
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
