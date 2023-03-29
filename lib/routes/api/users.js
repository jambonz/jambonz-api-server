const router = require('express').Router();
const User = require('../../models/user');
const request = require('request');
const {DbErrorBadRequest} = require('../../utils/errors');
const {generateHashedPassword, verifyPassword} = require('../../utils/password-utils');
const {promisePool} = require('../../db');
const {validatePasswordSettings} = require('./utils');
const {decrypt} = require('../../utils/encrypt-decrypt');
const sysError = require('../error');
const retrieveMyDetails = `SELECT * 
FROM users user
JOIN accounts AS account ON account.account_sid = user.account_sid 
LEFT JOIN service_providers as sp ON account.service_provider_sid = sp.service_provider_sid  
WHERE user.user_sid = ?`;
const retrieveMyDetails2 = `SELECT * 
FROM users user
LEFT JOIN accounts AS account ON account.account_sid = user.account_sid 
LEFT JOIN service_providers as sp ON sp.service_provider_sid = user.service_provider_sid 
WHERE user.user_sid = ?`;
const retrieveSql = 'SELECT * from users where user_sid = ?';
const retrieveProducts = `SELECT * 
FROM account_products 
JOIN products ON account_products.product_sid = products.product_sid
JOIN account_subscriptions ON account_products.account_subscription_sid = account_subscriptions.account_subscription_sid
WHERE account_subscriptions.account_sid = ?
AND account_subscriptions.effective_end_date IS NULL 
AND account_subscriptions.pending=0`;
const updateSql = 'UPDATE users set hashed_password = ?, force_change = false WHERE user_sid = ?';
const retrieveStaticIps = 'SELECT * FROM account_static_ips WHERE account_sid = ?';

const validateRequest = async(user_sid, req) => {
  const payload = req.body;
  const {
    old_password,
    new_password,
    initial_password,
    name,
    email,
    email_activation_code,
    force_change,
    is_active
  } = payload;

  const [r] = await promisePool.query(retrieveSql, user_sid);
  if (r.length === 0) {
    throw new DbErrorBadRequest('Invalid request: user_sid does not exist');
  }
  const user = r[0];

  /* it is not allowed for anyone to promote a user to a higher level of authority */
  if (null === payload.account_sid || null === payload.service_provider_sid) {
    throw new DbErrorBadRequest('Invalid request: user may not be promoted');
  }

  if (req.user.hasAccountAuth) {
    /* account user may not change modify account_sid or service_provider_sid */
    if ('account_sid' in payload && payload.account_sid !== user.account_sid) {
      throw new DbErrorBadRequest('Invalid request: user may not be promoted or moved to another account');
    }
    if ('service_provider_sid' in payload && payload.service_provider_sid !== user.service_provider_sid) {
      throw new DbErrorBadRequest('Invalid request: user may not be promoted or moved to another service provider');
    }
  }
  if (req.user.hasServiceProviderAuth) {
    if ('service_provider_sid' in payload && payload.service_provider_sid !== user.service_provider_sid) {
      throw new DbErrorBadRequest('Invalid request: user may not be promoted or moved to another service provider');
    }
  }
  if ('account_sid' in payload) {
    const [r] = await promisePool.query('SELECT * FROM accounts WHERE account_sid = ?', payload.account_sid);
    if (r.length === 0) throw new DbErrorBadRequest('Invalid request: account_sid does not exist');
    const {service_provider_sid} = r[0];
    if (service_provider_sid !== user.service_provider_sid) {
      throw new DbErrorBadRequest('Invalid request: user may not be moved to another service provider');
    }
  }

  if (initial_password) {
    await validatePasswordSettings(initial_password);
  }

  if ((old_password && !new_password) || (new_password && !old_password)) {
    throw new DbErrorBadRequest('new_password and old_password both required');
  }
  if (new_password) {
    await validatePasswordSettings(new_password);
  }
  if (new_password && name) throw new DbErrorBadRequest('can not change name and password simultaneously');
  if (new_password && user.provider !== 'local') {
    throw new DbErrorBadRequest('can not change password when using oauth2');
  }

  if (email_activation_code && !email) {
    throw new DbErrorBadRequest('email and email_activation_code both required');
  }
  if (!name && !new_password && !email && !initial_password && !force_change && !is_active)
    throw new DbErrorBadRequest('no updates requested');

  return user;
};

