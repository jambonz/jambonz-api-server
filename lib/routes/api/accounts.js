const router = require('express').Router();
const request = require('request');
const {DbErrorBadRequest, DbErrorUnprocessableRequest} = require('../../utils/errors');
const Account = require('../../models/account');
const Webhook = require('../../models/webhook');
const ApiKey = require('../../models/api-key');
const ServiceProvider = require('../../models/service-provider');
const uuidv4 = require('uuid/v4');
const snakeCase = require('../../utils/snake-case');
const sysError = require('./error');
const {promisePool} = require('../../db');
const {hasAccountPermissions} = require('./utils');
let idx = 0;

router.use('/:sid/Queues', hasAccountPermissions, require('./queues'));

function coerceNumbers(callInfo) {
  if (Array.isArray(callInfo)) {
    return callInfo.map((ci) => {
      if (ci.duration) ci.duration = parseInt(ci.duration);
      if (ci.sip_status) ci.sip_status = parseInt(ci.sip_status);
      return ci;
    });
  }
  if (callInfo.duration) callInfo.duration = parseInt(callInfo.duration);
  if (callInfo.sip_status) callInfo.sip_status = parseInt(callInfo.sip_status);
  return callInfo;
}

async function updateLastUsed(logger, sid, req) {
  if (req.user.hasAdminAuth || req.user.hasServiceProviderAuth) return;
  try {
    await ApiKey.updateLastUsed(sid);
  } catch (err) {
    logger.error({err}, `Error updating last used for accountSid ${sid}`);
  }
}

function validateUpdateCall(opts) {
  // only one type of update can be supplied per request
  const hasWhisper = opts.whisper;
  const count = [
    'call_hook',
    'child_call_hook',
    'call_status',
    'listen_status',
    'mute_status']
    .reduce((acc, prop) => (opts[prop] ? ++acc : acc), 0);

  switch (count) {
    case 0:
      // whisper is allowed on its own, or with one of the others
      if (!hasWhisper) throw new DbErrorBadRequest('no valid options supplied to updateCall');
      break;
    case 1:
      // good
      break;
    case 2:
      if (opts.call_hook && opts.child_call_hook) break;
    // eslint-disable-next-line no-fallthrough
    default:
      throw new DbErrorBadRequest('multiple options are not allowed in updateCall');
  }

  if (opts.call_status && !['completed', 'no-answer'].includes(opts.call_status)) {
    throw new DbErrorBadRequest('invalid call_status');
  }
  if (opts.listen_status && !['pause', 'silence', 'resume'].includes(opts.listen_status)) {
    throw new DbErrorBadRequest('invalid listen_status');
  }
  if (opts.mute_status && !['mute', 'unmute'].includes(opts.mute_status)) {
    throw new DbErrorBadRequest('invalid mute_status');
  }
}

