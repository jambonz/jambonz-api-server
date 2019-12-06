const router = require('express').Router();
const {DbErrorBadRequest, DbErrorUnprocessableRequest} = require('../../utils/errors');
const Application = require('../../models/application');
const Account = require('../../models/account');
const decorate = require('./decorate');
const sysError = require('./error');
const preconditions = {
  'add': validateAdd,
  'update': validateUpdate,
  'delete': validateDelete
};

/* only user-level tokens can add applications */
async function validateAdd(req) {
  if (req.user.account_sid) {
    req.body.account_sid = req.user.account_sid;
  }
  else if (req.user.hasServiceProviderAuth) {
    // make sure the account is being created for this service provider
    if (!req.body.account_sid) throw new DbErrorBadRequest('missing required field: \'account_sid\'');
    const result = await Account.retrieve(req.body.account_sid, req.user.service_provider_sid);
    if (result.length === 0) {
      throw new DbErrorBadRequest('insufficient privileges to create an application under the specified account');
    }
  }
}

async function validateUpdate(req, sid) {
  if (req.user.account_sid && sid !== req.user.account_sid) {
    throw new DbErrorBadRequest('you may not update or delete an application associated with a different account');
  }
}

async function validateDelete(req, sid) {
  if (req.user.account_sid && sid !== req.user.account_sid) {
    throw new DbErrorBadRequest('you may not update or delete an application associated with a different account');
  }
  const assignedPhoneNumbers = await Application.getForeignKeyReferences('phone_numbers.application_sid', sid);
  if (assignedPhoneNumbers > 0) throw new DbErrorUnprocessableRequest('cannot delete application with phone numbers');
}

decorate(router, Application, ['add', 'update', 'delete'], preconditions);

/* list */
router.get('/', async(req, res) => {
  const logger = req.app.locals.logger;
  try {
    const service_provider_sid = req.user.hasServiceProviderAuth ? req.user.service_provider_sid : null;
    const account_sid = req.user.hasAccountAuth ? req.user.account_sid : null;
    const results = await Application.retrieveAll(service_provider_sid, account_sid);
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
    const account_sid = req.user.hasAccountAuth ? req.user.account_sid : null;
    const results = await Application.retrieve(req.params.sid, service_provider_sid, account_sid);
    if (results.length === 0) return res.status(404).end();
    return res.status(200).json(results);
  }
  catch (err) {
    sysError(logger, res, err);
  }
});

module.exports = router;