router.get('/', async(req, res) => {
  const logger = req.app.locals.logger;

  let usersList;
  try {
    let results;
    if (req.user.hasAdminAuth) {
      results = await User.retrieveAll();
    }
    else if (req.user.hasAccountAuth) {
      results = await User.retrieveAllForAccount(req.user.account_sid, true);
    }
    else if (req.user.hasServiceProviderAuth) {
      results = await User.retrieveAllForServiceProvider(req.user.service_provider_sid, true);
    }

    if (results.length === 0) throw new Error('failure retrieving users list');

    usersList = results.map((user) => {
      const {
        user_sid,
        name,
        email,
        force_change,
        is_active,
        account_sid,
        service_provider_sid,
        account_name,
        service_provider_name
      } = user;
      let scope;
      if (account_sid && service_provider_sid) {
        scope = 'account';
      } else if (service_provider_sid) {
        scope = 'service_provider';
      } else {
        scope = 'admin';
      }

      const obj = {
        user_sid,
        name,
        email,
        scope,
        force_change,
        is_active,
        ...(account_sid && {account_sid}),
        ...(account_name && {account_name}),
        ...(service_provider_sid && {service_provider_sid}),
        ...(service_provider_name && {service_provider_name})
      };
      return obj;
    });
  } catch (err) {
    sysError(logger, res, err);
  }
  res.status(200).json(usersList);
});

router.get('/me', async(req, res) => {
  const logger = req.app.locals.logger;
  const {user_sid} = req.user;

  if (!user_sid) return res.sendStatus(403);

  let payload;
  try {
    if (process.env.JAMBONES_HOSTING) {
      const [r] = await promisePool.query({sql: retrieveMyDetails, nestTables: true}, user_sid);
      logger.debug(r, 'retrieved user details');
      payload = r[0];
      const {user, account, sp} = payload;
      ['hashed_password', 'salt', 'phone_activation_code', 'email_activation_code', 'account_sid'].forEach((prop) => {
        delete user[prop];
      });
      ['email_validated', 'phone_validated', 'force_change'].forEach((prop) => user[prop] = !!user[prop]);
      ['is_active'].forEach((prop) => account[prop] = !!account[prop]);
      account.root_domain = sp.root_domain;
      delete payload.sp;

      /* get api keys */
      const [keys] = await promisePool.query('SELECT * from api_keys WHERE account_sid = ?', account.account_sid);
      payload.api_keys = keys.map((k) => {
        return {
          api_key_sid: k.api_key_sid,
          //token: k.token.replace(/.(?=.{4,}$)/g, '*'),
          token: k.token,
          last_used: k.last_used,
          created_at: k.created_at
        };
      });

      /* get products */
      const [products] = await promisePool.query({sql: retrieveProducts, nestTables: true}, account.account_sid);
      if (!products.length || !products[0].account_subscriptions) {
        throw new Error('account is missing a subscription');
      }
      const account_subscription = products[0].account_subscriptions;
      payload.subscription = {
        status: 'active',
        account_subscription_sid: account_subscription.account_subscription_sid,
        start_date: account_subscription.effective_start_date,
        products: products.map((prd) => {
          return {
            name: prd.products.name,
            units: prd.products.unit_label,
            quantity: prd.account_products.quantity
          };
        })
      };
      if (account_subscription.pending) {
        Object.assign(payload.subscription, {
          status: 'suspended',
          suspend_reason: account_subscription.pending_reason
        });
      }
      const {
        last4,
        exp_month,
        exp_year,
        card_type,
        stripe_statement_descriptor
      } = account_subscription;
      if (last4) {
        const real_last4 = decrypt(last4);
        Object.assign(payload.subscription, {
          last4: real_last4,
          exp_month,
          exp_year,
          card_type,
          statement_descriptor: stripe_statement_descriptor
        });
      }

      /* get static ips */
      const [static_ips] = await promisePool.query(retrieveStaticIps, account.account_sid);
      payload.static_ips = static_ips.map((r) => r.public_ipv4);
    }
    else {
      const [r] = await promisePool.query({sql: retrieveMyDetails2, nestTables: true}, user_sid);
      logger.debug(r, 'retrieved user details');
      payload = r[0];
      const {user} = payload;
      ['hashed_password', 'salt', 'phone_activation_code', 'email_activation_code'].forEach((prop) => {
        delete user[prop];
      });
      ['email_validated', 'phone_validated', 'force_change'].forEach((prop) => user[prop] = !!user[prop]);
    }
    logger.debug({payload}, 'returning user details');
    res.json(payload);
  } catch (err) {
    sysError(logger, res, err);
  }
});