function validateTo(to) {
  if (to && typeof to === 'object') {
    switch (to.type) {
      case 'phone':
      case 'teams':
        if (typeof to.number === 'string') return;
        break;
      case 'user':
        if (typeof to.name === 'string') return;
        break;
      case 'sip':
        if (typeof to.sipUri === 'string') return;
        break;
    }
  }
  throw new DbErrorBadRequest(`missing or invalid to property: ${JSON.stringify(to)}`);
}
async function validateCreateCall(logger, sid, req) {
  const {lookupAppBySid} = req.app.locals;
  const obj = req.body;

  if (req.user.account_sid !== sid) throw new DbErrorBadRequest(`unauthorized createCall request for account ${sid}`);

  obj.account_sid = sid;
  if (!obj.from) throw new DbErrorBadRequest('missing from parameter');
  validateTo(obj.to);

  if (obj.application_sid) {
    try {
      logger.debug(`Accounts:validateCreateCall retrieving application ${obj.application_sid}`);
      const application = await lookupAppBySid(obj.application_sid);
      Object.assign(obj, {
        call_hook: application.call_hook,
        call_status_hook: application.call_status_hook,
        speech_synthesis_vendor: application.speech_synthesis_vendor,
        speech_synthesis_language: application.speech_synthesis_language,
        speech_synthesis_voice: application.speech_synthesis_voice,
        speech_recognizer_vendor: application.speech_recognizer_vendor,
        speech_recognizer_language: application.speech_recognizer_language
      });
      logger.debug({obj, application}, 'Accounts:validateCreateCall augmented with application settings');
    } catch (err) {
      logger.error(err, `Accounts:validateCreateCall error retrieving application for sid ${obj.application_sid}`);
      throw new DbErrorBadRequest(`application_sid not found ${obj.application_sid}`);
    }
  }
  else {
    delete obj.application_sid;

    // TODO: these should be retrieved from account, using account_sid if provided
    Object.assign(obj, {
      speech_synthesis_vendor: 'google',
      speech_synthesis_voice: 'en-US-Wavenet-C',
      speech_synthesis_language: 'en-US',
      speech_recognizer_vendor: 'google',
      speech_recognizer_language: 'en-US'
    });
  }

  if (!obj.call_hook && !obj.application_sid) {
    throw new DbErrorBadRequest('either call_hook or application_sid required');
  }
  if (typeof obj.call_hook === 'string') {
    const url = obj.call_hook;
    obj.call_hook = {
      url,
      method: 'POST'
    };
  }
  if (typeof obj.call_status_hook === 'string') {
    const url = obj.call_status_hook;
    obj.call_status_hook = {
      url,
      method: 'POST'
    };
  }
  if (typeof obj.call_hook === 'object' && typeof obj.call_hook.url != 'string') {
    throw new DbErrorBadRequest('call_hook must be string or an object containing a url property');
  }
  if (typeof obj.call_status_hook === 'object' && typeof obj.call_status_hook.url != 'string') {
    throw new DbErrorBadRequest('call_status_hook must be string or an object containing a url property');
  }
  if (obj.call_hook && !/^https?:/.test(obj.call_hook.url)) {
    throw new DbErrorBadRequest('call_hook url be an absolute url');
  }
  if (obj.call_status_hook && !/^https?:/.test(obj.call_status_hook.url)) {
    throw new DbErrorBadRequest('call_status_hook url be an absolute url');
  }
}

async function validateCreateMessage(logger, sid, req) {
  const obj = req.body;
  const {lookupAccountByPhoneNumber} = req.app.locals;

  if (req.user.account_sid !== sid) {
    throw new DbErrorBadRequest(`unauthorized createMessage request for account ${sid}`);
  }

  if (!obj.from) throw new DbErrorBadRequest('missing from property');
  else {
    const regex = /^\+(\d+)$/;
    const arr = regex.exec(obj.from);
    const from = arr ? arr[1] : obj.from;
    const account = await lookupAccountByPhoneNumber(from);
    if (!account) throw new DbErrorBadRequest(`accountSid ${sid} does not own phone number ${from}`);
  }

  if (!obj.to) throw new DbErrorBadRequest('missing to property');

  if (!obj.text && !obj.media) {
    throw new DbErrorBadRequest('either text or media required in outbound message');
  }
}

