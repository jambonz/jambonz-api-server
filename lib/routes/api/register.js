const router = require('express').Router();
const debug = require('debug')('jambonz:api-server');
const {DbErrorBadRequest, DbErrorUnprocessableRequest} = require('../../utils/errors');
const {promisePool} = require('../../db');
const {doGithubAuth, doGoogleAuth, doLocalAuth} = require('../../utils/oauth-utils');
const {validateEmail, emailSimpleText} = require('../../utils/email-utils');
const {cacheClient} = require('../../helpers');
const { v4: uuid } = require('uuid');
const short = require('short-uuid');
const translator = short();
const jwt = require('jsonwebtoken');
const {setupFreeTrial, createTestCdrs, createTestAlerts} = require('./utils');
const {generateHashedPassword} = require('../../utils/password-utils');
const sysError = require('../error');

const insertUserSql = `INSERT into users 
(user_sid, account_sid, name, email, provider, provider_userid, email_validated, service_provider_sid) 
values (?, ?, ?, ?, ?, ?, 1, ?)`;
const insertUserLocalSql = `INSERT into users 
(user_sid, account_sid, name, email, email_activation_code, email_validated, provider,
hashed_password, service_provider_sid) 
values (?, ?, ?, ?, ?, 0, 'local', ?, ?)`;
const insertAccountSql = `INSERT into accounts 
(account_sid, service_provider_sid, name, is_active, webhook_secret, trial_end_date) 
values (?, ?, ?, ?, ?, CURDATE() + INTERVAL 21 DAY)`;
const insertWebookSql = `INSERT INTO webhooks (webhook_sid, url, method) 
VALUES (?, ?, ?)`;
const insertApplicationSql = `INSERT INTO applications 
(application_sid, account_sid, name, call_hook_sid, call_status_hook_sid, 
speech_synthesis_vendor, speech_synthesis_language, speech_synthesis_voice, 
speech_recognizer_vendor, speech_recognizer_language)
VALUES (?,?,?,?,?,?,?,?,?,?)`;
const queryRootDomainSql = `SELECT root_domain 
FROM service_providers 
WHERE service_providers.service_provider_sid = ?`;
const insertSignupHistorySql = `INSERT into signup_history
(email, name) 
values (?, ?)`;

const slackEmail = `Hi there and welcome to jambonz!

We are excited to have you on board. Feel free to join the community on Slack at https://joinslack.jambonz.org, 
where you can connect with other jambonz users, ask questions, share your experiences, and learn from others.

Hope to see you there!

Best, 

DaveH and the jambonz team`;

const addLocalUser = async(logger, user_sid, account_sid,
  name, email, email_activation_code, passwordHash, service_provider_sid) => {
  const [r] = await promisePool.execute(insertUserLocalSql,
    [
      user_sid,
      account_sid,
      name,
      email,
      email_activation_code,
      passwordHash,
      service_provider_sid
    ]);
  debug({r}, 'Result from adding user');
};
const addOauthUser = async(logger, user_sid, account_sid,
  name, email, provider, provider_userid, service_provider_sid) => {
  const [r] = await promisePool.execute(insertUserSql,
    [
      user_sid,
      account_sid,
      name,
      email,
      provider,
      provider_userid,
      service_provider_sid
    ]);
  logger.debug({r}, 'Result from adding user');
};

