const router = require('express').Router();
const {DbErrorUnprocessableRequest} = require('../../utils/errors');
const VoipCarrier = require('../../models/voip-carrier');
const decorate = require('./decorate');
const preconditions = {
  'delete': noActiveAccounts
};

/* can not delete a voip provider if it has any active phone numbers */
async function noActiveAccounts(req, sid) {
  const activeAccounts = await VoipCarrier.getForeignKeyReferences('phone_numbers.voip_carrier_sid', sid);
  if (activeAccounts > 0) throw new DbErrorUnprocessableRequest('cannot delete voip carrier with active phone numbers');
}

decorate(router, VoipCarrier, ['*'], preconditions);

module.exports = router;