async function validateAdd(req) {
  /* account-level token can not be used to add accounts */
  if (req.user.hasAccountAuth) {
    throw new DbErrorUnprocessableRequest('insufficient permissions to create accounts');
  }
  if (req.user.hasServiceProviderAuth) {
    /* service providers can only create accounts under themselves */
    req.body.service_provider_sid = req.user.service_provider_sid;
  }
  if (req.body.service_provider_sid) {
    const result = await ServiceProvider.retrieve(req.body.service_provider_sid);
    if (!result || result.length === 0) {
      throw new DbErrorBadRequest(`service_provider not found for sid ${req.body.service_provider_sid}`);
    }
  }
  if (req.body.registration_hook && typeof req.body.registration_hook !== 'object') {
    throw new DbErrorBadRequest('\'registration_hook\' must be an object when adding an account');
  }
  if (req.body.queue_event_hook && typeof req.body.queue_event_hook !== 'object') {
    throw new DbErrorBadRequest('\'queue_event_hook\' must be an object when adding an account');
  }
}
async function validateUpdate(req, sid) {
  if (req.user.hasAccountAuth && req.user.account_sid !== sid) {
    throw new DbErrorUnprocessableRequest('insufficient privileges to update this account');
  }

  if (req.user.service_provider_sid && !req.user.hasScope('admin')) {
    const result = await Account.retrieve(sid);
    if (result[0].service_provider_sid !== req.user.service_provider_sid) {
      throw new DbErrorUnprocessableRequest('cannot update account from different service provider');
    }
  }
  if (req.body.service_provider_sid) throw new DbErrorBadRequest('service_provider_sid may not be modified');
}
async function validateDelete(req, sid) {
  if (req.user.hasAccountAuth && req.user.account_sid !== sid) {
    throw new DbErrorUnprocessableRequest('insufficient privileges to update this account');
  }
  const assignedPhoneNumbers = await Account.getForeignKeyReferences('phone_numbers.account_sid', sid);
  if (assignedPhoneNumbers > 0) throw new DbErrorUnprocessableRequest('cannot delete account with phone numbers');
  if (req.user.service_provider_sid && !req.user.hasScope('admin')) {
    const result = await Account.retrieve(sid);
    if (result[0].service_provider_sid !== req.user.service_provider_sid) {
      throw new DbErrorUnprocessableRequest('cannot delete account from different service provider');
    }
  }
}

/* delete */
router.delete('/:sid', async(req, res) => {
  const sid = req.params.sid;
  const logger = req.app.locals.logger;
  try {
    await validateDelete(req, sid);

    /* delete associated webhooks */
    const webhooks = [];
    const [results] = await promisePool.query('SELECT * FROM accounts where account_sid = ?', sid);
    if (results.length) {
      if (results[0].registration_hook_sid) webhooks.push(results[0].registration_hook_sid);
      if (results[0].queue_event_hook_sid) webhooks.push(results[0].queue_event_hook_sid);
    }
    await Account.remove(sid);

    for (const wh of webhooks) {
      promisePool.execute('DELETE from webhooks where webhook_sid = ?', [wh])
        .catch((err) => logger.info({err, webhooks}, 'DELETE /Accounts Error deleting webhooks'));
    }

    res.sendStatus(204);
  } catch (err) {
    sysError(logger, res, err);
  }
});

/* add */
router.post('/', async(req, res) => {
  const logger = req.app.locals.logger;
  try {
    await validateAdd(req);

    // create webhooks if provided
    const obj = Object.assign({}, req.body);
    for (const prop of ['registration_hook', 'queue_event_hook']) {
      if (obj[prop]) {
        obj[`${prop}_sid`] = await Webhook.make(obj[prop]);
        delete obj[prop];
      }
    }

    //logger.debug(`Attempting to add account ${JSON.stringify(obj)}`);
    const uuid = await Account.make(obj);
    res.status(201).json({sid: uuid});
  } catch (err) {
    sysError(logger, res, err);
  }
});

/* list */
router.get('/', async(req, res) => {
  const logger = req.app.locals.logger;
  try {
    const service_provider_sid = req.user.hasServiceProviderAuth ? req.user.service_provider_sid : null;
    const account_sid = req.user.hasAccountAuth ? req.user.account_sid : null;
    const results = await Account.retrieveAll(service_provider_sid, account_sid);
    res.status(200).json(results);
  } catch (err) {
    sysError(logger, res, err);
  }
});

/* retrieve */
router.get('/:sid', async(req, res) => {
  const logger = req.app.locals.logger;
  try {
    const service_provider_sid = req.user.hasServiceProviderAuth ? req.user.service_provider_sid : null;
    const results = await Account.retrieve(req.params.sid, service_provider_sid);
    if (results.length === 0) return res.status(404).end();
    return res.status(200).json(results[0]);
  }
  catch (err) {
    sysError(logger, res, err);
  }
});

