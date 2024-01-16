const router = require('express').Router();
const {promisePool} = require('../../db');
const {DbErrorForbidden} = require('../../utils/errors');
const Webhook = require('../../models/webhook');
const ServiceProvider = require('../../models/service-provider');
const Account = require('../../models/account');
const VoipCarrier = require('../../models/voip-carrier');
const Application = require('../../models/application');
const PhoneNumber = require('../../models/phone-number');
const ApiKey = require('../../models/api-key');
const {
  hasServiceProviderPermissions,
  parseServiceProviderSid,
  parseVoipCarrierSid,
} = require('./utils');
const sysError = require('../error');
const decorate = require('./decorate');
const { validateQuery } = require('../../utils/validate-query');
const { isPaginationEnabled } = require('../../config');
const preconditions = {
  'delete': noActiveAccountsOrUsers
};
const sqlDeleteSipGateways = `DELETE from sip_gateways 
WHERE voip_carrier_sid IN (
  SELECT voip_carrier_sid 
  FROM voip_carriers 
  WHERE service_provider_sid = ?
)`;
const sqlDeleteSmppGateways = `DELETE from smpp_gateways 
WHERE voip_carrier_sid IN (
  SELECT voip_carrier_sid 
  FROM voip_carriers 
  WHERE service_provider_sid = ?
)`;

/* only admin users can add a service provider */
function validateAdd(req) {
  if (!req.user.hasAdminAuth) {
    throw new DbErrorForbidden('only admin users can add a service provider');
  }
}

async function validateRetrieve(req) {
  try {
    const service_provider_sid = parseServiceProviderSid(req);

    if (req.user.hasScope('admin')) {
      return;
    }

    if (req.user.hasScope('service_provider') || req.user.hasScope('account')) {
      if (service_provider_sid === req.user.service_provider_sid) return;
    }

    throw new DbErrorForbidden('insufficient permissions');
  } catch (error) {
    throw error;
  }
}

function validateUpdate(req) {
  try {
    const service_provider_sid = parseServiceProviderSid(req);

    if (req.user.hasScope('admin')) {
      return;
    }

    if (req.user.hasScope('service_provider')) {
      if (service_provider_sid === req.user.service_provider_sid) return;
    }

    throw new DbErrorForbidden('insufficient permissions to update service provider');
  } catch (error) {
    throw error;
  }
}

/* can not delete a service provider if it has any active accounts or users*/
async function noActiveAccountsOrUsers(req, sid) {
  if (!req.user.hasAdminAuth) {
    throw new DbErrorForbidden('only admin users can delete a service provider');
  }
  const activeAccounts = await ServiceProvider.getForeignKeyReferences('accounts.service_provider_sid', sid);
  const activeUsers = await ServiceProvider.getForeignKeyReferences('users.service_provider_sid', sid);
  if (activeAccounts > 0 && activeUsers > 0) throw new DbErrorForbidden('insufficient privileges');

  if (activeAccounts > 0) throw new DbErrorForbidden('insufficient privileges');
  if (activeUsers > 0) throw new DbErrorForbidden('insufficient privileges');

  /* ok we can delete -- no active accounts.  remove carriers and speech credentials */
  await promisePool.execute('DELETE from speech_credentials WHERE service_provider_sid = ?', [sid]);
  await promisePool.query(sqlDeleteSipGateways, [sid]);
  await promisePool.query(sqlDeleteSmppGateways, [sid]);
  await promisePool.query('DELETE from voip_carriers WHERE service_provider_sid = ?', [sid]);
  await promisePool.query('DELETE from api_keys WHERE service_provider_sid = ?', [sid]);
}

decorate(router, ServiceProvider, ['delete'], preconditions);

