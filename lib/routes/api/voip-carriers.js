const router = require('express').Router();
const {DbErrorBadRequest, DbErrorUnprocessableRequest} = require('../../utils/errors');
const VoipCarrier = require('../../models/voip-carrier');
const {promisePool} = require('../../db');
const decorate = require('./decorate');
const sysError = require('../error');
const { parseVoipCarrierSid } = require('./utils');

/**
 * Validates that a SIP realm/domain value is properly formatted.
 * @param {string} realm - The realm to validate
 * @returns {boolean} - true if valid, false otherwise
 */
const isValidSipRealm = (realm) => {
  if (!realm) return true; // null/undefined is allowed (falls back to gateway IP)

  // Must not have leading/trailing whitespace
  if (realm !== realm.trim()) return false;

  // Must not start with sip: or sips:
  if (/^sips?:/i.test(realm)) return false;

  // Must not contain whitespace
  if (/\s/.test(realm)) return false;

  // Must be a valid domain (contains dot) or valid IPv4
  const isIPv4 = /^(\d{1,3}\.){3}\d{1,3}$/.test(realm);
  const hasDot = realm.includes('.');

  return isIPv4 || hasDot;
};

/**
 * Checks if a string contains any whitespace characters.
 * @param {string} str - The string to check
 * @returns {boolean} - true if whitespace found, false otherwise
 */
const hasWhitespace = (str) => /\s/.test(str);

/**
 * Validates registration-related fields for voip_carriers.
 * @param {object} body - The request body
 * @param {object} existing - Existing carrier data (for updates)
 * @throws {DbErrorBadRequest} - If validation fails
 */
const validateRegistrationFields = (body, existing = null) => {
  const requiresRegister = body.requires_register ?? existing?.requires_register;

  // When requires_register is being enabled or is already enabled
  if (requiresRegister) {
    const username = body.register_username ?? existing?.register_username;
    const password = body.register_password ?? existing?.register_password;

    // register_username is required
    if (!username || (typeof username === 'string' && username.trim() === '')) {
      throw new DbErrorBadRequest('register_username is required when requires_register is true');
    }
    // register_username must not contain whitespace
    if (typeof username === 'string' && hasWhitespace(username)) {
      throw new DbErrorBadRequest('register_username must not contain whitespace');
    }

    // register_password is required
    if (!password || (typeof password === 'string' && password.trim() === '')) {
      throw new DbErrorBadRequest('register_password is required when requires_register is true');
    }
  }

  // Validate register_username format if being set (even when requires_register is false)
  if (body.register_username !== undefined && body.register_username !== null && body.register_username !== '') {
    if (hasWhitespace(body.register_username)) {
      throw new DbErrorBadRequest('register_username must not contain whitespace');
    }
  }

  // Validate register_sip_realm format (if provided)
  if (body.register_sip_realm !== undefined && body.register_sip_realm !== null) {
    if (body.register_sip_realm === '') {
      throw new DbErrorBadRequest('register_sip_realm must not be empty string; use null to fall back to gateway IP');
    }
    if (!isValidSipRealm(body.register_sip_realm)) {
      throw new DbErrorBadRequest(
        'register_sip_realm must be a valid domain or IP address (no sip: prefix, no spaces)'
      );
    }
  }

  // Validate register_from_domain format (if provided)
  if (body.register_from_domain !== undefined &&
      body.register_from_domain !== null &&
      body.register_from_domain !== '') {
    if (!isValidSipRealm(body.register_from_domain)) {
      throw new DbErrorBadRequest(
        'register_from_domain must be a valid domain or IP address (no sip: prefix, no spaces)'
      );
    }
  }
};

const validate = async(req) => {
  const {lookupAppBySid, lookupAccountBySid} = req.app.locals;

  if (process.env.JAMBONES_ADMIN_CARRIER == 1 && (!req.user.hasScope('service_provider')
    && !req.user.hasScope('admin'))) {
    throw new DbErrorBadRequest('insufficient privileges');
  }

  /* account level user can only act on carriers associated to his/her account */
  if (req.user.hasAccountAuth) {
    req.body.account_sid = req.user.account_sid;
  }

  if (req.body.application_sid && !req.body.account_sid) {
    throw new DbErrorBadRequest('account_sid missing');
  }
  if (req.body.application_sid) {
    const application = await lookupAppBySid(req.body.application_sid);
    if (!application) throw new DbErrorBadRequest('unknown application_sid');
    if (application.account_sid !== req.body.account_sid) {
      throw new DbErrorBadRequest('application_sid does not exist for specified account_sid');
    }
  }
  else if (req.body.account_sid) {
    const account = await lookupAccountBySid(req.body.account_sid);
    if (!account) throw new DbErrorBadRequest('unknown account_sid');
  }

  /* validate registration fields */
  validateRegistrationFields(req.body);
};

