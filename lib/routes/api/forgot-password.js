const router = require('express').Router();
//const debug = require('debug')('jambonz:api-server');
const short = require('short-uuid');
const translator = short();
const {validateEmail, emailSimpleText} = require('../../utils/email-utils');
const {promisePool} = require('../../db');
const {cacheClient} = require('../../helpers');
const sysError = require('../error');
const { assert } = require('@jambonz/lamejs/src/js/common');
const sql = `SELECT * from users user 
LEFT JOIN accounts AS acc 
ON acc.account_sid = user.account_sid 
WHERE user.email = ?`;

function createOauthEmailText(provider) {
  return `Hi there!

  Someone (presumably you!) requested to reset their password.
  However, the account associated with this email is using oauth identification via ${provider},
  Please change your password through that provider, if you wish to.
  
  If you did not make this request, please delete this email.  No further action is required.
  
  Best,
  
  Jambonz support team`;
}

function createResetEmailText(link) {
  assert(process.env.APP_BASE_URL, 'process.env.APP_BASE_URL is missing');
  const baseUrl = process.env.APP_BASE_URL;

  return `Hi there!

  Someone (presumably you!) requested to reset their password.
  Please follow the link below to reset your password:
  
  ${baseUrl}/reset-password/${link}
  
  This link is valid for 1 hour only.
  If you did not make this request, please delete this email.  No further action is required.
  
  Best,
  
  Jambonz support team`;
}

router.post('/', async(req, res) => {
  const {logger, addKey} = req.app.locals;
  const {email} = req.body;

  let obj;
  try {
    if (!email || !validateEmail(email)) {
      return res.status(400).json({error: 'invalid or missing email'});
    }

    const [r] = await promisePool.query({sql, nestTables: true}, email);
    if (0 === r.length) {
      logger.info('user not found');
      return res.status(400).json({error: 'failed to reset your password'});
    }
    obj = r[0];
    if (!obj.user.is_active) {
      logger.info(obj.user.name, 'user is inactive');
      return res.status(400).json({error: 'failed to reset your password'});
    } else if (obj.acc.account_sid !== null && !obj.acc.is_active) {
      logger.info(obj.acc.account_sid, 'account is inactive');
      return res.status(400).json({error: 'failed to reset your password'});
    }
    res.sendStatus(204);
  } catch (err) {
    sysError(logger, res, err);
    return;
  }

  if (obj.user.provider !== 'local') {
    /* send email indicating they need to change via their oauth provider */
    emailSimpleText(logger, email, 'Reset password request', createOauthEmailText(obj.user.provider));

  }
  else {
    /* generate a link for this user to reset, send email */
    const link = translator.generate();
    const redisKey = cacheClient.generateRedisKey('reset-link', link);
    addKey(redisKey, obj.user.user_sid, 3600)
      .catch((err) => logger.error({err}, 'Error adding reset link to redis'));
    emailSimpleText(logger, email, 'Reset password request', createResetEmailText(link));
  }

  const redisKey = cacheClient.generateRedisKey('jwt', obj.user.user_sid, 'v2');
  await cacheClient.delete(redisKey);
});

module.exports = router;
