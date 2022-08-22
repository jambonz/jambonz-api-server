const router = require('express').Router();
const request = require('request');
const {DbErrorBadRequest, DbErrorUnprocessableRequest} = require('../../utils/errors');
const Account = require('../../models/account');
const Application = require('../../models/application');
const Webhook = require('../../models/webhook');
const ApiKey = require('../../models/api-key');
const ServiceProvider = require('../../models/service-provider');
const {deleteDnsRecords} = require('../../utils/dns-utils');
const {deleteCustomer} = require('../../utils/stripe-utils');
const { v4: uuidv4 } = require('uuid');
const snakeCase = require('../../utils/snake-case');
const sysError = require('../error');
const {promisePool} = require('../../db');
const {hasAccountPermissions, parseAccountSid, enableSubspace, disableSubspace} = require('./utils');
const short = require('short-uuid');
const VoipCarrier = require('../../models/voip-carrier');
const translator = short();
const SpeechCredential = require('../../models/speech-credential');

let idx = 0;

const getFsUrl = async(logger, retrieveSet, setName) => {
  if (process.env.K8S) return `http://${process.env.K8S_FEATURE_SERVER_SERVICE_NAME}:3000/v1/createCall`;

  try {
    const fs = await retrieveSet(setName);
    if (0 === fs.length) {
      logger.info('No available feature servers to handle createCall API request');
      return ;
    }
    const ip = stripPort(fs[idx++ % fs.length]);
    logger.info({fs}, `feature servers available for createCall API request, selecting ${ip}`);
    return `http://${ip}:3000/v1/createCall`;
  } catch (err) {
    logger.error({err}, 'getFsUrl: error retreving feature servers from redis');
  }
};

const stripPort = (hostport) => {
  const arr = /^(.*):(.*)$/.exec(hostport);
  if (arr) return arr[1];
  return hostport;
};

router.use('/:sid/SpeechCredentials', hasAccountPermissions, require('./speech-credentials'));
router.use('/:sid/RecentCalls', hasAccountPermissions, require('./recent-calls'));
router.use('/:sid/Alerts', hasAccountPermissions, require('./alerts'));
router.use('/:sid/Charges', hasAccountPermissions, require('./charges'));
router.use('/:sid/SipRealms', hasAccountPermissions, require('./sip-realm'));
router.use('/:sid/PredefinedCarriers', hasAccountPermissions, require('./add-from-predefined-carrier'));
router.get('/:sid/Applications', async(req, res) => {
  const logger = req.app.locals.logger;
  try {
    const account_sid = parseAccountSid(req);
    const results = await Application.retrieveAll(null, account_sid);
    res.status(200).json(results);
  } catch (err) {
    sysError(logger, res, err);
  }
});
router.get('/:sid/VoipCarriers', async(req, res) => {
  const logger = req.app.locals.logger;
  try {
    const account_sid = parseAccountSid(req);
    const results = await VoipCarrier.retrieveAll(account_sid);
    res.status(200).json(results);
  } catch (err) {
    sysError(logger, res, err);
  }
});
router.post('/:sid/VoipCarriers', async(req, res) => {
  const logger = req.app.locals.logger;
  const payload = req.body;
  try {
    const account_sid = parseAccountSid(req);
    logger.debug({payload}, 'POST /:sid/VoipCarriers');
    const uuid = await VoipCarrier.make({
      account_sid,
      ...payload
    });
    res.status(201).json({sid: uuid});
  } catch (err) {
    sysError(logger, res, err);
  }
});

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
    'conf_hold_status',
    'conf_mute_status',
    'mute_status',
    'sip_request',
    'record'
  ]
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
      else if (opts.conf_hold_status && opts.waitHook) break;
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
  if (opts.conf_hold_status && !['hold', 'unhold'].includes(opts.conf_hold_status)) {
    throw new DbErrorBadRequest('invalid conf_hold_status');
  }
  if (opts.conf_mute_status && !['mute', 'unmute'].includes(opts.conf_mute_status)) {
    throw new DbErrorBadRequest('invalid conf_mute_status');
  }
  if (opts.sip_request &&
    (!opts.sip_request.method && !opts.sip_request.content_type ||  !opts.sip_request.content_type)) {
    throw new DbErrorBadRequest('sip_request requires content_type and content properties');
  }
  if (opts.record && !opts.record.action) {
    throw new DbErrorBadRequest('record requires action property');
  }
  if ('startCallRecording' === opts.record?.action && !opts.record.siprecServerURL) {
    throw new DbErrorBadRequest('record requires siprecServerURL property when starting recording');
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
    // Fetch Speech provider credential From DB
    let speech_creds = SpeechCredential.retrieveAll(req.user.account_sid);
    if (!speech_creds) {
      speech_creds = SpeechCredential.retrieveAllForSP(req.user.service_provider_sid);
    }

    if (!speech_creds || speech_creds.length === 0)
      throw new DbErrorBadRequest(`missing speech synthesizer for account ${sid}`);
    const enabled_tts = [];
    const enabled_stt = [];
    speech_creds.forEach((cred) => {
      if (cred.use_for_tts) enabled_tts.push(cred);
      if (cred.use_for_stt) enabled_stt.push(cred);
    });
    if (enabled_tts.length === 0)
      throw new DbErrorBadRequest(`missing speech synthesizer for account ${sid}`);
    if (enabled_stt.length === 0)
      throw new DbErrorBadRequest(`missing speech recognizer for account ${sid}`);

    if (!obj.speech_synthesis_vendor) {
      const cred = enabled_tts[Math.floor(Math.random() * enabled_tts.length)];
      Object.assign(obj, {
        speech_synthesis_vendor: cred.vendor,
        speech_synthesis_voice: 'en-US-Wavenet-C',
        speech_synthesis_language: 'en-US'
      });
      if (cred.use_for_stt) {
        Object.assign(obj, {
          speech_recognizer_vendor: cred.vendor,
          speech_recognizer_language: 'en-US'
        });
      } else {
        const cred = enabled_stt[Math.floor(Math.random() * enabled_stt.length)];
        Object.assign(obj, {
          speech_recognizer_vendor: cred.vendor,
          speech_recognizer_language: 'en-US'
        });
      }
    }
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
  if (obj.call_hook && !/^https?:/.test(obj.call_hook.url) && !/^wss?:/.test(obj.call_hook.url)) {
    throw new DbErrorBadRequest('call_hook url be an absolute url');
  }
  if (obj.call_status_hook && !/^https?:/.test(obj.call_status_hook.url) && !/^wss?:/.test(obj.call_status_hook.url)) {
    throw new DbErrorBadRequest('call_status_hook url be an absolute url');
  }
}