router.use('/:sid/RecentCalls', hasServiceProviderPermissions, require('./recent-calls'));
router.use('/:sid/Alerts', hasServiceProviderPermissions, require('./alerts'));
router.use('/:sid/SpeechCredentials', require('./speech-credentials'));
router.use('/:sid/Limits', hasServiceProviderPermissions, require('./limits'));
router.use('/:sid/PredefinedCarriers', hasServiceProviderPermissions, require('./add-from-predefined-carrier'));
router.get('/:sid/Accounts', async(req, res) => {
  const logger = req.app.locals.logger;
  const {limit, page} = req.query;
  try {
    await validateRetrieve(req);
    const service_provider_sid = parseServiceProviderSid(req);
    const account_sid = req.user.hasScope('account') ? req.user.account_sid : null;
    let results;
    if (isPaginationEnabled && limit && page) {
      validateQuery(req.query);
      results = await Account.retrieveAllPaginated(
        service_provider_sid,
        account_sid,
        req.query.limit,
        req.query.page
      );
    } else {
      results = await Account.retrieveAll(service_provider_sid);
    }

    res.status(200).json(results);
  } catch (err) {
    sysError(logger, res, err);
  }
});

router.get('/:sid/Applications', async(req, res) => {
  const logger = req.app.locals.logger;
  try {
    await validateRetrieve(req);
    const service_provider_sid = parseServiceProviderSid(req);
    const account_sid = req.user.hasScope('account') ? req.user.account_sid : null;

    let results;
    if (isPaginationEnabled) {
      validateQuery(req.query);
      results = await Application.retrieveAllPaginated(
        service_provider_sid,
        account_sid,
        req.query.limit,
        req.query.page
      );

    } else {
      results = await Application.retrieveAll(service_provider_sid, account_sid);
    }

    res.status(200).json(results);
  } catch (err) {
    sysError(logger, res, err);
  }
});

router.get('/:sid/Accounts/Availability', async(req, res) => {
  const logger = req.app.locals.logger;
  const { sid } = req.params;
  const { property, value } = req.query;
  try {
    const results = await Account.isPropertyAvailable(property, [sid, value]);

    res.status(200).json(results);
  } catch (err) {
    sysError(logger, res, err);
  }
});

router.get('/:sid/PhoneNumbers', async(req, res) => {
  const logger = req.app.locals.logger;
  try {
    await validateRetrieve(req);
    let results;
    const service_provider_sid = parseServiceProviderSid(req);
    if (isPaginationEnabled) {
      validateQuery(req.query);
      results = await PhoneNumber.retrieveAllForSPPaginated(service_provider_sid, req.query.limit, req.query.page);
      if (req.user.hasScope('account')) {
        results.data = results.data.filter((r) => r.account_sid === req.user.account_sid);
      }
    } else {
      results = await PhoneNumber.retrieveAllForSP(service_provider_sid);
      if (req.user.hasScope('account')) {
        results = results.filter((r) => r.account_sid === req.user.account_sid);
      }
    }

    res.status(200).json(results);
  } catch (err) {
    sysError(logger, res, err);
  }
});

router.get('/:sid/VoipCarriers', async(req, res) => {
  const logger = req.app.locals.logger;
  try {
    await validateRetrieve(req);
    const service_provider_sid = parseServiceProviderSid(req);
    const account_sid = req.user.hasScope('account') ? req.user.account_sid : null;
    let carriers;
    if (isPaginationEnabled) {
      validateQuery(req.query);
      if (account_sid) {
        carriers = await VoipCarrier.retrieveAllPaginated(
          account_sid,
          req.query.limit,
          req.query.page
        );
      } else {
        carriers = await VoipCarrier.retrieveAllForSPPaginated(
          service_provider_sid,
          req.query.limit,
          req.query.page
        );
      }

    } else {
      if (account_sid) {
        carriers = await VoipCarrier.retrieveAll(account_sid);
      } else {
        carriers = await VoipCarrier.retrieveAllForSP(service_provider_sid);
      }
    }

    return res.status(200).json(carriers);
  } catch (err) {
    sysError(logger, res, err);
  }
});
router.post('/:sid/VoipCarriers', async(req, res) => {
  const logger = req.app.locals.logger;
  try {
    validateUpdate(req);
    const service_provider_sid = parseServiceProviderSid(req);
    const uuid = await VoipCarrier.make({...req.body, service_provider_sid});
    res.status(201).json({sid: uuid});
  } catch (err) {
    sysError(logger, res, err);
  }
});
router.put('/:sid/VoipCarriers/:voip_carrier_sid', async(req, res) => {
  const logger = req.app.locals.logger;
  try {
    validateUpdate(req);
    const sid = parseVoipCarrierSid(req);
    const rowsAffected = await VoipCarrier.update(sid, req.body);
    if (rowsAffected === 0) {
      return res.sendStatus(404);
    }
    res.status(204).end();
  } catch (err) {
    sysError(logger, res, err);
  }
});