router.get('/:user_sid', async(req, res) => {
  const logger = req.app.locals.logger;
  const {user_sid} = req.params;

  try {
    const [user] = await User.retrieve(user_sid);
    // eslint-disable-next-line no-unused-vars
    const {hashed_password, ...rest} = user;
    if (!user) throw new Error('failure retrieving user');

    if (req.user.hasAdminAuth ||
    req.user.hasAccountAuth && req.user.account_sid === user.account_sid ||
    req.user.hasServiceProviderAuth && req.user.service_provider_sid === user.service_provider_sid) {
      res.status(200).json(rest);
    } else {
      res.sendStatus(403);
    }

  } catch (err) {
    sysError(logger, res, err);
  }
});

router.put('/:user_sid', async(req, res) => {
  const logger = req.app.locals.logger;
  const {user_sid} = req.params;
  const user = await User.retrieve(user_sid);
  const {hasAccountAuth, hasServiceProviderAuth, hasAdminAuth} = req.user;
  const {
    old_password,
    new_password,
    initial_password,
    email_activation_code,
    email,
    name,
    is_active,
    force_change,
    account_sid,
    service_provider_sid
  } = req.body;

  //if (req.user.user_sid && req.user.user_sid !== user_sid) return res.sendStatus(403);

  if (!hasAdminAuth &&
  !(hasAccountAuth && req.user.account_sid === user[0].account_sid) &&
  !(hasServiceProviderAuth && req.user.service_provider_sid === user[0].service_provider_sid) &&
  (req.user.user_sid && req.user.user_sid !== user_sid)) {
    return res.sendStatus(403);
  }

  try {
    const user = await validateRequest(user_sid, req);
    if (!user) return res.sendStatus(404);

    if (new_password) {
      const old_hashed_password = user.hashed_password;

      const isCorrect = await verifyPassword(old_hashed_password, old_password);
      if (!isCorrect) {
        //debug(`PUT /Users/:sid pwd ${old_password} does not match hash ${old_hashed_password}`);
        return res.sendStatus(403);
      }

      if (old_password === new_password) {
        throw new Error('new password cannot be your old password');
      }

      const passwordHash = await generateHashedPassword(new_password);
      //debug(`updating hashed_password to ${passwordHash}`);
      const r = await promisePool.execute(updateSql, [passwordHash, user_sid]);
      if (0 === r.changedRows) throw new Error('database update failed');
    }

    if (name) {
      const r = await promisePool.execute('UPDATE users SET name = ? WHERE user_sid = ?', [name, user_sid]);
      if (0 === r.changedRows) throw new Error('database update failed');
    }

    if (initial_password) {
      const passwordHash = await generateHashedPassword(initial_password);
      const r = await promisePool.execute(
        'UPDATE users SET hashed_password = ? WHERE user_sid = ?',
        [passwordHash, user_sid]
      );
      if (0 === r.changedRows) throw new Error('database update failed');
    }

    if (typeof is_active !== 'undefined') {
      const r = await promisePool.execute('UPDATE users SET is_active = ? WHERE user_sid = ?', [is_active, user_sid]);
      if (0 === r.changedRows) throw new Error('database update failed');
    }

    if (typeof force_change !== 'undefined') {
      const r = await promisePool.execute(
        'UPDATE users SET force_change = ? WHERE user_sid = ?',
        [force_change, user_sid]);
      if (0 === r.changedRows) throw new Error('database update failed');
    }

    if (account_sid || account_sid === null) {
      const r = await promisePool.execute(
        'UPDATE users SET account_sid = ? WHERE user_sid = ?',
        [account_sid, user_sid]);
      if (0 === r.changedRows) throw new Error('database update failed');
    }

    if (service_provider_sid || service_provider_sid === null) {
      const r = await promisePool.execute(
        'UPDATE users SET service_provider_sid = ? WHERE user_sid = ?',
        [service_provider_sid, user_sid]);
      if (0 === r.changedRows) throw new Error('database update failed');
    }

    if (email) {
      if (email_activation_code) {
        const r = await promisePool.execute(
          'UPDATE users SET email = ?, email_activation_code = ?, email_validated = 0 WHERE user_sid = ?',
          [email, email_activation_code, user_sid]);
        if (0 === r.changedRows) throw new Error('database update failed');
      }
      const r = await promisePool.execute(
        'UPDATE users SET email = ? WHERE user_sid = ?',
        [email, user_sid]);
      if (0 === r.changedRows) throw new Error('database update failed');

      if (process.env.NODE_ENV !== 'test') {
        //TODO: send email with activation code
      }
    }
    res.sendStatus(204);
  } catch (err) {
    sysError(logger, res, err);
  }
});

