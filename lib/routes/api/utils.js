const { v4: uuid, validate } = require('uuid');
const Account = require('../../models/account');
const {promisePool} = require('../../db');
const {cancelSubscription, detachPaymentMethod} = require('../../utils/stripe-utils');
const freePlans = require('../../utils/free_plans');
const { BadRequestError, DbErrorBadRequest } = require('../../utils/errors');
const insertAccountSubscriptionSql = `INSERT INTO account_subscriptions 
(account_subscription_sid, account_sid) 
values (?, ?)`;
const replaceOldSubscriptionSql = `UPDATE account_subscriptions 
SET effective_end_date = CURRENT_TIMESTAMP, change_reason = ?  
WHERE account_subscription_sid = ?`;

const setupFreeTrial = async(logger, account_sid, isReturningUser) => {
  const sid = uuid();

  /* see if we have an existing subscription */
  const account_subscription = await Account.getSubscription(account_sid);
  const planType = account_subscription || isReturningUser ? 'free' : 'trial';
  logger.debug({account_subscription}, `setupFreeTrial: assigning ${account_sid} to ${planType} plan`);

  /* create a subscription */
  await promisePool.execute(insertAccountSubscriptionSql, [sid, account_sid]);

  /* add products to it */
  const [products] = await promisePool.query('SELECT * from products');
  const name2Product = new Map();
  products.forEach((p) => name2Product.set(p.category, p.product_sid));

  await Promise.all(freePlans[planType].map((p) => {
    const data = {
      account_product_sid: uuid(),
      account_subscription_sid: sid,
      product_sid: name2Product.get(p.category),
      quantity: p.quantity
    };
    return promisePool.query('INSERT INTO account_products SET ?', data);
  }));
  logger.debug({products}, 'setupFreeTrial: added products');

  /* disable the old subscription, if any */
  if (account_subscription) {
    const {
      account_subscription_sid,
      stripe_subscription_id,
      stripe_payment_method_id
    } = account_subscription;
    await promisePool.execute(replaceOldSubscriptionSql, [
      'downgraded to free plan', account_subscription_sid]);
    logger.debug('setupFreeTrial: deactivated previous plan');

    const promises = [];
    if (stripe_subscription_id) {
      logger.debug(`setupFreeTrial: deactivating subscription ${stripe_subscription_id}`);
      promises.push(cancelSubscription(logger, stripe_subscription_id));
    }
    if (stripe_payment_method_id) {
      promises.push(detachPaymentMethod(logger, stripe_payment_method_id));
    }
    if (promises.length) await Promise.all(promises);
  }

  /* update account.plan */
  await promisePool.execute(
    'UPDATE accounts SET plan_type = ? WHERE account_sid = ?',
    [planType, account_sid]);
};

const createTestCdrs = async(writeCdrs,  account_sid) => {
  const points = 2000;
  const data = [];
  const start = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000));
  const now = new Date();
  const increment = (now.getTime() - start.getTime()) / points;
  for (let i = 0 ; i < points; i++) {
    const attempted_at = new Date(start.getTime() + (i * increment));
    const failed = 0 === i % 5;
    const sip_callid = `685cd008-0a66-4974-b37a-bdd6d9a3c4a-${i % 2}`;
    data.push({
      call_sid: 'b6f48929-8e86-4d62-ae3b-64fb574d91f6',
      from: '15083084809',
      to: '18882349999',
      answered:  !failed,
      sip_callid,
      sip_status: 200,
      duration: failed ? 0 : 45,
      attempted_at: attempted_at.getTime(),
      answered_at: attempted_at.getTime() + 3000,
      terminated_at: attempted_at.getTime() + 45000,
      termination_reason: 'caller hungup',
      host: '192.168.1.100',
      remote_host: '3.55.24.34',
      account_sid,
      direction: 0 === i % 2 ? 'inbound' : 'outbound',
      trunk:  0 === i % 2 ? 'twilio' : 'user'
    });
  }

  await writeCdrs(data);

};

const createTestAlerts = async(writeAlerts, AlertType, account_sid) => {
  const points = 100;
  const data = [];
  const start = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000));
  const now = new Date();
  const increment = (now.getTime() - start.getTime()) / points;
  for (let i = 0 ; i < points; i++) {
    const timestamp = new Date(start.getTime() + (i * increment));
    const scenario = i % 5;
    switch (scenario) {
      case 0:
        data.push({timestamp, account_sid,
          alert_type: AlertType.WEBHOOK_STATUS_FAILURE, url: 'http://foo.bar', status: 404});
        break;
      case 1:
        data.push({timestamp, account_sid, alert_type: AlertType.WEBHOOK_CONNECTION_FAILURE, url: 'http://foo.bar'});
        break;
      case 2:
        data.push({timestamp, account_sid, alert_type: AlertType.TTS_NOT_PROVISIONED, vendor: 'google'});
        break;
      case 3:
        data.push({timestamp, account_sid, alert_type: AlertType.CARRIER_NOT_PROVISIONED});
        break;
      case 4:
        data.push({timestamp, account_sid, alert_type: AlertType.ACCOUNT_CALL_LIMIT, count: 50});
        break;
      default:
        break;
    }
  }

  await writeAlerts(data);

};

