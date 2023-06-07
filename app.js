const assert = require('assert');
const logger = require('./lib/logger');
const express = require('express');
const app = express();
const helmet = require('helmet');
const nocache = require('nocache');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const passport = require('passport');
const routes = require('./lib/routes');

assert.ok(process.env.JAMBONES_MYSQL_HOST &&
  process.env.JAMBONES_MYSQL_USER &&
  process.env.JAMBONES_MYSQL_PASSWORD &&
  process.env.JAMBONES_MYSQL_DATABASE, 'missing JAMBONES_MYSQL_XXX env vars');
if (process.env.JAMBONES_REDIS_SENTINELS) {
  assert.ok(process.env.JAMBONES_REDIS_SENTINEL_MASTER_NAME,
    'missing JAMBONES_REDIS_SENTINEL_MASTER_NAME env var, JAMBONES_REDIS_SENTINEL_PASSWORD env var is optional');
} else {
  assert.ok(process.env.JAMBONES_REDIS_HOST, 'missing JAMBONES_REDIS_HOST env var');
}
assert.ok(process.env.JAMBONES_TIME_SERIES_HOST, 'missing JAMBONES_TIME_SERIES_HOST env var');
assert.ok(process.env.ENCRYPTION_SECRET || process.env.JWT_SECRET, 'missing ENCRYPTION_SECRET env var');
assert.ok(process.env.JWT_SECRET, 'missing JWT_SECRET env var');

const {
  queryCdrs,
  queryCdrsSP,
  queryAlerts,
  queryAlertsSP,
  writeCdrs,
  writeAlerts,
  AlertType
} = require('@jambonz/time-series')(
  logger, process.env.JAMBONES_TIME_SERIES_HOST
);
const {
  retrieveCall,
  deleteCall,
  listCalls,
  listSortedSets,
  purgeCalls,
  retrieveSet,
  addKey,
  retrieveKey,
  deleteKey,
  incrKey,
  JAMBONES_REDIS_SENTINELS
} = require('./lib/helpers/realtimedb-helpers');
const {
  getTtsVoices,
  getTtsSize,
  purgeTtsCache
} = require('@jambonz/speech-utils')(JAMBONES_REDIS_SENTINELS || {
  host: process.env.JAMBONES_REDIS_HOST,
  port: process.env.JAMBONES_REDIS_PORT || 6379
}, logger);
const {
  lookupAppBySid,
  lookupAccountBySid,
  lookupAccountByPhoneNumber,
  lookupAppByPhoneNumber,
  lookupCarrierBySid,
  lookupSipGatewayBySid,
  lookupSmppGatewayBySid
} = require('@jambonz/db-helpers')({
  host: process.env.JAMBONES_MYSQL_HOST,
  user: process.env.JAMBONES_MYSQL_USER,
  port: process.env.JAMBONES_MYSQL_PORT || 3306,
  password: process.env.JAMBONES_MYSQL_PASSWORD,
  database: process.env.JAMBONES_MYSQL_DATABASE,
  connectionLimit: process.env.JAMBONES_MYSQL_CONNECTION_LIMIT || 10
}, logger);
const PORT = process.env.HTTP_PORT || 3000;
const authStrategy = require('./lib/auth')(logger, retrieveKey);
const {delayLoginMiddleware} = require('./lib/middleware');

passport.use(authStrategy);

app.locals = app.locals || {};
app.locals = {
  ...app.locals,
  logger,
  retrieveCall,
  deleteCall,
  listCalls,
  listSortedSets,
  purgeCalls,
  retrieveSet,
  addKey,
  incrKey,
  retrieveKey,
  deleteKey,
  getTtsVoices,
  getTtsSize,
  purgeTtsCache,
  lookupAppBySid,
  lookupAccountBySid,
  lookupAccountByPhoneNumber,
  lookupAppByPhoneNumber,
  lookupCarrierBySid,
  lookupSipGatewayBySid,
  lookupSmppGatewayBySid,
  queryCdrs,
  queryCdrsSP,
  queryAlerts,
  queryAlertsSP,
  writeCdrs,
  writeAlerts,
  AlertType
};

const unless = (paths, middleware) => {
  return (req, res, next) => {
    if (paths.find((path) => req.path.startsWith(path))) return next();
    return middleware(req, res, next);
  };
};

const limiter = rateLimit({
  windowMs: (process.env.RATE_LIMIT_WINDOWS_MINS || 5) * 60 * 1000, // 5 minutes
  max: process.env.RATE_LIMIT_MAX_PER_WINDOW || 600, // Limit each IP to 600 requests per `window`
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

if (process.env.JAMBONES_TRUST_PROXY) {
  const proxyCount = parseInt(process.env.JAMBONES_TRUST_PROXY);
  if (!isNaN(proxyCount) && proxyCount > 0) {
    logger.info(`setting trust proxy to ${proxyCount} and mounting endpoint /ip`);
    app.set('trust proxy', proxyCount);
    app.get('/ip', (req, res) => {
      logger.info({headers: req.headers}, 'received GET /ip');
      res.send(req.ip);
    });
  }
}
app.use(limiter);
app.use(helmet());
app.use(helmet.hidePoweredBy());
app.use(nocache());
app.use(passport.initialize());
app.use(cors());
app.use(express.urlencoded({extended: true}));
app.use(delayLoginMiddleware);
app.use(unless(['/stripe'], express.json()));
app.use('/v1', unless(
  [
    '/register',
    '/forgot-password',
    '/signin',
    '/login',
    '/messaging',
    '/outboundSMS',
    '/AccountTest',
    '/InviteCodes',
    '/PredefinedCarriers'
  ], passport.authenticate('bearer', {session: false})));
app.use('/', routes);
app.use((err, req, res, next) => {
  logger.error(err, 'burped error');
  res.status(err.status || 500).json({
    msg: err.message
  });
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
