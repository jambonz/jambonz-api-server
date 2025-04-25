const router = require('express').Router();
const {DbErrorBadRequest, DbErrorUnprocessableRequest, DbErrorForbidden} = require('../../utils/errors');
const Application = require('../../models/application');
const Account = require('../../models/account');
const Webhook = require('../../models/webhook');
const {promisePool} = require('../../db');
const decorate = require('./decorate');
const sysError = require('../error');
const { validate } = require('@jambonz/verb-specifications');
const { parseApplicationSid } = require('./utils');
const preconditions = {
  'add': validateAdd,
  'update': validateUpdate
};
const { fetchAppEnvSchema, validateAppEnvData } = require('../../utils/appenv_utils');
const {decrypt, encrypt} = require('../../utils/encrypt-decrypt');


const validateRequest = async(req, account_sid) => {
  try {
    if (req.user.hasScope('admin')) {
      return;
    }

    if (req.user.hasScope('account')) {
      if (account_sid === req.user.account_sid) {
        return;
      }

      throw new DbErrorForbidden('insufficient permissions');
    }

    if (req.user.hasScope('service_provider')) {
      const [r] = await promisePool.execute(
        'SELECT service_provider_sid from accounts WHERE account_sid = ?', [account_sid]
      );

      if (r.length === 1 && r[0].service_provider_sid === req.user.service_provider_sid) {
        return;
      }

      throw new DbErrorForbidden('insufficient permissions');
    }
  } catch (error) {
    throw error;
  }
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
      throw new DbErrorForbidden('insufficient privileges');
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
  const app = await Application.retrieve(sid);
  if (req.user.hasAccountAuth) {
    if (!app || 0 === app.length || app[0].account_sid !== req.user.account_sid) {
      throw new DbErrorForbidden('insufficient privileges');
    }
  }

  if (req.user.hasServiceProviderAuth) {
    const [r] = await promisePool.execute(
      'SELECT service_provider_sid from accounts WHERE account_sid = ?', [app[0].account_sid]
    );

    if (r.length === 1 && r[0].service_provider_sid === req.user.service_provider_sid) {
      return;
    }

    throw new DbErrorForbidden('insufficient permissions');
  }


  if (req.body.call_hook && typeof req.body.call_hook !== 'object') {
    throw new DbErrorBadRequest('\'call_hook\' must be an object when updating an application');
  }
  if (req.body.call_status_hook && typeof req.body.call_hook !== 'object') {
    throw new DbErrorBadRequest('\'call_status_hook\' must be an object when updating an application');
  }
}

async function validateDelete(req, sid) {
  const result = await Application.retrieve(sid);
  if (req.user.hasAccountAuth) {
    if (!result || 0 === result.length) throw new DbErrorBadRequest('application does not exist');
    if (result[0].account_sid !== req.user.account_sid) {
      throw new DbErrorUnprocessableRequest('insufficient permissions');
    }
  }
  if (req.user.hasServiceProviderAuth) {
    const [r] = await promisePool.execute(
      'SELECT service_provider_sid from accounts WHERE account_sid = ?', [result[0].account_sid]
    );

    if (r.length === 1 && r[0].service_provider_sid === req.user.service_provider_sid) {
      return;
    }

    throw new DbErrorForbidden('insufficient permissions');
  }
  const assignedPhoneNumbers = await Application.getForeignKeyReferences('phone_numbers.application_sid', sid);
  if (assignedPhoneNumbers > 0) throw new DbErrorUnprocessableRequest('cannot delete application with phone numbers');
}

decorate(router, Application, [], preconditions);

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

    // validate app json if required
    if (obj['app_json']) {
      const app_json = JSON.parse(obj['app_json']);
      try {
        validate(logger, app_json);
      } catch (err) {
        throw new DbErrorBadRequest(err);
      }
    }
    // validate env_vars data if required
    if (obj['env_vars']) {
      const appenvschema = await fetchAppEnvSchema(logger, req.body.call_hook.url);
      const errors = await validateAppEnvData(appenvschema, obj['env_vars']);
      if (errors) {
        throw new DbErrorBadRequest(errors);
      } else {
        obj['env_vars'] = encrypt(JSON.stringify(obj['env_vars']));
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
    const name = req.query.name;
    const results = await Application.retrieveAll(service_provider_sid, account_sid, name);
    const ret = results.map((a) => {
      if (a.env_vars) {
        a.env_vars = JSON.parse(decrypt(a.env_vars));
        return a;
      } else {
        return a;
      }
    });
    res.status(200).json(ret);
  } catch (err) {
    sysError(logger, res, err);
  }
});

