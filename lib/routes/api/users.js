const router = require('express').Router();
const crypto = require('crypto');
const {getMysqlConnection} = require('../../db');

const retrieveSql = 'SELECT * from users where user_sid = ?';
const updateSql = 'UPDATE users set hashed_password = ?, salt = ?, force_change = false WHERE user_sid = ?';
const tokenSql = 'SELECT token from api_keys where account_sid IS NULL AND service_provider_sid IS NULL';

const genRandomString = (len) => {
  return crypto.randomBytes(Math.ceil(len / 2))
    .toString('hex') /** convert to hexadecimal format */
    .slice(0, len);   /** return required number of characters */
};

const sha512 = function(password, salt) {
  const hash = crypto.createHmac('sha512', salt); /** Hashing algorithm sha512 */
  hash.update(password);
  var value = hash.digest('hex');
  return {
    salt:salt,
    passwordHash:value
  };
};

const saltHashPassword = (userpassword) => {
  var salt = genRandomString(16); /** Gives us salt of length 16 */
  return sha512(userpassword, salt);
};

router.put('/:user_sid', (req, res) => {
  const logger = req.app.locals.logger;
  const {old_password, new_password} = req.body;
  if (!old_password || !new_password) {
    logger.info('Bad PUT to /Users is missing old_password or new password');
    return res.sendStatus(400);
  }

  getMysqlConnection((err, conn) => {
    if (err) {
      logger.error({err}, 'Error getting db connection');
      return res.sendStatus(500);
    }
    conn.query(retrieveSql, [req.params.user_sid], (err, results) => {
      conn.release();
      if (err) {
        logger.error({err}, 'Error getting db connection');
        return res.sendStatus(500);
      }
      if (0 === results.length) {
        logger.info(`Failed to find user with sid ${req.params.user_sid}`);
        return res.sendStatus(404);
      }

      logger.info({results}, 'successfully retrieved user');
      const old_salt = results[0].salt;
      const old_hashed_password = results[0].hashed_password;

      const {passwordHash} = sha512(old_password, old_salt);
      if (old_hashed_password !== passwordHash) return res.sendStatus(403);

      getMysqlConnection((err, conn) => {
        if (err) {
          logger.error({err}, 'Error getting db connection');
          return res.sendStatus(500);
        }
        const {salt, passwordHash} = saltHashPassword(new_password);
        conn.query(updateSql, [passwordHash, salt, req.params.user_sid], (err, r) => {
          conn.release();
          if (err) {
            logger.error({err}, 'Error getting db connection');
            return res.sendStatus(500);
          }
          if (0 === r.changedRows) {
            logger.error('Failed updating database with new password');
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
});


module.exports = router;