router.post('/', async(req, res) => {
  const logger = req.app.locals.logger;
  const passwordHash = await generateHashedPassword(req.body.initial_password);
  const payload = {
    ...req.body,
    provider: 'local',
    hashed_password: passwordHash,
  };
  const allUsers = await User.retrieveAll();
  delete payload.initial_password;

  try {
    if (req.body.initial_password) {
      await validatePasswordSettings(req.body.initial_password);
    }
    const email = allUsers.find((e) => e.email === payload.email);
    const name = allUsers.find((e) => e.name === payload.name);

    if (name) {
      logger.debug({payload}, 'user with this username already exists');
      return res.status(422).json({msg: 'user with this username already exists'});
    }

    if (email) {
      logger.debug({payload}, 'user with this email already exists');
      return res.status(422).json({msg: 'user with this email already exists'});
    }

    if (req.user.hasAdminAuth) {
      logger.debug({payload}, 'POST /users');
      const uuid = await User.make(payload);
      res.status(201).json({user_sid: uuid});
    }
    else if (req.user.hasAccountAuth) {
      logger.debug({payload}, 'POST /users');
      const uuid = await User.make({
        ...payload,
        account_sid: req.user.account_sid,
      });
      res.status(201).json({user_sid: uuid});
    }
    else if (req.user.hasServiceProviderAuth) {
      logger.debug({payload}, 'POST /users');
      const uuid = await User.make({
        ...payload,
        service_provider_sid: req.user.service_provider_sid,
      });
      res.status(201).json({user_sid: uuid});
    }
  } catch (err) {
    sysError(logger, res, err);
  }
});

router.delete('/:user_sid', async(req, res) => {
  const logger = req.app.locals.logger;
  const {user_sid} = req.params;
  const allUsers = await User.retrieveAll();
  const activeAdminUsers = allUsers.filter((e) => !e.account_sid && !e.service_provider_sid && e.is_active);
  const user = await User.retrieve(user_sid);

  try {
    if (req.user.hasAdminAuth && activeAdminUsers.length === 1) {
      throw new Error('cannot delete this admin user - there are no other active admin users');
    }

    if (req.user.hasAdminAuth ||
    (req.user.hasAccountAuth && req.user.account_sid === user[0].account_sid) ||
    (req.user.hasServiceProviderAuth && req.user.service_provider_sid === user[0].service_provider_sid)) {
      await User.remove(user_sid);
      //logout user after self-delete
      if (req.user.user_sid === user_sid) {
        request({
          url:'http://localhost:3000/v1/logout',
          method: 'POST',
        }, (err) => {
          if (err) {
            logger.error(err, 'could not log out user');
            return res.sendStatus(500);
          }
          logger.debug({user}, 'user deleted and logged out');
        });
      }
      return res.sendStatus(204);
    } else {
      throw new DbErrorBadRequest('invalid request');
    }
  } catch (err) {
    sysError(logger, res, err);
  }
});

module.exports = router;
