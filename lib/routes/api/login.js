const router = require('express').Router();
const crypto = require('crypto');
const {getMysqlConnection} = require('../../db');

const retrieveSql = 'SELECT * from users where name = ?';
const tokenSql = 'SELECT token from api_keys where account_sid IS NULL AND service_provider_sid IS NULL';

const sha512 = function(password, salt) {
  const hash = crypto.createHmac('sha512', salt); /** Hashing algorithm sha512 */
  hash.update(password);
  var value = hash.digest('hex');
  return {
    salt:salt,
    passwordHash:value
  };
};

router.post('/', (req, res) => {
  const logger = req.app.locals.logger;
  const {username, password} = req.body;
  if (!username || !password) {
    logger.info('Bad POST to /login is missing username or password');
    return res.sendStatus(400);
  }

  getMysqlConnection((err, conn) => {
    if (err) {
      logger.error({err}, 'Error getting db connection');
      return res.sendStatus(500);
    }
    conn.query(retrieveSql, [username], (err, results) => {
      conn.release();
      if (err) {
        logger.error({err}, 'Error getting db connection');
        return res.sendStatus(500);
      }
      if (0 === results.length) {
        logger.info(`Failed login attempt for user ${username}`);
        return res.sendStatus(403);
      }

      logger.info({results}, 'successfully retrieved account');
      const salt = results[0].salt;
      const trueHash = results[0].hashed_password;
      const forceChange = results[0].force_change;

      const {passwordHash} = sha512(password, salt);
      if (trueHash !== passwordHash) return res.sendStatus(403);

      if (forceChange) return res.json({user_sid: results[0].user_sid, force_change: true});

      getMysqlConnection((err, conn) => {
        if (err) {
          logger.error({err}, 'Error getting db connection');
          return res.sendStatus(500);
        }
        conn.query(tokenSql, (err, tokenResults) => {
          conn.release();
          if (err) {
            logger.error({err}, 'Error getting db connection');
            return res.sendStatus(500);
          }
          if (0 === tokenResults.length) {
            logger.error('Database has no admin token provisioned...run reset_admin_password');
            return res.sendStatus(500);
          }
          res.json({user_sid: results[0].user_sid, token: tokenResults[0].token});
        });
      });
    });
  });
});


module.exports = router;
