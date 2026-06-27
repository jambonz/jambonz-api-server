const router = require('express').Router();
const LcrCarrierSetEntry = require('../../models/lcr-carrier-set-entry');
const LcrRoute = require('../../models/lcr-route');
const Lcr = require('../../models/lcr');
const decorate = require('./decorate');
const {DbErrorBadRequest, DbErrorForbidden} = require('../../utils/errors');
const sysError = require('../error');

const validateAdd = async(req) => {
  const {lookupCarrierBySid} = req.app.locals;
  if (!req.body.lcr_route_sid) {
    throw new DbErrorBadRequest('missing lcr_route_sid');
  }
  // check lcr_route_sid is exist
  const lcrRoute = await LcrRoute.retrieve(req.body.lcr_route_sid);
  if (lcrRoute.length === 0) {
    throw new DbErrorBadRequest('unknown lcr_route_sid');
  }
  // check voip_carrier_sid is exist
  if (!req.body.voip_carrier_sid) {
    throw new DbErrorBadRequest('missing voip_carrier_sid');
  }
  const carrier = await lookupCarrierBySid(req.body.voip_carrier_sid);
  if (!carrier) {
    throw new DbErrorBadRequest('unknown voip_carrier_sid');
  }
};

const validateUpdate = async(req) => {
  const {lookupCarrierBySid} = req.app.locals;
  if (req.body.lcr_route_sid) {
    const lcrRoute = await LcrRoute.retrieve(req.body.lcr_route_sid);
    if (lcrRoute.length === 0) {
      throw new DbErrorBadRequest('unknown lcr_route_sid');
    }
  }

  // check voip_carrier_sid is exist
  if (req.body.voip_carrier_sid) {
    const carrier = await lookupCarrierBySid(req.body.voip_carrier_sid);
    if (!carrier) {
      throw new DbErrorBadRequest('unknown voip_carrier_sid');
    }
  }
};

const validateRetrieveOrDelete = async(req, sid) => {
  // Get the entry
  const entries = await LcrCarrierSetEntry.retrieve(sid);
  if (!entries || entries.length === 0) {
    throw new DbErrorBadRequest('not found');
  }
  const entry = entries[0];

  // Get the lcr_route
  const routes = await LcrRoute.retrieve(entry.lcr_route_sid);
  if (routes.length === 0) {
    throw new DbErrorBadRequest('invalid lcr_route_sid');
  }
  const route = routes[0];

  // Get the LCR and check ownership
  const lcrs = await Lcr.retrieve(route.lcr_sid);
  if (lcrs.length === 0) {
    throw new DbErrorBadRequest('invalid lcr_sid');
  }
  const lcr = lcrs[0];

  if (req.user.hasAdminAuth) return;

  if (req.user.hasAccountAuth) {
    if (!lcr.account_sid || lcr.account_sid !== req.user.account_sid) {
      throw new DbErrorForbidden('insufficient privileges');
    }
  }

  if (req.user.hasServiceProviderAuth) {
    if (!lcr.service_provider_sid || lcr.service_provider_sid !== req.user.service_provider_sid) {
      throw new DbErrorForbidden('insufficient privileges');
    }
  }
};

const preconditions = {
  add: validateAdd,
  update: validateUpdate,
  retrieve: validateRetrieveOrDelete,
  delete: validateRetrieveOrDelete,
};

decorate(router, LcrCarrierSetEntry, ['add', 'retrieve', 'update', 'delete'], preconditions);

router.get('/', async(req, res) => {
  const logger = req.app.locals.logger;
  const lcr_route_sid = req.query.lcr_route_sid;
  try {
    const results = await LcrCarrierSetEntry.retrieveAllByLcrRouteSid(lcr_route_sid);
    res.status(200).json(results);
  } catch (err) {
    sysError(logger, res, err);
  }
});


module.exports = router;