/* update */
router.put('/:sid', async(req, res) => {
  const sid = req.params.sid;
  const logger = req.app.locals.logger;
  try {

    // create webhooks if provided
    const obj = Object.assign({}, req.body);
    for (const prop of ['registration_hook', 'queue_event_hook']) {
      if (prop in obj && Object.keys(obj[prop]).length) {
        if ('webhook_sid' in obj[prop]) {
          const sid = obj[prop]['webhook_sid'];
          delete obj[prop]['webhook_sid'];
          await Webhook.update(sid, obj[prop]);
        }
        else {
          const sid = await Webhook.make(obj[prop]);
          obj[`${prop}_sid`] = sid;
        }
      }
      delete obj[prop];
    }
    await validateUpdate(req, sid);

    if (Object.keys(obj).length) {
      const orphanedHooks = [];
      if (null === obj.registration_hook || null == obj.queue_event_hook) {
        const results = await Account.retrieve(sid);
        if (results.length) {
          if (results[0].registration_hook_sid) orphanedHooks.push(results[0].registration_hook_sid);
          if (results[0].queue_event_hook_sid) orphanedHooks.push(results[0].queue_event_hook_sid);
        }
        if (null === obj.registration_hook) {
          obj.registration_hook_sid = null;
          delete obj.registration_hook;
        }
        if (null === obj.queue_event_hook) {
          obj.queue_event_hook_sid = null;
          delete obj.queue_event_hook;
        }
      }
      logger.info({obj}, `about to update Account ${sid}`);
      const rowsAffected = await Account.update(sid, obj);
      if (rowsAffected === 0) {
        return res.status(404).end();
      }
      if (orphanedHooks.length) {
        for (const sid in orphanedHooks) {
          await Webhook.remove(sid);
        }
      }
    }

    res.status(204).end();
    updateLastUsed(logger, sid, req).catch((err) => {});
  } catch (err) {
    sysError(logger, res, err);
  }
});

/* retrieve account level api keys */
router.get('/:sid/ApiKeys', async(req, res) => {
  const logger = req.app.locals.logger;
  try {
    const results = await ApiKey.retrieveAll(req.params.sid);
    res.status(200).json(results);
    updateLastUsed(logger, req.params.sid, req).catch((err) => {});
  } catch (err) {
    sysError(logger, res, err);
  }
});

/**
 * create a new Call
 */
router.post('/:sid/Calls', async(req, res) => {
  const sid = req.params.sid;
  const setName = `${(process.env.JAMBONES_CLUSTER_ID || 'default')}:active-fs`;
  const {retrieveSet, logger} = req.app.locals;

  try {
    const fs = await retrieveSet(setName);
    if (0 === fs.length) {
      logger.info('No available feature servers to handle createCall API request');
      return res.json({msg: 'no available feature servers at this time'}).status(500);
    }
    const ip = fs[idx++ % fs.length];
    logger.info({fs}, `feature servers available for createCall API request, selecting ${ip}`);
    const serviceUrl = `http://${ip}:3000/v1/createCall`;
    await validateCreateCall(logger, sid, req);

    logger.debug({payload: req.body}, `sending createCall API request to to ${ip}`);
    updateLastUsed(logger, sid, req).catch((err) => {});
    request({
      url: serviceUrl,
      method: 'POST',
      json: true,
      body: Object.assign(req.body, {account_sid: sid})
    }, (err, response, body) => {
      if (err) {
        logger.error(err, `Error sending createCall POST to ${ip}`);
        return res.sendStatus(500);
      }
      if (response.statusCode !== 201) {
        logger.error({statusCode: response.statusCode}, `Non-success response returned by createCall ${ip}`);
        return res.sendStatus(500);
      }
      res.status(201).json(body);
    });
  } catch (err) {
    sysError(logger, res, err);
  }
});

/**
 * retrieve info for a group of calls under an account
 */
router.get('/:sid/Calls', async(req, res) => {
  const accountSid = req.params.sid;
  const {logger, listCalls} = req.app.locals;

  try {
    const calls = await listCalls(accountSid);
    logger.debug(`retrieved ${calls.length} calls for account sid ${accountSid}`);
    res.status(200).json(coerceNumbers(snakeCase(calls)));
    updateLastUsed(logger, accountSid, req).catch((err) => {});
  } catch (err) {
    sysError(logger, res, err);
  }
});

/**
 * retrieve single call
 */
