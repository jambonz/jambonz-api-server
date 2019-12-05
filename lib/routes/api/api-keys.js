const router = require('express').Router();
const {DbErrorBadRequest} = require('../../utils/errors');
const ApiKey = require('../../models/api-key');
const Account = require('../../models/account');
const decorate = require('./decorate');
const uuidv4 = require('uuid/v4');
const assert = require('assert');
const sysError = require('./error');
const preconditions = {
  'add': validateAddToken,
  'delete': validateDeleteToken
};

async function validateAddToken(req) {
  req.body.token = uuidv4();

  if (req.user.hasAdminAuth) return;
  if (req.user.hasServiceProviderAuth) {
    if (!req.body.service_provider_sid && !req.body.account_sid) {
      throw new DbErrorBadRequest('service provider token may not be used to create admin token');
    }
    else if (req.body.service_provider_sid && req.body.service_provider_sid !== req.user.service_provider_sid) {
      throw new DbErrorBadRequest(
        'a service provider token can only be used to create tokens for the same service provider');
    }
    else if (req.body.account_sid) {
      const result = await Account.retrieve(req.body.account_sid);
      if (result.length === 1 && result[0].service_provider_sid != req.user.service_provider_sid) {
        throw new DbErrorBadRequest(
          'a service provider token can only be used to create tokens for the same service provider');
      }
    }
    if (req.body.account_sid) delete req.body.service_provider_sid;
    else req.body.service_provider_sid = req.user.service_provider_sid;
  }
  if (req.user.hasAccountAuth) {
    if (req.body.account_sid !== req.user.account_sid) {
      throw new DbErrorBadRequest(
        'an account level token can only be used to create account level tokens for the same account');
    }
    delete req.body['service_provider_sid'];
    req.body['account_sid'] = req.user.account_sid;
  }
}

async function validateDeleteToken(req, sid) {
  const results = await ApiKey.retrieve(sid);
  if (0 == results.length) return;
  if (req.user.hasScope('admin')) {
    // can do anything
  }
  else if (req.user.hasScope('service_provider')) {
    if (results[0].service_provider_sid === null && results[0].account_sid === null) {
      throw new DbErrorBadRequest('a service provider user may not delete an admin token');
    }
    if (results[0].service_provider_sid && results[0].service_provider_sid != req.user.service_provider_sid) {
      throw new DbErrorBadRequest('a service provider user may not delete api key from another service provider');
    }
  }
  else {
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