const validateRequest = async(req, user_sid) => {
  const payload = req.body || {};

  /* check required properties are there */
  ['provider', 'service_provider_sid'].forEach((prop) => {
    if (!payload[prop]) throw new DbErrorBadRequest(`missing ${prop}`);
  });

  /* valid service provider? */
  const [rows] = await promisePool.query('SELECT * from service_providers WHERE service_provider_sid = ?',
    payload.service_provider_sid);
  if (0 === rows.length) throw new DbErrorUnprocessableRequest('invalid service_provider_sid');

  /* valid provider? */
  if (!['local', 'github', 'google', 'twitter'].includes(payload.provider)) {
    throw new DbErrorUnprocessableRequest(`invalid provider: ${payload.provider}`);
  }

  /* if local provider then email/password */
  if ('local' === payload.provider) {
    if (!payload.email || !payload.password) throw new DbErrorBadRequest('missing email or password');

    /* valid email? */
    if (!validateEmail(payload.email)) throw new DbErrorBadRequest('invalid email');

    /* valid password? */
    if (payload.password.length < 6) throw new DbErrorBadRequest('password must be at least 6 characters');

    /* is this email available? */
    if (user_sid) {
      const [rows] = await promisePool.query('SELECT * from users WHERE email = ? AND user_sid <> ?',
        [payload.email, user_sid]);
      if (rows.length > 0) throw new DbErrorUnprocessableRequest('account already exists for this email');
    }
    else {
      const [rows] = await promisePool.query('SELECT * from users WHERE email = ?', payload.email);
      if (rows.length > 0) throw new DbErrorUnprocessableRequest('account already exists for this email');
    }

    /* verify that we have a code to email them */
    if (!payload.email_activation_code) throw new DbErrorBadRequest('email activation code required');
  }
  else {
    ['oauth2_code', 'oauth2_state', 'oauth2_client_id', 'oauth2_redirect_uri'].forEach((prop) => {
      if (!payload[prop]) throw new DbErrorBadRequest(`missing ${prop} for provider ${payload.provider}`);
    });
  }
};

const parseAuthorizationToken = (logger, req) => {
  const notfound = {};
  const authHeader = req.get('Authorization');
  if (!authHeader) return Promise.resolve(notfound);

  return new Promise((resolve) => {
    const arr = /^Bearer (.*)$/.exec(req.get('Authorization'));
    if (!arr) return resolve(notfound);
    jwt.verify(arr[1], process.env.JWT_SECRET, async(err, decoded) => {
      if (err) return resolve(notfound);
      logger.debug({jwt: decoded}, 'register - create new user for existing account');
      resolve(decoded);
    });
  });
};

/**
 * called to create a new user and account
 * or new user with existing account, in case of "change auth mechanism"
 */