router.get('/:sid/ApiKeys', async(req, res) => {
  const logger = req.app.locals.logger;
  const { sid } = req.params;
  try {
    await validateRetrieve(req);

    const account_sid = req.user.hasScope('account') ? req.user.account_sid : null;
    let results;
    if (isPaginationEnabled) {
      validateQuery(req.query);
      if (account_sid) {
        results = await ApiKey.retrieveAllPaginated(account_sid, req.query.limit, req.query.page);
      } else {
        results = await ApiKey.retrieveAllForSPPaginated(sid, req.query.limit, req.query.page);
      }

    } else {
      if (account_sid) {
        results = await ApiKey.retrieveAll(account_sid);
      } else {
        results = await ApiKey.retrieveAllForSP(sid);
      }
    }

    res.status(200).json(results);
    await ApiKey.updateLastUsed(sid);
  } catch (err) {
    sysError(logger, res, err);
  }
});

/* add */
router.post('/', async(req, res) => {
  const logger = req.app.locals.logger;
  try {
    validateAdd(req);
    // create webhooks if provided
    const obj = Object.assign({}, req.body);
    for (const prop of ['registration_hook']) {
      if (obj[prop]) {
        obj[`${prop}_sid`] = await Webhook.make(obj[prop]);
        delete obj[prop];
      }
    }

    //logger.debug(`Attempting to add account ${JSON.stringify(obj)}`);
    const uuid = await ServiceProvider.make(obj);
    res.status(201).json({sid: uuid});
  } catch (err) {
    sysError(logger, res, err);
  }
});

/* list */
router.get('/', async(req, res) => {
  const logger = req.app.locals.logger;
  const { limit, page } = req.query;
  try {
    let results;
    if (isPaginationEnabled && limit && page) {
      validateQuery(req.query);
      results = await ServiceProvider.retrieveAllPaginated(req.query.limit, req.query.page);
      if (req.user.hasScope('service_provider') || req.user.hasScope('account')) {
        logger.debug(`Filtering results for ${req.user.service_provider_sid}`);
        results.data = results.data.filter((e) => req.user.service_provider_sid === e.service_provider_sid);
      }

    } else {
      results = await ServiceProvider.retrieveAll();
      if (req.user.hasScope('service_provider') || req.user.hasScope('account')) {
        logger.debug(`Filtering results for ${req.user.service_provider_sid}`);
        results = results.filter((e) => req.user.service_provider_sid === e.service_provider_sid);
      }
    }

    logger.debug({ results, user: req.user }, 'ServiceProvider.retrieveAll');

    res.status(200).json(results);
  } catch (err) {
    sysError(logger, res, err);
  }
});

/* retrieve */
router.get('/:sid', async(req, res) => {
  const logger = req.app.locals.logger;
  try {
    await validateRetrieve(req);
    const sid = parseServiceProviderSid(req);
    const results = await ServiceProvider.retrieve(sid);
    if (results.length === 0) return res.status(404).end();
    return res.status(200).json(results[0]);
  }
  catch (err) {
    sysError(logger, res, err);
  }
});

/* update */
router.put('/:sid', async(req, res) => {
  const logger = req.app.locals.logger;
  try {
    validateUpdate(req);
    const sid = parseServiceProviderSid(req);

    // create webhooks if provided
    const obj = Object.assign({}, req.body);
    for (const prop of ['registration_hook']) {
      if (prop in obj && Object.keys(obj[prop]).length) {
        if ('webhook_sid' in obj[prop]) {
          const sid = obj[prop]['webhook_sid'];
          delete obj[prop]['webhook_sid'];
          await Webhook.update(sid, obj[prop]);
        } else {
          const sid = await Webhook.make(obj[prop]);
          obj[`${prop}_sid`] = sid;
        }
      } else {
        obj[`${prop}_sid`] = null;
      }

      delete obj[prop];
    }

    const rowsAffected = await ServiceProvider.update(sid, obj);
    if (rowsAffected === 0) {
      return res.status(404).end();
    }

    res.status(204).end();
  } catch (err) {
    sysError(logger, res, err);
  }
});

module.exports = router;
