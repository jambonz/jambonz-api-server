const router = require('express').Router();
const {getMysqlConnection} = require('../../db');
const {verifyPassword} = require('../../utils/password-utils');

const retrieveSql = 'SELECT * from users where name = ?';
const tokenSql = 'SELECT token from api_keys where account_sid IS NULL AND service_provider_sid IS NULL';


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
    conn.query(retrieveSql, [username], async(err, results) => {
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
      const isCorrect = await verifyPassword(results[0].hashed_password, password);
      if (!isCorrect) return res.sendStatus(403);

      const force_change = !!results[0].force_change;

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
          res.json({user_sid: results[0].user_sid, force_change, token: tokenResults[0].token});
        });
      });
    });
  });
});


module.exports = router;