router.post('/', async(req, res) => {
  const {logger, writeCdrs, writeAlerts, AlertType} = req.app.locals;
  const userProfile = {};

  try {
    const {user_sid, account_sid} = await parseAuthorizationToken(logger, req);
    await validateRequest(req, user_sid);

    logger.debug({payload: req.body}, 'POST /register');

    if (req.body.provider === 'github') {
      const user = await doGithubAuth(logger, req.body);
      logger.info({user}, 'retrieved user details from github');
      Object.assign(userProfile, {
        name: user.email,
        email: user.email,
        email_validated: user.email_validated,
        avatar_url: user.avatar_url,
        provider: 'github',
        provider_userid: user.login
      });
    }
    else if (req.body.provider === 'google') {
      const user = await doGoogleAuth(logger, req.body);
      logger.info({user}, 'retrieved user details from google');
      Object.assign(userProfile, {
        name: user.email || user.email,
        email: user.email,
        email_validated: user.verified_email,
        picture: user.picture,
        provider: 'google',
        provider_userid: user.id
      });
    }
    else if (req.body.provider === 'local') {
      const user = await doLocalAuth(logger, req.body);
      logger.info({user}, 'retrieved user details for local provider');
      debug({user}, 'retrieved user details for local provider');
      Object.assign(userProfile, {
        name: user.email,
        email: user.email,
        provider: 'local',
        email_activation_code: user.email_activation_code
      });
    }

    if (req.body.provider !== 'local') {
      /* when using oauth2, check to see if user already exists */
      const [users] = await promisePool.query(
        'SELECT * from users WHERE provider = ? AND provider_userid = ?',
        [userProfile.provider, userProfile.provider_userid]);
      logger.debug({users}, `Result from retrieving user for ${userProfile.provider}:${userProfile.provider_userid}`);
      if (1 === users.length) {

        /* if changing existing account to oauth, no other user with that provider/userid must exist */
        if (user_sid) {
          throw new DbErrorUnprocessableRequest('account already exists for this oauth user/provider');
        }
        Object.assign(userProfile, {
          user_sid: users[0].user_sid,
          account_sid: users[0].account_sid,
          name: users[0].name,
          email: users[0].email,
          phone: users[0].phone,
          pristine: false,
          email_validated: users[0].email_validated ? true : false,
          phone_validated: users[0].phone_validated ? true : false,
          scope: users[0].scope
        });

        const [accounts] =  await promisePool.query('SELECT * from accounts WHERE account_sid = ?',
          userProfile.account_sid);
        if (accounts.length === 0) throw new DbErrorUnprocessableRequest('user exists with no associated account');
        Object.assign(userProfile, {
          is_active: accounts[0].is_active == 1,
          tutorial_completion: accounts[0].tutorial_completion
        });
      }
      else {
        /* you can not register from the sign-in page */
        if (req.body.locationBeforeAuth === '/sign-in') {
          logger.debug('redirecting user to /register so they accept Ts & Cs');
          return res.status(404).json({msg: 'registering a new account not allowed from the sign-in page'});
        }
        /* new user, but check if we already have an account with that email */
        let sql = 'SELECT * from users WHERE email = ?';
        const args = [userProfile.email];
        if (user_sid) {
          sql += ' AND user_sid <> ?';
          args.push(user_sid);
        }
        logger.debug(`sql is ${sql}`);
        const [accounts] = await promisePool.execute(sql, args);
        if (accounts.length > 0) {
          throw new DbErrorBadRequest(`user already exists with email ${userProfile.email}`);
        }
      }
    }
    if (userProfile.pristine !== false && !user_sid) {
      /* add a new user and account */
      /* get root domain */
      const [sp] = await promisePool.query(queryRootDomainSql, req.body.service_provider_sid);
      if (0 === sp.length) throw new Error(`service_provider not found for sid ${req.body.service_provider_sid}`);
      if (!sp[0].root_domain) {
        throw new Error(`root_domain missing for service provider ${req.body.service_provider_sid}`);
      }

      userProfile.root_domain = sp[0].root_domain;
      userProfile.account_sid = uuid();
      userProfile.user_sid = uuid();

      const [r1] = await promisePool.execute(insertAccountSql,
        [
          userProfile.account_sid,
          req.body.service_provider_sid,
          userProfile.name || userProfile.email,
          req.body.provider !== 'local',
          `wh_secret_${translator.generate()}`
        ]);
      logger.debug({r1}, 'Result from adding account');

      /* add to signup history */
      let isReturningUser = false;
      try {
        await promisePool.execute(insertSignupHistorySql,
          [userProfile.email, userProfile.name || userProfile.email]);
      } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
          logger.info(`register: user is signing up for a second trial: ${userProfile.email}`);
          isReturningUser = true;
        }
      }

      /* write sample cdrs and alerts in test environment */
      if ('test' === process.env.NODE_ENV) {
        await createTestCdrs(writeCdrs, userProfile.account_sid);
        await createTestAlerts(writeAlerts, AlertType, userProfile.account_sid);
        logger.debug('added test data for cdrs and alerts');
      }
      /* assign starter set of products */
      await setupFreeTrial(logger, userProfile.account_sid, isReturningUser);

      /* add a user for the account */
      if (req.body.provider === 'local') {
        /* hash password */
        debug(`salting password: ${req.body.password}`);
        const passwordHash = await generateHashedPassword(req.body.password);
        debug(`hashed password: ${passwordHash}`);
        await addLocalUser(logger, userProfile.user_sid, userProfile.account_sid,
          userProfile.name, userProfile.email, userProfile.email_activation_code,
          passwordHash, req.body.service_provider_sid);
        debug('added local user');
      }
      else {
        await addOauthUser(logger, userProfile.user_sid, userProfile.account_sid,
          userProfile.name, userProfile.email, userProfile.provider,
          userProfile.provider_userid, req.body.service_provider_sid);
      }

      /* add hello-world and dial-time as starter applications */
      const callStatusSid = uuid();
      const helloWordSid = uuid();
      const dialTimeSid = uuid();
      const echoSid = uuid();

      /* 4 webhooks */
      await promisePool.execute(insertWebookSql,
        [callStatusSid, 'https://public-apps.jambonz.cloud/call-status', 'POST']);
      await promisePool.execute(insertWebookSql,
        [helloWordSid, 'https://public-apps.jambonz.cloud/hello-world', 'POST']);
      await promisePool.execute(insertWebookSql,
        [dialTimeSid, 'https://public-apps.jambonz.cloud/dial-time', 'POST']);
      await promisePool.execute(insertWebookSql,
        [echoSid, 'https://public-apps.jambonz.cloud/echo', 'POST']);

      /* 2 applications */
      await promisePool.execute(insertApplicationSql, [uuid(), userProfile.account_sid, 'hello world',
        helloWordSid, callStatusSid, 'google', 'en-US', 'en-US-Wavenet-C', 'google', 'en-US']);
      await promisePool.execute(insertApplicationSql, [uuid(), userProfile.account_sid, 'dial time clock',
        dialTimeSid, callStatusSid, 'google', 'en-US', 'en-US-Wavenet-C', 'google', 'en-US']);
      await promisePool.execute(insertApplicationSql, [uuid(), userProfile.account_sid, 'simple echo test',
        echoSid, callStatusSid, 'google', 'en-US', 'en-US-Wavenet-C', 'google', 'en-US']);

      Object.assign(userProfile, {
        pristine: true,
        is_active: req.body.provider !== 'local',
        email_validated: userProfile.provider !== 'local',
        phone_validated: false,
        tutorial_completion: 0,
        scope: 'read-write'
      });

      // send invite to Slack
      if (process.env.SEND_SLACK_INVITE_ON_SIGNUP) {
        try {
          emailSimpleText(logger, userProfile.email, 'Welcome to jambonz!', slackEmail);
        } catch (err) {
          logger.info({err}, 'Error sending slack invite');
        }
      }
    }
    else if (user_sid) {
      /* add a new user for existing account */
      userProfile.user_sid = uuid();
      userProfile.account_sid = account_sid;

      /* changing auth mechanism, add user for existing account */
      logger.debug(`register - creating new user for existing account ${account_sid}`);
      if (req.body.provider === 'local') {
        /* hash password */
        const passwordHash = await generateHashedPassword(req.body.password);

        await addLocalUser(logger, userProfile.user_sid, userProfile.account_sid,
          userProfile.name, userProfile.email, userProfile.email_activation_code,
          passwordHash, req.body.service_provider_sid);

        /* note: we deactivate the old user once the new email is validated */
      }
      else {
        await addOauthUser(logger, userProfile.user_sid, userProfile.account_sid,
          userProfile.name, userProfile.email, userProfile.provider,
          userProfile.provider_userid, req.body.service_provider_sid);

        /* deactivate the old/replaced user */
        const [r] = await promisePool.execute('DELETE FROM users WHERE user_sid = ?', [user_sid]);
        logger.debug({r}, 'register - removed old user');
        const redisKey = cacheClient.generateRedisKey('jwt', user_sid, 'v2');
        await cacheClient.delete(redisKey);
      }
    }

    const expiresIn = parseInt(process.env.JWT_EXPIRES_IN || 60) * 60 ;
    // generate a json web token for this user
    const token = jwt.sign({
      user_sid: userProfile.user_sid,
      account_sid: userProfile.account_sid,
      service_provider_sid: req.body.service_provider_sid,
      scope: 'account',
      email: userProfile.email,
      name: userProfile.name
    }, process.env.JWT_SECRET, { expiresIn });

    logger.debug({
      user_sid: userProfile.user_sid,
      account_sid: userProfile.account_sid
    }, 'generated jwt');

    // Remove activation code from the response data!
    delete userProfile.email_activation_code;
    res.json({jwt: token, ...userProfile});

    /* Store jwt based on user_id after successful login */
    await cacheClient.set({
      redisKey: cacheClient.generateRedisKey('jwt', userProfile.user_sid, 'v2'),
      value: token,
      time: expiresIn,
    });

  } catch (err) {
    debug(err, 'Error');
    sysError(logger, res, err);
  }

});


module.exports = router;
