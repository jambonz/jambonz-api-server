const router = require('express').Router();
const LcrCarrierSetEntry = require('../../models/lcr-carrier-set-entry');
const LcrRoute = require('../../models/lcr-route');
const decorate = require('./decorate');
const {DbErrorBadRequest} = require('../../utils/errors');
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

const preconditions = {
  add: validateAdd,
  update: validateUpdate,
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