const validateSid = (model, req) => {
  const arr = new RegExp(`${model}\/([^\/]*)`).exec(req.originalUrl);

  if (arr) {
    const sid = arr[1];
    const sid_validation = validate(sid);
    if (!sid_validation) {
      throw new BadRequestError(`invalid ${model}Sid format`);
    }

    return arr[1];
  }

  return;
};

const parseServiceProviderSid = (req) => {
  try {
    return validateSid('ServiceProviders', req);
  } catch (error) {
    throw error;
  }
};

const parseAccountSid = (req) => {
  try {
    return validateSid('Accounts', req);
  } catch (error) {
    throw error;
  }
};

const parseApplicationSid = (req) => {
  try {
    return validateSid('Applications', req);
  } catch (error) {
    throw error;
  }
};

const parseCallSid = (req) => {
  try {
    return validateSid('Calls', req);
  } catch (error) {
    throw error;
  }
};

const parsePhoneNumberSid = (req) => {
  try {
    return validateSid('PhoneNumbers', req);
  } catch (error) {
    throw error;
  }
};

const parseSpeechCredentialSid = (req) => {
  try {
    return validateSid('SpeechCredentials', req);
  } catch (error) {
    throw error;
  }
};

const parseVoipCarrierSid = (req) => {
  try {
    return validateSid('VoipCarriers', req);
  } catch (error) {
    throw error;
  }
};

const parseWebhookSid = (req) => {
  try {
    return validateSid('Webhooks', req);
  } catch (error) {
    throw error;
  }
};

const parseSipGatewaySid = (req) => {
  try {
    return validateSid('SipGateways', req);
  } catch (error) {
    throw error;
  }
};

const parseUserSid = (req) => {
  try {
    return validateSid('Users', req);
  } catch (error) {
    throw error;
  }
};

const parseLcrSid = (req) => {
  try {
    return validateSid('Lcrs', req);
  } catch (error) {
    throw error;
  }
};

const hasAccountPermissions = async(req, res, next) => {
  try {
    if (req.user.hasScope('admin')) {
      return next();
    }

    if (req.user.hasScope('service_provider')) {
      const service_provider_sid = parseServiceProviderSid(req);
      const account_sid = parseAccountSid(req);
      if (service_provider_sid) {
        if (service_provider_sid === req.user.service_provider_sid) {
          return next();
        }
      }
      if (account_sid) {
        const [r] = await Account.retrieve(account_sid);
        if (r && r.service_provider_sid === req.user.service_provider_sid) {
          return next();
        }
      }
    }

    if (req.user.hasScope('account')) {
      const account_sid = parseAccountSid(req);
      const service_provider_sid = parseServiceProviderSid(req);
      const [r] = await Account.retrieve(account_sid);

      if (account_sid) {
        if (r && r.account_sid === req.user.account_sid) {
          return next();
        }
      }

      if (service_provider_sid) {
        if (r && r.service_provider_sid === req.user.service_provider_sid) {
          return next();
        }
      }
    }

    res.status(403).json({
      status: 'fail',
      message: 'insufficient privileges'
    });
  } catch (error) {
    throw error;
  }
};

const hasServiceProviderPermissions = (req, res, next) => {
  try {
    if (req.user.hasScope('admin')) {
      return next();
    }

    if (req.user.hasScope('service_provider')) {
      const service_provider_sid = parseServiceProviderSid(req);
      if (service_provider_sid === req.user.service_provider_sid) {
        return next();
      }
    }

    res.status(403).json({
      status: 'fail',
      message: 'insufficient privileges'
    });
  } catch (error) {
    throw error;
  }
};

