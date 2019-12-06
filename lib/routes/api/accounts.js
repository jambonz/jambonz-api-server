const router = require('express').Router();
const {DbErrorBadRequest, DbErrorUnprocessableRequest} = require('../../utils/errors');
const Account = require('../../models/account');
const ServiceProvider = require('../../models/service-provider');
const decorate = require('./decorate');
const sysError = require('./error');
const preconditions = {
  'add': validateAdd,
  'update': validateUpdate,
  'delete': validateDelete
};

async function validateAdd(req) {
  /* account-level token can not be used to add accounts */
  if (req.user.hasAccountAuth) {
    throw new DbErrorUnprocessableRequest('insufficient permissions to create accounts');
  }
  if (req.user.hasServiceProviderAuth) {
    /* service providers can only create accounts under themselves */
    req.body.service_provider_sid = req.user.service_provider_sid;
  }
  if (req.body.service_provider_sid) {
    const result = await ServiceProvider.retrieve(req.body.service_provider_sid);
    if (!result || result.length === 0) {
      throw new DbErrorBadRequest(`service_provider not found for sid ${req.body.service_provider_sid}`);
    }
  }
}
async function validateUpdate(req, sid) {
  if (req.user.hasAccountAuth && req.user.account_sid !== sid) {
    throw new DbErrorUnprocessableRequest('insufficient privileges to update this account');
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
  const assignedPhoneNumbers = await Account.getForeignKeyReferences('phone_numbers.account_sid', sid);
  if (assignedPhoneNumbers > 0) throw new DbErrorUnprocessableRequest('cannot delete account with phone numbers');
  if (req.user.service_provider_sid && !req.user.hasScope('admin')) {
    const result = await Account.retrieve(sid);
    if (result[0].service_provider_sid !== req.user.service_provider_sid) {
      throw new DbErrorUnprocessableRequest('cannot delete account from different service provider');
    }
  }
}

decorate(router, Account, ['add', 'update', 'delete'], preconditions);

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

module.exports = router;