const validateUpdate = async(req, sid) => {
  const {lookupCarrierBySid, lookupAppBySid, lookupAccountBySid} = req.app.locals;

  if (process.env.JAMBONES_ADMIN_CARRIER == 1 && (!req.user.hasScope('service_provider')
    && !req.user.hasScope('admin'))) {
    throw new DbErrorBadRequest('insufficient privileges');
  }

  /* account level user can only act on carriers associated to his/her account */
  if (req.user.hasAccountAuth) {
    req.body.account_sid = req.user.account_sid;
  }

  if (req.body.application_sid && !req.body.account_sid) {
    throw new DbErrorBadRequest('account_sid missing');
  }
  if (req.body.application_sid) {
    const application = await lookupAppBySid(req.body.application_sid);
    if (!application) throw new DbErrorBadRequest('unknown application_sid');
    if (application.account_sid !== req.body.account_sid) {
      throw new DbErrorBadRequest('application_sid does not exist for specified account_sid');
    }
  }
  else if (req.body.account_sid) {
    const account = await lookupAccountBySid(req.body.account_sid);
    if (!account) throw new DbErrorBadRequest('unknown account_sid');
  }

  /* get existing carrier for validation context */
  const existing = await lookupCarrierBySid(sid);

  if (req.user.hasAccountAuth) {
    /* can only update carriers for the user's account */
    if (existing.account_sid != req.user.account_sid) {
      throw new DbErrorUnprocessableRequest('carrier belongs to a different user');
    }
  }

  /* validate registration fields with existing carrier context */
  validateRegistrationFields(req.body, existing);
};

const validateDelete = async(req, sid) => {
  const {lookupCarrierBySid} = req.app.locals;
  if (process.env.JAMBONES_ADMIN_CARRIER == 1 && (!req.user.hasScope('service_provider')
    && !req.user.hasScope('admin'))) {
    throw new DbErrorBadRequest('insufficient privileges');
  }


  if (req.user.hasAccountAuth) {
    /* can only update carriers for the user's account */
    const carrier = await lookupCarrierBySid(sid);
    if (carrier.account_sid != req.user.account_sid) {
      throw new DbErrorUnprocessableRequest('carrier belongs to a different user');
    }
  }

  /* can not delete a voip provider if it has any active phone numbers */
  const activeAccounts = await VoipCarrier.getForeignKeyReferences('phone_numbers.voip_carrier_sid', sid);
  if (activeAccounts > 0) throw new DbErrorUnprocessableRequest('cannot delete voip carrier with active phone numbers');

  /* remove all the sip and smpp gateways from the carrier first */
  await promisePool.execute('DELETE FROM sip_gateways WHERE voip_carrier_sid = ?', [sid]);
  await promisePool.execute('DELETE FROM smpp_gateways WHERE voip_carrier_sid = ?', [sid]);
};

const preconditions = {
  'add': validate,
  'update': validateUpdate,
  'delete': validateDelete
};

decorate(router, VoipCarrier, ['add', 'update', 'delete'], preconditions);

/* list */
router.get('/', async(req, res) => {
  const logger = req.app.locals.logger;
  const {account_sid: query_account_sid, name, page, page_size} = req.query || {};
  const isPaginationRequest = page !== null && page !== undefined;
  let service_provider_sid = null, account_sid = query_account_sid;
  if (req.user.hasAccountAuth) {
    account_sid = req.user.account_sid;
  } else if (req.user.hasServiceProviderAuth) {
    service_provider_sid = req.user.service_provider_sid;
  }
  try {
    let total = 0;
    if (isPaginationRequest) {
      total = await VoipCarrier.countAll({service_provider_sid, account_sid, name});
    }

    const carriers = await VoipCarrier.retrieveByCriteria({
      service_provider_sid,
      account_sid,
      name,
      page,
      page_size,
    });

    const body = isPaginationRequest ? {
      total,
      page: Number(page),
      page_size: Number(page_size),
      data: carriers,
    } : carriers;

    res.status(200).json(body);
  } catch (err) {
    sysError(logger, res, err);
  }
});

/* retrieve */
router.get('/:sid', async(req, res) => {
  const logger = req.app.locals.logger;
  try {
    const sid = parseVoipCarrierSid(req);
    const account_sid = req.user.hasAccountAuth ? req.user.account_sid : null;
    const results = await VoipCarrier.retrieve(sid, account_sid);
    if (results.length === 0) return res.status(404).end();
    const ret = results[0];
    ret.register_status = JSON.parse(ret.register_status || '{}');

    if (req.user.hasServiceProviderAuth && results.length === 1) {
      if (results.length === 1 && results[0].service_provider_sid !== req.user.service_provider_sid) {
        throw new DbErrorBadRequest('insufficient privileges');
      }
    }
    if (req.user.hasAccountAuth && results.length === 1) {
      if (results.length === 1 && results[0].account_sid !== req.user.account_sid) {
        throw new DbErrorBadRequest('insufficient privileges');
      }
    }

    return res.status(200).json(results[0]);
  }
  catch (err) {
    sysError(logger, res, err);
  }
});

module.exports = router;
