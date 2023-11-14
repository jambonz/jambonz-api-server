const router = require('express').Router();
const Lcr = require('../../models/lcr');
const LcrCarrierSetEntry = require('../../models/lcr-carrier-set-entry');
const LcrRoutes = require('../../models/lcr-route');
const decorate = require('./decorate');
const {DbErrorBadRequest} = require('../../utils/errors');
const sysError = require('../error');
const ServiceProvider = require('../../models/service-provider');

const validateAssociatedTarget = async(req, sid) => {
  const {lookupAccountBySid} = req.app.locals;
  if (req.body.account_sid) {
    // Add only for account
    req.body.service_provider_sid = null;
    const account = await lookupAccountBySid(req.body.account_sid);
    if (!account) throw new DbErrorBadRequest('unknown account_sid');
    const lcr = await Lcr.retrieveAllByAccountSid(req.body.account_sid);
    if (lcr.length > 0 && (!sid || sid !== lcr[0].lcr_sid)) {
      throw new DbErrorBadRequest(`Account: ${account.name}  already has an active call routing table.`);
    }
  } else if (req.body.service_provider_sid) {
    const serviceProviders = await ServiceProvider.retrieve(req.body.service_provider_sid);
    if (serviceProviders.length === 0) throw new DbErrorBadRequest('unknown service_provider_sid');
    const serviceProvider = serviceProviders[0];
    const lcr = await Lcr.retrieveAllByServiceProviderSid(req.body.service_provider_sid);
    if (lcr.length > 0 && (!sid || sid !== lcr[0].lcr_sid)) {
      throw new DbErrorBadRequest(`Service Provider: ${serviceProvider.name} already 
      has an active call routing table.`);
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
  await Lcr.releaseDefaultEntry(sid);
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

const validateLcrBatchAdd = async(lcr_sid, body, lookupCarrierBySid) => {
  for (const lcr_route of body) {
    lcr_route.lcr_sid = lcr_sid;
    if (!lcr_route.lcr_carrier_set_entries || lcr_route.lcr_carrier_set_entries.length === 0) {
      throw new DbErrorBadRequest('Lcr Route batch process require lcr_carrier_set_entries');
    }
    for (const entry of lcr_route.lcr_carrier_set_entries) {
      // check voip_carrier_sid is exist
      if (!entry.voip_carrier_sid) {
        throw new DbErrorBadRequest('One of lcr_carrier_set_entries is missing voip_carrier_sid');
      }
      const carrier = await lookupCarrierBySid(entry.voip_carrier_sid);
      if (!carrier) {
        throw new DbErrorBadRequest('unknown voip_carrier_sid');
      }
    }
  }
};


const addNewLcrRoute = async(lcr_route) => {
  const lcr_sid = lcr_route.lcr_sid;
  const lcr_carrier_set_entries = lcr_route.lcr_carrier_set_entries;
  delete lcr_route.lcr_carrier_set_entries;
  const lcr_route_sid = await LcrRoutes.make(lcr_route);
  for (const entry of lcr_carrier_set_entries) {
    entry.lcr_route_sid = lcr_route_sid;
    const lcr_carrier_set_entry_sid = await LcrCarrierSetEntry.make(entry);
    if (lcr_route.priority === 9999) {
      // this is default lcr set entry
      const [lcr] = await Lcr.retrieve(lcr_sid);
      if (lcr) {
        lcr.default_carrier_set_entry_sid = lcr_carrier_set_entry_sid;
        delete lcr.lcr_sid;
        await Lcr.update(lcr_sid, lcr);
      }
    }
  }
};

router.put('/:sid/createRoutes', async(req, res) => {
  const {logger, lookupCarrierBySid} = req.app.locals;
  try {
    const body = req.body;
    await validateLcrBatchAdd(req.params.sid, body, lookupCarrierBySid);
    for (const lcr_route of body) {
      await addNewLcrRoute(lcr_route, lookupCarrierBySid);
    }
    res.sendStatus(204);

  } catch (err) {
    sysError(logger, res, err);
  }
});

router.put('/:sid/updateRoutes', async(req, res) => {
  const {logger, lookupCarrierBySid} = req.app.locals;
  try {
    const body = req.body;
    await validateLcrBatchAdd(req.params.sid, body, lookupCarrierBySid);
    for (const lcr_route of body) {
      if (lcr_route.lcr_route_sid) {
        const lcr_route_sid = lcr_route.lcr_route_sid;
        delete lcr_route.lcr_route_sid;
        const lcr_carrier_set_entries = lcr_route.lcr_carrier_set_entries;
        delete lcr_route.lcr_carrier_set_entries;
        await LcrRoutes.update(lcr_route_sid, lcr_route);
        for (const entry of lcr_carrier_set_entries) {
          const lcr_carrier_set_entry_sid = entry.lcr_carrier_set_entry_sid;
          delete entry.lcr_carrier_set_entry_sid;
          await LcrCarrierSetEntry.update(lcr_carrier_set_entry_sid, entry);
        }
      } else {
        // Route is not available yet, let create it now
        await addNewLcrRoute(lcr_route, lookupCarrierBySid);
      }
    }
    res.sendStatus(204);
  } catch (err) {
    sysError(logger, res, err);
  }
});

router.get('/', async(req, res) => {
  const logger = req.app.locals.logger;
  try {
    const results = req.user.hasAdminAuth ?
      await Lcr.retrieveAll() : req.user.hasAccountAuth ?
        await Lcr.retrieveAllByAccountSid(req.user.hasAccountAuth ? req.user.account_sid : null) :
        await Lcr.retrieveAllByServiceProviderSid(req.user.service_provider_sid);

    for (const lcr of results) {
      lcr.number_routes = await LcrRoutes.countAllByLcrSid(lcr.lcr_sid);
    }
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
    lcr.number_routes = await LcrRoutes.countAllByLcrSid(lcr.lcr_sid);
    return res.status(200).json(lcr);
  } catch (err) {
    sysError(logger, res, err);
  }
});

module.exports = router;
