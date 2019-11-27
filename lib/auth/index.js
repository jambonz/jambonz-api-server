const Strategy = require('passport-http-bearer').Strategy;
const {getMysqlConnection} = require('../db');
const sql = `
  SELECT api_keys.uuid, accounts.uuid
  FROM api_keys
  LEFT JOIN accounts
  ON api_keys.account_id = accounts.id`;

function makeStrategy(logger) {
  return new Strategy(
    function(token, done) {
      logger.info(`validating with token ${token}`);
      getMysqlConnection((err, conn) => {
        if (err) {
          logger.error(err, 'Error retrieving mysql connection');
          return done(err);
        }
        conn.query({sql, nestTables: '_'}, [token], (err, results, fields) => {
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
          return done(null,
            {accountSid: results[0].accounts_uuid},
            {scope: results[0].accounts_uuid ? ['user'] : ['admin']});
        });
      });
    });
}

module.exports = makeStrategy;
