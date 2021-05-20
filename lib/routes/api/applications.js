const router = require('express').Router();
const {DbErrorBadRequest, DbErrorUnprocessableRequest} = require('../../utils/errors');
const Application = require('../../models/application');
const Account = require('../../models/account');
const Webhook = require('../../models/webhook');
const decorate = require('./decorate');
const sysError = require('../error');
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
  if (req.body.call_hook && typeof req.body.call_hook !== 'object') {
    throw new DbErrorBadRequest('\'call_hook\' must be an object when adding an application');
  }
  if (req.body.call_status_hook && typeof req.body.call_hook !== 'object') {
    throw new DbErrorBadRequest('\'call_status_hook\' must be an object when adding an application');
  }
}

async function validateUpdate(req, sid) {
  if (req.user.account_sid) {
    const app = await Application.retrieve(sid);
    if (!app || !app.length || app[0].account_sid !== req.user.account_sid) {
      throw new DbErrorBadRequest('you may not update or delete an application associated with a different account');
    }
  }
  if (req.body.call_hook && typeof req.body.call_hook !== 'object') {
    throw new DbErrorBadRequest('\'call_hook\' must be an object when updating an application');
  }
  if (req.body.call_status_hook && typeof req.body.call_hook !== 'object') {
    throw new DbErrorBadRequest('\'call_status_hook\' must be an object when updating an application');
  }
}

async function validateDelete(req, sid) {
  if (req.user.hasAccountAuth) {
    const result = await Application.retrieve(sid);
    if (!result || 0 === result.length) throw new DbErrorBadRequest('application does not exist');
    if (result[0].account_sid !== req.user.account_sid) {
      throw new DbErrorUnprocessableRequest('cannot delete application owned by a different account');
    }
  }
  const assignedPhoneNumbers = await Application.getForeignKeyReferences('phone_numbers.application_sid', sid);
  if (assignedPhoneNumbers > 0) throw new DbErrorUnprocessableRequest('cannot delete application with phone numbers');
}

decorate(router, Application, ['delete'], preconditions);

/* add */
router.post('/', async(req, res) => {
  const logger = req.app.locals.logger;
  try {
    await validateAdd(req);

    // create webhooks if provided
    const obj = Object.assign({}, req.body);
    for (const prop of ['call_hook', 'call_status_hook', 'messaging_hook']) {
      if (obj[prop]) {
        obj[`${prop}_sid`] = await Webhook.make(obj[prop]);
        delete obj[prop];
      }
    }

    const uuid = await Application.make(obj);
    res.status(201).json({sid: uuid});
  } catch (err) {
    sysError(logger, res, err);
  }
});

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

/* update */
router.put('/:sid', async(req, res) => {
  const sid = req.params.sid;
  const logger = req.app.locals.logger;
  try {
    await validateUpdate(req, sid);

    // create webhooks if provided
    const obj = Object.assign({}, req.body);
    for (const prop of ['call_hook', 'call_status_hook', 'messaging_hook']) {
      if (prop in obj && Object.keys(obj[prop]).length) {
        if ('webhook_sid' in obj[prop]) {
          const sid = obj[prop]['webhook_sid'];
          delete obj[prop]['webhook_sid'];
          await Webhook.update(sid, obj[prop]);
        }
        else {
          const sid = await Webhook.make(obj[prop]);
          obj[`${prop}_sid`] = sid;
        }
      }
      else {
        obj[`${prop}_sid`] = null;
      }
      delete obj[prop];
    }

    const rowsAffected = await Application.update(sid, obj);
    if (rowsAffected === 0) {
      return res.status(404).end();
    }
    res.status(204).end();
  } catch (err) {
    sysError(logger, res, err);
  }
});

module.exports = router;
