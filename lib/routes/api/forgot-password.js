const router = require('express').Router();
//const debug = require('debug')('jambonz:api-server');
const short = require('short-uuid');
const translator = short();
const {validateEmail, emailSimpleText} = require('../../utils/email-utils');
const {promisePool} = require('../../db');
const sysError = require('../error');
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
  const baseUrl = 'http://localhost:3001';

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
      return res.status(400).json({error: 'email does not exist'});
    }
    obj = r[0];
    if (!obj.acc.is_active) {
      return res.status(400).json({error: 'you may not reset the password of an inactive account'});
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
    addKey(`reset-link:${link}`, obj.user.user_sid, 3600)
      .catch((err) => logger.error({err}, 'Error adding reset link to redis'));
    emailSimpleText(logger, email, 'Reset password request', createResetEmailText(link));
  }
});

module.exports = router;
