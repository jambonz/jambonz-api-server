const router = require('express').Router();
const {DbErrorBadRequest, DbErrorUnprocessableRequest} = require('../../utils/errors');
const VoipCarrier = require('../../models/voip-carrier');
const {promisePool} = require('../../db');
const decorate = require('./decorate');
const sysError = require('../error');
const { parseVoipCarrierSid } = require('./utils');

const validate = async(req) => {
  const {lookupAppBySid, lookupAccountBySid} = req.app.locals;

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
};

const validateUpdate = async(req, sid) => {
  const {lookupCarrierBySid} = req.app.locals;
  await validate(req);

  if (req.user.hasAccountAuth) {
    /* can only update carriers for the user's account */
    const carrier = await lookupCarrierBySid(sid);
    if (carrier.account_sid != req.user.account_sid) {
      throw new DbErrorUnprocessableRequest('carrier belongs to a different user');
    }
  }
};

const validateDelete = async(req, sid) => {
  const {lookupCarrierBySid} = req.app.locals;
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
  try {
    const results = await VoipCarrier.retrieveAll(req.user.hasAccountAuth ? req.user.account_sid : null);
    res.status(200).json(results);
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
    return res.status(200).json(results[0]);
  }
  catch (err) {
    sysError(logger, res, err);
  }
});

module.exports = router;
