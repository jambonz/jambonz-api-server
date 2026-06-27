const router = require('express').Router();
const Tenant = require('../../models/tenant');
const Account = require('../../models/account');
const decorate = require('./decorate');
const {DbErrorBadRequest, DbErrorForbidden} = require('../../utils/errors');
const sysError = require('../error');

const checkTenantScope = async(req, tenant) => {
  if (req.user.hasAdminAuth) return;

  if (req.user.hasAccountAuth) {
    if (tenant.account_sid !== req.user.account_sid) {
      throw new DbErrorForbidden('insufficient privileges');
    }
  }

  if (req.user.hasServiceProviderAuth) {
    if (tenant.service_provider_sid !== req.user.service_provider_sid) {
      throw new DbErrorForbidden('insufficient privileges');
    }
  }
};

const validateAdd = async(req) => {
  if (req.user.hasAdminAuth) return;

  const account_sid = req.body.account_sid;
  if (!account_sid) {
    throw new DbErrorBadRequest('missing account_sid');
  }

  if (req.user.hasAccountAuth) {
    if (account_sid !== req.user.account_sid) {
      throw new DbErrorForbidden('insufficient privileges');
    }
  }

  if (req.user.hasServiceProviderAuth) {
    const accounts = await Account.retrieve(account_sid, req.user.service_provider_sid);
    if (accounts.length === 0) {
      throw new DbErrorForbidden('insufficient privileges');
    }
  }
};

const validateRetrieveOrUpdateOrDelete = async(req, sid) => {
  const tenants = await Tenant.retrieve(sid);
  if (!tenants || tenants.length === 0) {
    throw new DbErrorBadRequest('not found');
  }
  const tenant = tenants[0];
  await checkTenantScope(req, tenant);
};

const preconditions = {
  add: validateAdd,
  retrieve: validateRetrieveOrUpdateOrDelete,
  update: validateRetrieveOrUpdateOrDelete,
  delete: validateRetrieveOrUpdateOrDelete,
};

decorate(router, Tenant, ['add', 'retrieve', 'update', 'delete'], preconditions);

/* list - custom handler with proper scoping */
router.get('/', async(req, res) => {
  const logger = req.app.locals.logger;
  try {
    let results;
    if (req.user.hasAdminAuth) {
      results = await Tenant.retrieveAll();
    } else if (req.user.hasAccountAuth) {
      results = await Tenant.retrieveAll(req.user.account_sid);
    } else if (req.user.hasServiceProviderAuth) {
      results = await Tenant.retrieveAllByServiceProviderSid(req.user.service_provider_sid);
    } else {
      results = [];
    }
    res.status(200).json(results);
  } catch (err) {
    sysError(logger, res, err);
  }
});

module.exports = router;
