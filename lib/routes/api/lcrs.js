const router = require('express').Router();
const Lcr = require('../../models/lcr');
const LcrCarrierSetEntry = require('../../models/lcr-carrier-set-entry');
const LcrRoutes = require('../../models/lcr-route');
const decorate = require('./decorate');
const {DbErrorBadRequest} = require('../../utils/errors');
const sysError = require('../error');
const { parseLcrSid } = require('./utils');

const validateAdd = async(req) => {
  const {lookupAccountBySid} = req.app.locals;
  /* account level user can only act on Lcrs associated to the account */
  if (req.user.hasAccountAuth) {
    req.body.account_sid = req.user.account_sid;
  } else if (req.body.account_sid) {
    const account = await lookupAccountBySid(req.body.account_sid);
    if (!account) throw new DbErrorBadRequest('unknown account_sid');
  }

  // check if lcr_carrier_set_entry is vailable
  if (req.body.lcr_carrier_set_entry) {
    const e = await LcrCarrierSetEntry.retrieve(req.body.lcr_carrier_set_entry);
    if (!e) throw new DbErrorBadRequest('unknown lcr_carrier_set_entry');
  }

};

const validateUpdate = async(req) => {
  await validateAdd();
};

const validateDelete = async(req, sid) => {
  if (req.user.hasAccountAuth) {
    /* can only delete Lcr for the user's account */
    const lcr = await Lcr.retrieveBySid(sid);
    if (lcr.account_sid != req.user.account_sid) {
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
    const sid = parseLcrSid(req);
    const account_sid = req.user.hasAccountAuth ? req.user.account_sid : null;
    const results = await Lcr.retrieve(sid);
    if (results.length === 0) return res.status(404).end();
    const ret = results[0];
    if (account_sid && ret.account_sid !== account_sid) return res.status(404).end();
    return res.status(200).json(ret);
  }
  catch (err) {
    sysError(logger, res, err);
  }
});


module.exports = router;
