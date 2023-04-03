const router = require('express').Router();
//const debug = require('debug')('jambonz:api-server');
const { promisePool } = require('../../db');
const { verifyPassword } = require('../../utils/password-utils');
const { cacheClient, delayClient } = require('../../helpers');
const jwt = require('jsonwebtoken');
const sysError = require('../error');

const validateRequest = (req, res) => {
  const { email, password } = req.body || {};
  /* check required properties are there */
  if (!email || !password) {
    return false;
  }
  return true;
};

router.post('/', async(req, res) => {
  const { logger, retrieveKey } = req.app.locals;
  const { email, password, link } = req.body;
  let user;

  try {
    if (link) {
      const key = `reset-link:${link}`;
      const user_sid = await retrieveKey(key);
      logger.debug({ user_sid }, 'retrieved user from link');
      if (!user_sid) {
        return await delayClient.send({
          type: 'status',
          data: 403,
          delay: 198,
          res
        });
      }
      const [r] = await promisePool.query('SELECT * from users WHERE user_sid = ?', user_sid);
      if (0 === r.length) {
        return await delayClient.send({
          type: 'status',
          data: 404,
          delay: 100,
          res
        });
      }
      user = r[0];
    }
    else {
      const isValid = validateRequest(req, res);

      if (!isValid) {
        return await delayClient.send({
          type: 'status',
          data: 400,
          delay: 199,
          res
        });
      }

      const [r] = await promisePool.query(
        'SELECT * from users WHERE email = ? AND provider=\'local\' AND email_validated=1', email);
      if (0 === r.length) {
        return await delayClient.send({
          type: 'status',
          data: 404,
          delay: 190,
          res
        });
      }
      user = r[0];

      //debug(`password presented is ${password} and hashed_password in db is ${user.hashed_password}`);
      const isCorrect = await verifyPassword(user.hashed_password, password);
      if (!isCorrect) {
        return await delayClient.send({
          type: 'status',
          data: 403,
          delay: 150,
          res
        });
      }
    }
    const {
      user_sid,
      name,
      account_sid,
      phone,
      force_change,
      provider,
      provider_userid,
      scope,
      phone_validated,
      email_validated
    } = user || {};

    logger.debug({ user }, 'signin: retrieved user');

    const accountData = {
      is_active: null,
      tutorial_completion: null,
      pristine: false
    };

    if (account_sid) {
      const [a] = await promisePool.query('SELECT * from accounts WHERE account_sid = ?', account_sid);
      if (a.length !== 1) {
        return await delayClient.send({
          type: 'status',
          data: 404,
          delay: 120,
          res
        });
      }

      accountData.is_active = !!a[0].is_active;
      accountData.tutorial_completion = a[0].tutorial_completion;
    }

    const userProfile = Object.assign({}, {
      user_sid,
      name,
      email,
      phone,
      account_sid,
      force_change: !!force_change,
      provider,
      provider_userid,
      scope: scope,
      phone_validated: !!phone_validated,
      email_validated: !!email_validated
    },
    accountData);

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

    await delayClient.send({
      type: 'json',
      data: { jwt: token, ...userProfile },
      delay: 100,
      res
    });

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
