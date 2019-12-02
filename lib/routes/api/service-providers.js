const router = require('express').Router();
const {DbErrorUnprocessableRequest} = require('../../utils/errors');
const ServiceProvider = require('../../models/service-provider');
const decorate = require('./decorate');
const preconditions = {
  'delete': noActiveAccounts
};

/* can not delete a service provider if it has any active accounts */
async function noActiveAccounts(req, sid) {
  const activeAccounts = await ServiceProvider.getForeignKeyReferences('accounts.service_provider_sid', sid);
  if (activeAccounts > 0) throw new DbErrorUnprocessableRequest('cannot delete service provider with active accounts');
}

decorate(router, ServiceProvider, ['*'], preconditions);

module.exports = router;
