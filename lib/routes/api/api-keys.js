const router = require('express').Router();
const {DbErrorBadRequest} = require('../../utils/errors');
const ApiKey = require('../../models/api-key');
const {isAdmin, isServiceProvider, isUser} = require('../../utils/scopes');
const decorate = require('./decorate');
const uuidv4 = require('uuid/v4');
const assert = require('assert');
const sysError = require('./error');
const preconditions = {
  'add': validateAddToken,
  'delete': validateDeleteToken
};

/**
 * if user scope, add to the associated account
 * if admin scope, only admin-level tokens may be created
 */
function validateAddToken(req) {
  if (isAdmin(req) && ('account_sid' in req.body)) {
    throw new DbErrorBadRequest('admin users may not create account-level tokens');
  }
  else if (isServiceProvider(req) && (!('account_sid' in req.body) && !('service_provider_sid' in req.body))) {
    req.body['service_provider_sid'] = req.user.service_provider_sid
  }
  else if (isUser(req)) {
    delete req.body['service_provider_sid'];
    req.body['account_sid'] = req.user.account_sid;
  }
  req.body.token = uuidv4();
}

/**
 * admin users can only delete admin tokens or service provider tokens
 * service_provider users can delete service provider or user tokens
 * user-scope may only delete their own tokens
 */
async function validateDeleteToken(req, sid) {
  const results = await ApiKey.retrieve(sid);
  if (0 == results.length) return;
  if (isAdmin(req)) {
    if (results[0].account_sid) {
      throw new DbErrorBadRequest('an admin user may not delete account level api keys');
    }
  }
  else if (isServiceProvider(req)) {
    if (results[0].service_provider_sid === null && results[0].account_sid === null) {
      throw new DbErrorBadRequest('a service provider user may not delete an admin token');
    }
    if (results[0].service_provider_sid && results[0].service_provider_sid != req.user.service_provider_sid) {
      throw new DbErrorBadRequest('a service provider user may not delete api key from another service provider');
    }
  }
  else if (isUser(req)) {
    if (results[0].account_sid !== req.user.account_sid) {
      throw new DbErrorBadRequest('a user may not delete a token associated with a different account');
    }
  }
}

/**
 * need to handle here because response is slightly different than standard for an insert
 * (returning the token generated along with the sid)
 */
router.post('/', async(req, res) => {
  const logger = req.app.locals.logger;
  try {
    if ('add' in preconditions) {
      assert(typeof preconditions.add === 'function');
      await preconditions.add(req);
    }
    const uuid = await ApiKey.make(req.body);
    res.status(201).json({sid: uuid, token: req.body.token});
  } catch (err) {
    sysError(logger, res, err);
  }
});

decorate(router, ApiKey, ['delete'], preconditions);

module.exports = router;
