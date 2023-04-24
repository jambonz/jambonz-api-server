const router = require('express').Router();
const Lcr = require('../../models/lcr');
const LcrCarrierSetEntry = require('../../models/lcr-carrier-set-entry');
const LcrRoutes = require('../../models/lcr-route');
const decorate = require('./decorate');
const {DbErrorBadRequest} = require('../../utils/errors');
const sysError = require('../error');

const validateAssociatedTarget = async(req, sid) => {
  const {lookupAccountBySid} = req.app.locals;
  if (req.body.account_sid) {
    // Add only for account
    req.body.service_provider_sid = null;
    const account = await lookupAccountBySid(req.body.account_sid);
    if (!account) throw new DbErrorBadRequest('unknown account_sid');
    const lcr = await Lcr.retrieveAllByAccountSid(req.body.account_sid);
    if (lcr.length > 0 && (!sid || sid !== lcr[0].lcr_sid)) {
      throw new DbErrorBadRequest(`Account ${req.body.account_sid} already associated with ${lcr[0].lcr_sid}`);
    }
  } else if (req.body.service_provider_sid) {
    const lcr = await Lcr.retrieveAllByServiceProviderSid(req.body.service_provider_sid);
    if (lcr.length > 0 && (!sid || sid !== lcr[0].lcr_sid)) {
      throw new DbErrorBadRequest(`Service Provider ${req.body.service_provider_sid}
       already associated with ${lcr[0].lcr_sid}`);
    }
  }
};

const validateAdd = async(req) => {
  if (req.user.hasAccountAuth) {
    // Account just create LCR for himself
    req.body.account_sid = req.user.account_sid;
  } else if (req.user.hasServiceProviderAuth) {
    // SP just can create LCR for himself
    req.body.service_provider_sid = req.user.service_provider_sid;
    req.body.account_sid = null;
  }

  await validateAssociatedTarget(req);
  // check if lcr_carrier_set_entry is available
  if (req.body.lcr_carrier_set_entry) {
    const e = await LcrCarrierSetEntry.retrieve(req.body.lcr_carrier_set_entry);
    if (e.length === 0) throw new DbErrorBadRequest('unknown lcr_carrier_set_entry');
  }

};

const validateUserPermissionForExistingEntity = async(req, sid) => {
  const r = await Lcr.retrieve(sid);
  if (r.length === 0) {
    throw new DbErrorBadRequest('unknown lcr_sid');
  }
  const lcr = r[0];
  if (req.user.hasAccountAuth) {
    if (lcr.account_sid != req.user.account_sid) {
      throw new DbErrorBadRequest('unknown lcr_sid');
    }
  } else if (req.user.hasServiceProviderAuth) {
    if (lcr.service_provider_sid != req.user.service_provider_sid) {
      throw new DbErrorBadRequest('unknown lcr_sid');
    }
  }
};

const validateUpdate = async(req, sid) => {
  await validateUserPermissionForExistingEntity(req, sid);
  await validateAssociatedTarget(req, sid);
};

const validateDelete = async(req, sid) => {
  if (req.user.hasAccountAuth) {
    /* can only delete Lcr for the user's account */
    const r = await Lcr.retrieve(sid);
    const lcr = r.length > 0 ? r[0] : null;
    if (!lcr || (req.user.account_sid && lcr.account_sid != req.user.account_sid)) {
      throw new DbErrorBadRequest('unknown lcr_sid');
    }
  }
  // fetch lcr route
  const lcr_routes = await LcrRoutes.retrieveAllByLcrSid(sid);
  // delete all lcr carrier set entries
  for (const e of lcr_routes) {
    await LcrCarrierSetEntry.deleteByLcrRouteSid(e.lcr_route_sid);
  }

  // delete all lcr routes
  await LcrRoutes.deleteByLcrSid(sid);
};

const preconditions = {
  add: validateAdd,
  update: validateUpdate,
  delete: validateDelete
};

decorate(router, Lcr, ['add', 'update', 'delete'], preconditions);

router.get('/', async(req, res) => {
  const logger = req.app.locals.logger;
  try {
    const results = req.user.hasAdminAuth ?
      await Lcr.retrieveAll() : req.user.hasAccountAuth ?
        await Lcr.retrieveAllByAccountSid(req.user.hasAccountAuth ? req.user.account_sid : null) :
        await Lcr.retrieveAllByServiceProviderSid(req.user.service_provider_sid);

    res.status(200).json(results);
  } catch (err) {
    sysError(logger, res, err);
  }
});

router.get('/:sid', async(req, res) => {
  const logger = req.app.locals.logger;
  try {
    const results = await Lcr.retrieve(req.params.sid);
    if (results.length === 0) return res.sendStatus(404);
    const lcr = results[0];
    if (req.user.hasAccountAuth && lcr.account_sid !== req.user.account_sid) {
      return res.sendStatus(404);
    } else if (req.user.hasServiceProviderAuth && lcr.service_provider_sid !== req.user.service_provider_sid) {
      return res.sendStatus(404);
    }
    return res.status(200).json(results[0]);
  } catch (err) {
    sysError(logger, res, err);
  }
});

module.exports = router;
