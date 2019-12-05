const Strategy = require('passport-http-bearer').Strategy;
const {getMysqlConnection} = require('../db');
const sql = `
  SELECT *
  FROM api_keys
  WHERE api_keys.token = ?`;

function makeStrategy(logger) {
  return new Strategy(
    function(token, done) {
      logger.info(`validating with token ${token}`);
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
          const scope = [];
          if (results[0].account_sid === null && results[0].service_provider_sid === null) {
            scope.push.apply(scope, ['admin', 'service_provider', 'account']);
          }
          else if (results[0].service_provider_sid) {
            scope.push.apply(scope, ['service_provider', 'account']);
          }
          else {
            scope.push('account');
          }

          const user = {
            account_sid: results[0].account_sid,
            service_provider_sid: results[0].service_provider_sid,
            hasScope: (s) => scope.includes(s),
            hasAdminAuth: scope.length === 3,
            hasServiceProviderAuth: scope.includes('service_provider') && !scope.includes('admin'),
            hasAccountAuth: scope.includes('account') && !scope.includes('service_provider')
          };
          logger.info(user, `successfully validated with scope ${scope}`);
          return done(null, user, {scope});
        });
      });
    });
}

module.exports = makeStrategy;
