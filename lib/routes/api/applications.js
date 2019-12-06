const router = require('express').Router();
const {DbErrorBadRequest, DbErrorUnprocessableRequest} = require('../../utils/errors');
const Application = require('../../models/application');
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

decorate(router, Application, ['add', 'update', 'delete', 'retrieve'], preconditions);

/**
 * if account-level privileges, retrieve only applications for that account
 * ditto if service provider
*/
router.get('/', async(req, res) => {
  const logger = req.app.locals.logger;
  try {
    let results;
    if (req.user.hasAccountAuth) results = await Application.retrieveAllForAccount(req.user.account_sid);
    else if (req.user.hasAccountAuth) {
      results = await Application.retrieveAllForServiceProvider(req.user.service_provider_sid);
    }
    else results = await Application.retrieveAll();
    res.status(200).json(results);
  } catch (err) {
    sysError(logger, res, err);
  }
});

module.exports = router;
