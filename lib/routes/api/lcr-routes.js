const router = require('express').Router();
const LcrRoute = require('../../models/lcr-route');
const Lcr = require('../../models/lcr');
const LcrCarrierSetEntry = require('../../models/lcr-carrier-set-entry');
const decorate = require('./decorate');
const {DbErrorBadRequest} = require('../../utils/errors');
const sysError = require('../error');

const validateAdd = async(req) => {
  // check if lcr sid is available
  if (!req.body.lcr_sid) {
    throw new DbErrorBadRequest('missing parameter lcr_sid');
  }

  const lcr = await Lcr.retrieve(req.body.lcr_sid);
  if (lcr.length === 0) {
    throw new DbErrorBadRequest('unknown lcr_sid');
  }
};

const validateUpdate = async(req) => {
  if (req.body.lcr_sid) {
    const lcr = await Lcr.retrieve(req.body.lcr_sid);
    if (lcr.length === 0) {
      throw new DbErrorBadRequest('unknown lcr_sid');
    }
  }
};

const validateDelete = async(req, sid) => {
  // delete all lcr carrier set entries
  await LcrCarrierSetEntry.deleteByLcrRouteSid(sid);
};

const checkUserScope = async(req, lcr_sid) => {
  if (!lcr_sid) {
    throw new DbErrorBadRequest('missing lcr_sid');
  }

  if (req.user.hasAdminAuth) return;

  const lcrList = await Lcr.retrieve(lcr_sid);
  if (lcrList.length === 0) throw new DbErrorBadRequest('unknown lcr_sid');
  const lcr = lcrList[0];
  if (req.user.hasAccountAuth) {
    if (!lcr.account_sid || lcr.account_sid !== req.user.account_sid) {
      throw new DbErrorBadRequest('unknown lcr_sid');
    }
  }

  if (req.user.hasServiceProviderAuth) {
    if (!lcr.service_provider_sid  || lcr.service_provider_sid !== req.user.service_provider_sid) {
      throw new DbErrorBadRequest('unknown lcr_sid');
    }
  }
};

const preconditions = {
  add: validateAdd,
  update: validateUpdate,
  delete: validateDelete,
};

decorate(router, LcrRoute, ['add', 'retrieve', 'update', 'delete'], preconditions);

router.get('/', async(req, res) => {
  const logger = req.app.locals.logger;
  const lcr_sid = req.query.lcr_sid;
  try {
    await checkUserScope(req, lcr_sid);
    const results = await LcrRoute.retrieveAllByLcrSid(lcr_sid);
    res.status(200).json(results);
  } catch (err) {
    sysError(logger, res, err);
  }
});


module.exports = router;
