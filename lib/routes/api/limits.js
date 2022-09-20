const router = require('express').Router();
const sysError = require('../error');
const AccountLimits = require('../../models/account-limits');
const ServiceProviderLimits = require('../../models/service-provider-limits');
const {parseAccountSid, parseServiceProviderSid} = require('./utils');
const {promisePool} = require('../../db');
const sqlDeleteSPLimits = `
DELETE FROM service_provider_limits 
WHERE service_provider_sid = ? 
`;
const sqlDeleteSPLimitsByCategory = `
DELETE FROM service_provider_limits 
WHERE service_provider_sid = ? 
AND category = ?
`;
const sqlDeleteAccountLimits = `
DELETE FROM account_limits 
WHERE account_sid = ? 
`;
const sqlDeleteAccountLimitsByCategory = `
DELETE FROM account_limits 
WHERE account_sid = ? 
AND category = ?
`;
router.post('/', async(req, res) => {
  const logger = req.app.locals.logger;
  const {
    category,
    quantity
  } = req.body;
  const account_sid = parseAccountSid(req);
  let service_provider_sid;
  if (!account_sid) {
    if (!req.user.hasServiceProviderAuth) {
      logger.error('POST /SpeechCredentials invalid credentials');
      return res.send(403);
    }
    service_provider_sid = parseServiceProviderSid(req);
  }
  try {
    let uuid;
    if (account_sid) {
      const existing = (await AccountLimits.retrieve(account_sid) || [])
        .find((el) => el.category === category);
      if (existing) {
        uuid = existing.account_limits_sid;
        await AccountLimits.update(uuid, {category, quantity});
      }
      else {
        uuid = await AccountLimits.make({
          account_sid,
          category,
          quantity
        });
      }
    }
    else {
      const existing = (await ServiceProviderLimits.retrieve(service_provider_sid) || [])
        .find((el) => el.category === category);
      if (existing) {
        uuid = existing.service_provider_limits_sid;
        await ServiceProviderLimits.update(uuid, {category, quantity});
      }
      else {
        uuid = await ServiceProviderLimits.make({
          service_provider_sid,
          category,
          quantity
        });
      }
    }
    res.status(201).json({sid: uuid});
  } catch (err) {
    sysError(logger, res, err);
  }
});

/**
 * retrieve all limits for an account or service provider
 */
router.get('/', async(req, res) => {
  let service_provider_sid;
  const account_sid = parseAccountSid(req);
  if (!account_sid) service_provider_sid = parseServiceProviderSid(req);
  const logger = req.app.locals.logger;
  try {
    const limits = account_sid ?
      await AccountLimits.retrieve(account_sid) :
      await ServiceProviderLimits.retrieve(service_provider_sid);

    if (req.query?.category) {
      return res.status(200).json(limits.filter((el) => el.category === req.query.category));
    }
    res.status(200).json(limits);
  } catch (err) {
    sysError(logger, res, err);
  }
});

router.delete('/', async(req, res) => {
  const logger = req.app.locals.logger;
  const account_sid = parseAccountSid(req);
  const {category} = req.query;
  const service_provider_sid = parseServiceProviderSid(req);
  try {
    if (account_sid) {
      if (category) {
        await promisePool.execute(sqlDeleteAccountLimitsByCategory, [account_sid, category]);
      }
      else {
        await promisePool.execute(sqlDeleteAccountLimits, [account_sid]);
      }
    }
    else {
      if (category) {
        await promisePool.execute(sqlDeleteSPLimitsByCategory, [service_provider_sid, category]);
      }
      else {
        await promisePool.execute(sqlDeleteSPLimits, [service_provider_sid]);
      }
    }
    res.status(204).end();
  } catch (err) {
    sysError(logger, res, err);
  }
});

module.exports = router;