/* retrieve */
router.get('/:sid', async(req, res) => {
  const logger = req.app.locals.logger;
  try {
    const application_sid = parseApplicationSid(req);
    const service_provider_sid = req.user.hasServiceProviderAuth ? req.user.service_provider_sid : null;
    const account_sid = req.user.hasAccountAuth ? req.user.account_sid : null;
    const results = await Application.retrieve(application_sid, service_provider_sid, account_sid);
    if (results.length === 0) return res.status(404).end();
    await validateRequest(req, results[0].account_sid);
    if (results[0].env_vars) {
      results[0].env_vars = JSON.parse(decrypt(results[0].env_vars));
    }
    return res.status(200).json(results[0]);
  }
  catch (err) {
    sysError(logger, res, err);
  }
});

/* delete */
router.delete('/:sid', async(req, res) => {
  const logger = req.app.locals.logger;
  try {
    const sid = parseApplicationSid(req);
    await validateDelete(req, sid);

    const [application] = await promisePool.query('SELECT * FROM applications WHERE application_sid = ?', sid);
    const {call_hook_sid, call_status_hook_sid, messaging_hook_sid} = application[0];
    logger.info({call_hook_sid, call_status_hook_sid, messaging_hook_sid, sid}, 'deleting application');
    await promisePool.execute('DELETE from applications where application_sid = ?', [sid]);

    if (call_hook_sid) {
      /* remove call hook if only used by this app */
      const sql = 'SELECT COUNT(*) as count FROM applications WHERE call_hook_sid = ?';
      const [r] = await promisePool.query(sql, call_hook_sid);
      if (r[0]?.count === 0) {
        await promisePool.execute('DELETE from webhooks where webhook_sid = ?', [call_hook_sid]);
      }
    }
    if (call_status_hook_sid) {
      const sql = 'SELECT COUNT(*) as count FROM applications WHERE call_status_hook_sid = ?';
      const [r] = await promisePool.query(sql, call_status_hook_sid);
      if (r[0]?.count === 0) {
        await promisePool.execute('DELETE from webhooks where webhook_sid = ?', [call_status_hook_sid]);
      }
    }
    if (messaging_hook_sid) {
      const sql = 'SELECT COUNT(*) as count FROM applications WHERE messaging_hook_sid = ?';
      const [r] = await promisePool.query(sql, messaging_hook_sid);
      if (r[0]?.count === 0) {
        await promisePool.execute('DELETE from webhooks where webhook_sid = ?', [messaging_hook_sid]);
      }
    }

    res.status(204).end();
  } catch (err) {
    sysError(logger, res, err);
  }
});

/* update */
router.put('/:sid', async(req, res) => {
  const logger = req.app.locals.logger;
  try {
    const sid = parseApplicationSid(req);
    await validateUpdate(req, sid);
    const service_provider_sid = req.user.hasServiceProviderAuth ? req.user.service_provider_sid : null;
    const account_sid = req.user.hasAccountAuth ? req.user.account_sid : null;

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

    // validate app json if required
    if (obj['app_json']) {
      const app_json = JSON.parse(obj['app_json']);
      try {
        validate(logger, app_json);
      } catch (err) {
        throw new DbErrorBadRequest(err);
      }
    }

    // validate env_vars data if required
    if (obj['env_vars']) {
      const applications = await Application.retrieve(sid, service_provider_sid, account_sid);
      const call_hook_url = req.body.call_hook ? req.body.call_hook : applications[0].call_hook.url;
      const appenvschema = await fetchAppEnvSchema(logger, call_hook_url);
      const errors = await validateAppEnvData(appenvschema, obj['env_vars']);
      if (errors) {
        throw new DbErrorBadRequest(errors);
      } else {
        obj['env_vars'] = encrypt(JSON.stringify(obj['env_vars']));
      }
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