async function validateCreateMessage(logger, sid, req) {
  const obj = req.body;
  logger.debug({payload: req.body}, 'validateCreateMessage');

  if (req.user.account_sid !== sid) {
    throw new DbErrorBadRequest(`unauthorized createMessage request for account ${sid}`);
  }

  if (!obj.from) throw new DbErrorBadRequest('missing from property');
  /*
  else {
    const regex = /^\+(\d+)$/;
    const arr = regex.exec(obj.from);
    const from = arr ? arr[1] : obj.from;
    const account = await lookupAccountByPhoneNumber(from);
    if (!account) throw new DbErrorBadRequest(`accountSid ${sid} does not own phone number ${from}`);
  }
  */
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
  if (req.user.hasServiceProviderAuth && req.user.service_provider_sid) {
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
  if (req.user.hasAccountAuth && req.body.sip_realm) {
    throw new DbErrorBadRequest('use POST /Accounts/:sid/sip_realm/:realm to set or change the sip realm');
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
  if (req.user.service_provider_sid && !req.user.hasScope('admin')) {
    const result = await Account.retrieve(sid);
    if (result[0].service_provider_sid !== req.user.service_provider_sid) {
      throw new DbErrorUnprocessableRequest('cannot delete account from different service provider');
    }
  }
}


/* add */
router.post('/', async(req, res) => {
  const logger = req.app.locals.logger;
  try {
    const secret = `wh_secret_${translator.generate()}`;
    await validateAdd(req);

    // create webhooks if provided
    const obj = {...req.body, webhook_secret: secret};
    for (const prop of ['registration_hook', 'queue_event_hook']) {
      if (obj[prop] && obj[prop].url && obj[prop].url.length > 0) {
        obj[`${prop}_sid`] = await Webhook.make(obj[prop]);
      }
      delete obj[prop];
    }

    logger.debug(`Attempting to add account ${JSON.stringify(obj)}`);
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

router.get('/:sid/WebhookSecret', async(req, res) => {
  const logger = req.app.locals.logger;
  try {
    const service_provider_sid = req.user.hasServiceProviderAuth ? req.user.service_provider_sid : null;
    const results = await Account.retrieve(req.params.sid, service_provider_sid);
    if (results.length === 0) return res.status(404).end();
    let {webhook_secret} = results[0];
    if (req.query.regenerate) {
      const secret = `wh_secret_${translator.generate()}`;
      await Account.update(req.params.sid, {webhook_secret: secret});
      webhook_secret = secret;
    }
    return res.status(200).json({webhook_secret});
  }
  catch (err) {
    sysError(logger, res, err);
  }
});

router.post('/:sid/SubspaceTeleport', async(req, res) => {
  const logger = req.app.locals.logger;
  try {
    const service_provider_sid = req.user.hasServiceProviderAuth ? req.user.service_provider_sid : null;
    const results = await Account.retrieve(req.params.sid, service_provider_sid);
    if (results.length === 0) return res.status(404).end();
    const {subspace_client_id, subspace_client_secret} = results[0];
    const {destination} = req.body;
    const arr = /^(.*):\d+$/.exec(destination);
    const dest = arr ? `sip:${arr[1]}` : `sip:${destination}`;

    const teleport = await enableSubspace({
      subspace_client_id,
      subspace_client_secret,
      destination: dest
    });
    logger.info({destination, teleport}, 'SubspaceTeleport - create teleport');
    await Account.update(req.params.sid, {
      subspace_sip_teleport_id: teleport.id,
      subspace_sip_teleport_destinations: JSON.stringify(teleport.teleport_entry_points)//hacky
    });

    return res.status(200).json({
      subspace_sip_teleport_id: teleport.id,
      subspace_sip_teleport_destinations: teleport.teleport_entry_points
    });
  }
  catch (err) {
    sysError(logger, res, err);
  }
});

router.delete('/:sid/SubspaceTeleport', async(req, res) => {
  const logger = req.app.locals.logger;
  try {
    const service_provider_sid = req.user.hasServiceProviderAuth ? req.user.service_provider_sid : null;
    const results = await Account.retrieve(req.params.sid, service_provider_sid);
    if (results.length === 0) return res.status(404).end();
    const {subspace_client_id, subspace_client_secret, subspace_sip_teleport_id} = results[0];

    await disableSubspace({subspace_client_id, subspace_client_secret, subspace_sip_teleport_id});
    await Account.update(req.params.sid, {
      subspace_sip_teleport_id: null,
      subspace_sip_teleport_destinations: null
    });
    return res.sendStatus(204);
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
      if (prop in obj) {
        if (null === obj[prop] || !obj[prop].url || 0 === obj[prop].url.length) {
          obj[`${prop}_sid`] = null;
        }
        else if (typeof obj[prop] === 'object') {
          if ('webhook_sid' in obj[prop]) {
            const sid = obj[prop]['webhook_sid'];
            await Webhook.update(sid, obj[prop]);
          }
          else {
            const sid = await Webhook.make(obj[prop]);
            obj[`${prop}_sid`] = sid;
          }
        }
      }
    }

    await validateUpdate(req, sid);

    if (Object.keys(obj).length) {
      let orphanedRegHook, orphanedQueueHook;
      if (null === obj.registration_hook) {
        const results = await Account.retrieve(sid);
        if (results.length && results[0].registration_hook_sid) orphanedRegHook = results[0].registration_hook_sid;
        obj.registration_hook_sid = null;
      }
      if (null === obj.queue_event_hook) {
        const results = await Account.retrieve(sid);
        if (results.length && results[0].queue_event_hook_sid) orphanedQueueHook = results[0].queue_event_hook_sid;
        obj.queue_event_hook_sid = null;
      }
      delete obj.registration_hook;
      delete obj.queue_event_hook;

      const rowsAffected = await Account.update(sid, obj);
      if (rowsAffected === 0) {
        return res.status(404).end();
      }
      if (orphanedRegHook) {
        await Webhook.remove(orphanedRegHook);
      }
      if (orphanedQueueHook) {
        await Webhook.remove(orphanedQueueHook);
      }
    }

    res.status(204).end();
    updateLastUsed(logger, sid, req).catch((err) => {});
  } catch (err) {
    sysError(logger, res, err);
  }
});

/* delete */
router.delete('/:sid', async(req, res) => {
  const sid = req.params.sid;
  const logger = req.app.locals.logger;
  const sqlDeleteGateways = `DELETE from sip_gateways 
    WHERE voip_carrier_sid IN
    (SELECT voip_carrier_sid from voip_carriers where account_sid = ?)`;
  try {
    await validateDelete(req, sid);

    const [account] = await promisePool.query('SELECT * FROM accounts WHERE account_sid = ?', sid);
    const {sip_realm, stripe_customer_id, registration_hook_sid} = account[0];
    /* remove dns records */
    if (process.env.NODE_ENV !== 'test' || process.env.DME_API_KEY) {

      /* retrieve existing dns records */
      const [recs] = await promisePool.query('SELECT record_id from dns_records WHERE account_sid = ?', sid);

      if (recs.length > 0) {
        /* remove existing records from the database and dns provider */
        const arr = /(.*)\.(.*\..*)$/.exec(sip_realm);
        if (!arr) throw new DbErrorBadRequest(`invalid sip_realm: ${sip_realm}`);
        const domain = arr[2];

        await promisePool.query('DELETE from dns_records WHERE account_sid = ?', sid);
        const deleted = await deleteDnsRecords(logger, domain, recs.map((r) => r.record_id));
        if (!deleted) {
          logger.error({recs, sip_realm, sid},
            'Failed to remove old dns records when changing sip_realm for account');
        }
      }
    }

    await promisePool.execute('DELETE from api_keys where account_sid = ?', [sid]);
    await promisePool.execute(
    // eslint-disable-next-line indent
`DELETE from account_products 
WHERE account_subscription_sid IN 
(SELECT account_subscription_sid FROM 
account_subscriptions WHERE account_sid = ?)
`, [sid]);
    await promisePool.execute('DELETE from account_subscriptions WHERE account_sid = ?', [sid]);
    await promisePool.execute('DELETE from speech_credentials where account_sid = ?', [sid]);
    await promisePool.execute('DELETE from users where account_sid = ?', [sid]);
    await promisePool.execute('DELETE from phone_numbers where account_sid = ?', [sid]);
    await promisePool.execute('DELETE from call_routes where account_sid = ?', [sid]);
    await promisePool.execute('DELETE from ms_teams_tenants where account_sid = ?', [sid]);
    await promisePool.execute(sqlDeleteGateways, [sid]);
    await promisePool.execute('DELETE from voip_carriers where account_sid = ?', [sid]);
    await promisePool.execute('DELETE from applications where account_sid = ?', [sid]);
    await promisePool.execute('DELETE from accounts where account_sid = ?', [sid]);

    if (registration_hook_sid) {
      /* remove registration hook if only used by this account */
      const sql = 'SELECT COUNT(*) as count FROM accounts WHERE registration_hook_sid = ?';
      const [r] = await promisePool.query(sql, registration_hook_sid);
      if (r[0]?.count === 0) {
        await promisePool.execute('DELETE from webhooks where webhook_sid = ?', [registration_hook_sid]);
      }
    }

    if (stripe_customer_id) {
      const response = await deleteCustomer(logger, stripe_customer_id);
      logger.info({response}, `deleted stripe customer_id ${stripe_customer_id} for account_si ${sid}`);
    }
    res.status(204).end();
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

  const serviceUrl = await getFsUrl(logger, retrieveSet, setName);
  if (!serviceUrl) res.json({msg: 'no available feature servers at this time'}).status(480);
  try {
    await validateCreateCall(logger, sid, req);

    updateLastUsed(logger, sid, req).catch((err) => {});
    request({
      url: serviceUrl,
      method: 'POST',
      json: true,
      body: Object.assign(req.body, {account_sid: sid})
    }, (err, response, body) => {
      if (err) {
        logger.error(err, `Error sending createCall POST to ${serviceUrl}`);
        return res.sendStatus(500);
      }
      if (response.statusCode !== 201) {
        logger.error({statusCode: response.statusCode}, `Non-success response returned by createCall ${serviceUrl}`);
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
  const account_sid = parseAccountSid(req);
  const setName = `${(process.env.JAMBONES_CLUSTER_ID || 'default')}:active-fs`;
  const {retrieveSet, logger} = req.app.locals;

  try {
    const serviceUrl = await getFsUrl(logger, retrieveSet, setName);
    if (!serviceUrl) res.json({msg: 'no available feature servers at this time'}).status(480);
    await validateCreateMessage(logger, account_sid, req);

    const payload = {
      message_sid: uuidv4(),
      account_sid,
      ...req.body
    };
    logger.debug({payload}, `sending createMessage API request to to ${serviceUrl}`);
    updateLastUsed(logger, account_sid, req).catch(() => {});
    request({
      url: serviceUrl,
      method: 'POST',
      json: true,
      body: payload
    }, (err, response, body) => {
      if (err) {
        logger.error(err, `Error sending createMessage POST to ${serviceUrl}`);
        return res.sendStatus(500);
      }
      if (response.statusCode !== 200) {
        logger.error({statusCode: response.statusCode}, `Non-success response returned by createMessage ${serviceUrl}`);
        return body ? res.status(response.statusCode).json(body) : res.sendStatus(response.statusCode);
      }
      res.status(201).json(body);
    });
  } catch (err) {
    sysError(logger, res, err);
  }
});

module.exports = router;
