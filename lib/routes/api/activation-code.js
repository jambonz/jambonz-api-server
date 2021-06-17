const router = require('express').Router();
const debug = require('debug')('jambonz:api-server');
const {DbErrorBadRequest} = require('../../utils/errors');
const {promisePool} = require('../../db');
const {validateEmail, emailSimpleText} = require('../../utils/email-utils');
const sysError = require('../error');
const sqlRetrieveUser = `SELECT * from users user
LEFT JOIN accounts AS account
ON user.account_sid = account.account_sid
WHERE user.user_sid = ?`;

const validateRequest = async(req, res) => {
  const payload = req.body || {};

  /* valid type */
  if (!['email', 'phone'].includes(payload.type)) {
    throw new DbErrorBadRequest(`invalid activation type: ${payload.type}`);
  }

  /* valid user? */
  const [rows] = await promisePool.query('SELECT * from users WHERE user_sid = ?',
    payload.user_sid);
  if (0 === rows.length) throw new DbErrorBadRequest('invalid user_sid');

  /* valid email? */
  if (payload.type === 'email' && !validateEmail(payload.value)) throw new DbErrorBadRequest('invalid email');

};

router.post('/', async(req, res) => {
  const logger = req.app.locals.logger;
  const {user_sid, type, code, value} = req.body;

  try {
    await validateRequest(req, res);

    const fields = type === 'email' ?
      ['email', 'email_validated', 'email_activation_code'] :
      ['phone', 'phone_validated', 'phone_activation_code'];
    const sql =
    `UPDATE users set ${fields[0]} = ?, ${fields[1]} = 0,  ${fields[2]} = ? WHERE user_sid = ?`;
    const [r] = await promisePool.execute(sql, [value, code, user_sid]);
    logger.debug({r}, 'Result from adding activation code');
    debug({r}, 'Result from adding activation code');

    if (process.env.NODE_ENV !== 'test') {
      if (type === 'email') {
        /* send code via email */
        const text = '';
        const subject = '';
        await emailSimpleText(logger, value, subject, text);
      }
      else {
        /* send code via SMS */
      }
    }
    res.sendStatus(204);
  } catch (err) {
    sysError(logger, res, err);
  }
});

router.put('/:code', async(req, res) => {
  const logger = req.app.locals.logger;
  const code = req.params.code;
  const {user_sid, type} = req.body;

  try {
    let activateAccount = false;
    let deactivateOldUsers = false;
    let account_sid;
    if (type === 'email') {
      /* check whether this is first-time activation of account during sign-up/register */
      const [r] = await promisePool.query({sql: sqlRetrieveUser, nestTables: true}, user_sid);
      logger.debug({r}, 'activationcode - selected user');
      if (r.length) {
        const {user, account} = r[0];
        account_sid = account.account_sid;
        const [otherUsers] = await promisePool.query('SELECT * from users WHERE account_sid = ? AND user_sid <> ?',
          [account_sid, user_sid]);
        logger.debug({otherUsers}, `activationcode - users other than ${user_sid}`);
        if (0 === otherUsers.length && user.provider === 'local' && !user.email_validated) {
          logger.debug('activationcode - activating account');
          activateAccount = true;
        }
        else if (otherUsers.length) {
          logger.debug('activationcode - adding new user for existing account');
          deactivateOldUsers = true;
        }
      }
    }
    const fields = type === 'email' ?
      ['email_validated', 'email_activation_code'] :
      ['phone_validated', 'phone_activation_code'];
    const sql = `UPDATE users set ${fields[0]} = 1, ${fields[1]} = NULL WHERE ${fields[1]} = ? AND user_sid = ?`;
    const [r] = await promisePool.execute(sql, [code, user_sid]);
    logger.debug({r}, 'Result from validating code');
    debug({r}, 'Result from validating code');

    if (activateAccount) {
      await promisePool.execute('UPDATE accounts SET is_active=1 WHERE account_sid = ?', [account_sid]);
    }
    else if (deactivateOldUsers) {
      const [r] = await promisePool.execute('DELETE FROM users WHERE account_sid = ? AND user_sid <> ?',
        [account_sid, user_sid]);
      logger.debug({r}, 'Result from deleting old/replaced users');
    }

    if (1 === r.affectedRows) return res.sendStatus(204);
    throw new DbErrorBadRequest('invalid user or activation code');
  } catch (err) {
    sysError(logger, res, err);
  }
});


module.exports = router;
