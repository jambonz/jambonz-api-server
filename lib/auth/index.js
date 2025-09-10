const Strategy = require('passport-http-bearer').Strategy;
const {getMysqlConnection} = require('../db');
const debug = require('debug')('jambonz:api-server');
const {cacheClient} = require('../helpers');
const jwt = require('jsonwebtoken');
const sql = `
  SELECT *
  FROM api_keys
  WHERE api_keys.token = ?`;

function makeStrategy(logger) {
  return new Strategy(
    async function(token, done) {
      jwt.verify(token, process.env.JWT_SECRET, async(err, decoded) => {
        if (err) {
          if (err.name === 'TokenExpiredError') {
            logger.debug('jwt expired');
            return done(null, false);
          }
          /* its not a jwt obtained through login, check api keys */
          checkApiTokens(logger, token, done);
        }
        else {
          try {
            const {user_sid} = decoded;
            /* Valid jwt tokens are stored in redis by hashed user_id */
            const redisKey = cacheClient.generateRedisKey('jwt', user_sid, 'v2');
            const result = await cacheClient.get(redisKey);
            if (result === null) {
              debug(`result from searching for ${redisKey}: ${result}`);
              logger.info('jwt invalidated after logout');
              return done(null, false);
            }
            /* Reject the request if we receive an old token */
            if (result !== token) {
              logger.info('jwt was invalidated after login by another session');
              return done(null, false);
            }
          } catch (error) {
            debug(err);
            logger.info({err}, 'Error checking redis for jwt');
          }
          const { user_sid, service_provider_sid, account_sid, email,
            name, scope, permissions, is_view_only } = decoded;
          const user = {
            service_provider_sid,
            account_sid,
            user_sid,
            jwt: token,
            email,
            name,
            permissions,
            is_view_only,
            hasScope: (s) => s === scope,
            hasAdminAuth: scope === 'admin',
            hasServiceProviderAuth: scope === 'service_provider',
            hasAccountAuth: scope === 'account'
          };
          logger.debug({user}, 'successfully validated jwt');
          return done(null, user, {scope});
        }
      });
    }
  );
}

const checkApiTokens = (logger, token, done) => {
  getMysqlConnection((err, conn) => {
    if (err) {
      logger.error(err, 'Error retrieving mysql connection');
      return done(err);
    }
    conn.query(sql, [token], (err, results, fields) => {
      conn.release();
      if (err) {
        logger.error(err, 'Error querying for api key');
        return done(err);
      }
      if (0 == results.length) return done(null, false);
      if (results.length > 1) {
        logger.info(`api key ${token} exists in multiple rows of api_keys table!!`);
        return done(null, false);
      }

      // found api key
      let scope;
      //const scope = [];
      if (results[0].account_sid === null && results[0].service_provider_sid === null) {
        //scope.push.apply(scope, ['admin', 'service_provider', 'account']);
        scope = 'admin';
      }
      else if (results[0].service_provider_sid) {
        //scope.push.apply(scope, ['service_provider', 'account']);
        scope = 'service_provider';
      }
      else {
        //scope.push('account');
        scope = 'account';
      }

      const user = {
        account_sid: results[0].account_sid,
        service_provider_sid: results[0].service_provider_sid,
        hasScope: (s) => s === scope,
        hasAdminAuth: scope === 'admin',
        hasServiceProviderAuth: scope === 'service_provider',
        hasAccountAuth: scope === 'account'
      };
      logger.debug({user}, `successfully validated with scope ${scope}`);
      return done(null, user, {scope});
    });
  });
};

module.exports = makeStrategy;
