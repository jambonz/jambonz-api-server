const router = require('express').Router();
//const debug = require('debug')('jambonz:api-server');
const {DbErrorBadRequest} = require('../../utils/errors');
const {promisePool} = require('../../db');
const {verifyPassword} = require('../../utils/password-utils');
const {cacheClient} = require('../../helpers');
const jwt = require('jsonwebtoken');
const sysError = require('../error');

const validateRequest = async(req) => {
  const {email, password} = req.body || {};

  /* check required properties are there */
  if (!email || !password) throw new DbErrorBadRequest('missing email or password');
};

router.post('/', async(req, res) => {
  const {logger, retrieveKey} = req.app.locals;
  const {email, password, link} = req.body;
  let user;

  try {
    if (link) {
      const key = `reset-link:${link}`;
      const user_sid = await retrieveKey(key);
      logger.debug({user_sid}, 'retrieved user from link');
      if (!user_sid) {
        return res.sendStatus(403);
      }
      const [r] = await promisePool.query('SELECT * from users WHERE user_sid = ?', user_sid);
      if (0 === r.length) return res.sendStatus(404);
      user = r[0];
    }
    else {
      validateRequest(req);
      const [r] = await promisePool.query(
        'SELECT * from users WHERE email = ? AND provider=\'local\' AND email_validated=1', email);
      if (0 === r.length) return res.sendStatus(404);
      user = r[0];

      //debug(`password presented is ${password} and hashed_password in db is ${user.hashed_password}`);
      const isCorrect = await verifyPassword(user.hashed_password, password);
      if (!isCorrect) return res.sendStatus(403);
    }
    logger.debug({user}, 'signin: retrieved user');

    const [a] = await promisePool.query('SELECT * from accounts WHERE account_sid = ?', user.account_sid);
    if (a.length !== 1) throw new Error('database error - account not found for user');

    const userProfile = Object.assign({}, {
      user_sid: user.user_sid,
      name: user.name,
      email: user.email,
      phone: user.phone,
      account_sid: user.account_sid,
      force_change: !!user.force_change,
      provider: user.provider,
      provider_userid: user.provider_userid,
      scope: user.scope,
      phone_validated: !!user.phone_validated,
      email_validated: !!user.email_validated
    }, {
      is_active: !!a[0].is_active,
      tutorial_completion: a[0].tutorial_completion,
      pristine: false
    });

    const expiresIn = parseInt(process.env.JWT_EXPIRES_IN || 60) * 60;
    // generate a json web token for this session
    const token = jwt.sign({
      user_sid: userProfile.user_sid,
      account_sid: userProfile.account_sid
    }, process.env.JWT_SECRET, { expiresIn });

    logger.debug({
      user_sid: userProfile.user_sid,
      account_sid: userProfile.account_sid
    }, 'generated jwt');

    res.json({jwt: token, ...userProfile});

    /* Store jwt based on user_id after successful login */
    await cacheClient.set({
      redisKey: cacheClient.generateRedisKey('jwt', userProfile.user_sid, 'v2'),
      value: token,
      time: expiresIn,
    });

  } catch (err) {
    sysError(logger, res, err);
  }
});


module.exports = router;
