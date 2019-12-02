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
          logger.info(results, 'api key lookup');
          const user = {
            account_sid: results[0].account_sid,
            service_provider_sid: results[0].service_provider_sid,
            isAdmin: results[0].account_sid === null && results[0].service_provider_sid === null,
            isServiceProvider: results[0].service_provider_sid !== null,
            isUser: results[0].account_sid != null
          };
          const scope = [];
          if (user.isAdmin) scope.push('admin');
          else if (user.isServiceProvider) scope.push('service_provider');
          else scope.push('user');
          logger.info(user, `successfully validated with scope ${scope}`);
          return done(null, user, {scope});
        });
      });
    });
}

module.exports = makeStrategy;
