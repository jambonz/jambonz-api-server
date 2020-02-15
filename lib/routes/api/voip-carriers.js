const router = require('express').Router();
const {DbErrorBadRequest, DbErrorUnprocessableRequest} = require('../../utils/errors');
const VoipCarrier = require('../../models/voip-carrier');
const decorate = require('./decorate');
const preconditions = {
  'add': validate,
  'update': validate,
  'delete': noActiveAccounts
};

async function validate(req) {
  const {lookupAppBySid, lookupAccountBySid} = req.app.locals;
  if (req.body.application_sid && !req.body.account_sid) {
    throw new DbErrorBadRequest('account_sid missing');
  }
  if (req.body.application_sid) {
    const application = await lookupAppBySid(req.body.application_sid);
    if (!application) throw new DbErrorBadRequest('unknown application_sid');
    if (application.account_sid !== req.body.account_sid) {
      throw new DbErrorBadRequest('application_sid does not exist for specified account_sid');
    }
  }
  else if (req.body.account_sid) {
    const account = await lookupAccountBySid(req.body.account_sid);
    if (!account) throw new DbErrorBadRequest('unknown account_sid');
  }
}

/* can not delete a voip provider if it has any active phone numbers */
async function noActiveAccounts(req, sid) {
  const activeAccounts = await VoipCarrier.getForeignKeyReferences('phone_numbers.voip_carrier_sid', sid);
  if (activeAccounts > 0) throw new DbErrorUnprocessableRequest('cannot delete voip carrier with active phone numbers');
}

decorate(router, VoipCarrier, ['*'], preconditions);

module.exports = router;