router.get('/:sid/Calls/:callSid', async(req, res) => {
  const accountSid = req.params.sid;
  const callSid = req.params.callSid;
  const {logger, retrieveCall} = req.app.locals;

  try {
    const callInfo = await retrieveCall(accountSid, callSid);
    if (callInfo) {
      logger.debug(callInfo, `retrieved call info for call sid ${callSid}`);
      res.status(200).json(coerceNumbers(snakeCase(callInfo)));
    }
    else {
      logger.debug(`call not found for call sid ${callSid}`);
      res.sendStatus(404);
    }
    updateLastUsed(logger, accountSid, req).catch((err) => {});
  } catch (err) {
    sysError(logger, res, err);
  }
});

/**
 * delete call
 */
router.delete('/:sid/Calls/:callSid', async(req, res) => {
  const accountSid = req.params.sid;
  const callSid = req.params.callSid;
  const {logger, deleteCall} = req.app.locals;

  try {
    const result = await deleteCall(accountSid, callSid);
    if (result) {
      logger.debug(`successfully deleted call ${callSid}`);
      res.sendStatus(204);
    }
    else {
      logger.debug(`call not found for call sid ${callSid}`);
      res.sendStatus(404);
    }
    updateLastUsed(logger, accountSid, req).catch((err) => {});
  } catch (err) {
    sysError(logger, res, err);
  }
});

/**
 * update a call
 */
const updateCall = async(req, res) => {
  const accountSid = req.params.sid;
  const callSid = req.params.callSid;
  const {logger, retrieveCall} = req.app.locals;

  try {
    validateUpdateCall(req.body);
    const call = await retrieveCall(accountSid, callSid);
    if (call) {
      const url = `${call.serviceUrl}/${process.env.JAMBONES_API_VERSION || 'v1'}/updateCall/${callSid}`;
      logger.debug({call, url, payload: req.body}, `updateCall: retrieved call info for call sid ${callSid}`);
      request({
        url: url,
        method: 'POST',
        json: true,
        body: req.body
      }).pipe(res);
    }
    else {
      logger.debug(`updateCall: call not found for call sid ${callSid}`);
      res.sendStatus(404);
    }
    updateLastUsed(logger, accountSid, req).catch((err) => {});
  } catch (err) {
    sysError(logger, res, err);
  }
};

/** leaving for legacy purposes, this should have been (and now is) a PUT */
router.post('/:sid/Calls/:callSid', async(req, res) => {
  await updateCall(req, res);
});
router.put('/:sid/Calls/:callSid', async(req, res) => {
  await updateCall(req, res);
});

/**
 * create a new Message
 */
router.post('/:sid/Messages', async(req, res) => {
  const sid = req.params.sid;
  const setName = `${(process.env.JAMBONES_CLUSTER_ID || 'default')}:active-fs`;
  const {retrieveSet, logger} = req.app.locals;

  try {
    const fs = await retrieveSet(setName);
    if (0 === fs.length) {
      logger.info('No available feature servers to handle createMessage API request');
      return res.json({msg: 'no available feature servers at this time'}).status(500);
    }
    const ip = fs[idx++ % fs.length];
    logger.info({fs}, `feature servers available for createMessage API request, selecting ${ip}`);
    const serviceUrl = `http://${ip}:3000/v1/createMessage/${sid}`;
    await validateCreateMessage(logger, sid, req);

    const payload = Object.assign({messageSid: uuidv4(), account_sid: sid}, req.body);
    logger.debug({payload}, `sending createMessage API request to to ${ip}`);
    updateLastUsed(logger, sid, req).catch((err) => {});
    request({
      url: serviceUrl,
      method: 'POST',
      json: true,
      body: payload
    }, (err, response, body) => {
      if (err) {
        logger.error(err, `Error sending createMessage POST to ${ip}`);
        return res.sendStatus(500);
      }
      if (response.statusCode !== 200) {
        logger.error({statusCode: response.statusCode}, `Non-success response returned by createMessage ${serviceUrl}`);
        return res.sendStatus(500);
      }
      res.status(201).json(body);
    });
  } catch (err) {
    sysError(logger, res, err);
  }
});

module.exports = router;
