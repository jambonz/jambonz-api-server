const router = require('express').Router();
const {DbErrorBadRequest, DbErrorUnprocessableRequest} = require('../../utils/errors');
const Account = require('../../models/account');
const ServiceProvider = require('../../models/service-provider');
const decorate = require('./decorate');
const preconditions = {
  'add': validateAdd,
  'update': validateUpdate,
  'delete': validateDelete
};

async function validateAdd(req) {
  /* check that service provider exists */
  const result = await ServiceProvider.retrieve(req.body.service_provider_sid);
  if (!result || result.length === 0) {
    throw new DbErrorBadRequest(`service_provider not found for sid ${req.body.service_provider_sid}`);
  }
}
async function validateUpdate(req, sid) {
  if (req.body.service_provider_sid) throw new DbErrorBadRequest('service_provider_sid may not be modified')
}
async function validateDelete(req, sid) {
  const assignedPhoneNumbers = await Account.getForeignKeyReferences('phone_numbers.account_sid', sid);
  if (assignedPhoneNumbers > 0) throw new DbErrorUnprocessableRequest('cannot delete account with phone numbers');
}

decorate(router, Account, ['*'], preconditions);

module.exports = router;