const checkLimits = async(req, res, next) => {
  const logger = req.app.locals.logger;
  if (process.env.APPLY_JAMBONZ_DB_LIMITS && req.user.hasScope('account')) {
    const account_sid = req.user.account_sid;
    const url = req.originalUrl;
    let sql;
    let limit;

    if (/Applications/.test(url)) {
      limit = 50;
      sql = 'SELECT count(*) as count from applications where account_sid = ?';
    }
    else if (/VoipCarriers/.test(url)) {
      limit = 10;
      sql = 'SELECT count(*) as count from voip_carriers where account_sid = ?';
    }
    else if (/SipGateways/.test(url)) {
      limit = 150;
      sql = `SELECT count(*) as count 
      from sip_gateways 
      where voip_carrier_sid IN (
        SELECT voip_carrier_sid from voip_carriers
        where account_sid = ?
      )`;
    }
    else if (/PhoneNumbers/.test(url)) {
      limit = 200;
      sql = 'SELECT count(*) as count from phone_numbers where account_sid = ?';
    }
    else if (/SpeechCredentials/.test(url)) {
      limit = 10;
      sql = 'SELECT count(*) as count from speech_credentials where account_sid = ?';
    }
    else if (/ApiKeys/.test(url)) {
      limit = 10;
      sql = 'SELECT count(*) as count from api_keys where account_sid = ?';
    }

    if (sql) {
      try {
        const [r] = await promisePool.execute(sql, [account_sid]);
        if (r[0].count >= limit) {
          res.status(422).json({
            status: 'fail',
            message: `exceeded limits - you have created ${r.count} instances of this resource`
          });
          return;
        }
      } catch (err) {
        logger.error({err}, 'Error checking limits');
      }
    }
  }
  next();
};

const getSubspaceJWT = async(id, secret) => {
  const response = await fetch('https://id.subspace.com/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      client_id: id,
      client_secret: secret,
      audience: 'https://api.subspace.com/',
      grant_type: 'client_credentials',
    })
  });
  if (!response.ok) {
    throw new Error(`Failed to get JWT: ${response.status} ${response.statusText}`);
  }
  const jwt = await response.json();
  return jwt.access_token;
};

const enableSubspace = async(opts) => {
  const {subspace_client_id, subspace_client_secret, destination} = opts;
  const accessToken = await getSubspaceJWT(subspace_client_id, subspace_client_secret);
  const response = await fetch('https://api.subspace.com/v1/sipteleport', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      name: 'Jambonz',
      destination,
      status: 'ENABLED'
    })
  });
  if (!response.ok) {
    throw new Error(`Failed to enable teleport: ${response.status} ${response.statusText}`);
  }
  const teleport = await response.json();
  return teleport;
};

const disableSubspace = async(opts) => {
  const {subspace_client_id, subspace_client_secret, subspace_sip_teleport_id} = opts;
  const accessToken = await getSubspaceJWT(subspace_client_id, subspace_client_secret);
  const relativeUrl = `/v1/sipteleport/${subspace_sip_teleport_id}`;
  const response = await fetch(`https://api.subspace.com${relativeUrl}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });
  if (!response.ok) {
    throw new Error(`Failed to delete teleport: ${response.status} ${response.statusText}`);
  }
};

const validatePasswordSettings = async(password) => {
  const sql = 'SELECT * from password_settings';
  const [rows] = await promisePool.execute(sql);
  const specialChars = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+/;
  const numbers = /[0-9]+/;
  if (rows.length === 0) {
    if (password.length < 8 || password.length > 20) {
      throw new DbErrorBadRequest('password length must be between 8 and 20');
    }
  } else {
    if (rows[0].min_password_length && password.length < rows[0].min_password_length) {
      throw new DbErrorBadRequest(`password must be at least ${rows[0].min_password_length} characters long`);
    }

    if (rows[0].require_digit === 1 && !numbers.test(password)) {
      throw new DbErrorBadRequest('password must contain at least one digit');
    }

    if (rows[0].require_special_character === 1 && !specialChars.test(password)) {
      throw new DbErrorBadRequest('password must contain at least one special character');
    }
  }
  return;
};

function hasValue(data) {
  if (typeof data === 'string') {
    return data && data.length > 0;
  } else if (Array.isArray(data)) {
    return data && data.length > 0;
  } else if (typeof data === 'object') {
    return data && Object.keys(data).length > 0;
  } else if (typeof data === 'number') {
    return data !== null;
  } else if (typeof data === 'boolean') {
    return data !== null;
  } else {
    return false;
  }
}

module.exports = {
  setupFreeTrial,
  createTestCdrs,
  createTestAlerts,
  parseAccountSid,
  parseApplicationSid,
  parseCallSid,
  parsePhoneNumberSid,
  parseServiceProviderSid,
  parseSpeechCredentialSid,
  parseVoipCarrierSid,
  parseWebhookSid,
  parseSipGatewaySid,
  parseUserSid,
  parseLcrSid,
  hasAccountPermissions,
  hasServiceProviderPermissions,
  checkLimits,
  enableSubspace,
  disableSubspace,
  validatePasswordSettings,
  hasValue,
};
