const router = require('express').Router();
const {DbErrorUnprocessableRequest} = require('../../utils/errors');
const Webhook = require('../../models/webhook');
const ServiceProvider = require('../../models/service-provider');
const sysError = require('../error');
const decorate = require('./decorate');
const preconditions = {
  'delete': noActiveAccounts
};

/* can not delete a service provider if it has any active accounts */
async function noActiveAccounts(req, sid) {
  const activeAccounts = await ServiceProvider.getForeignKeyReferences('accounts.service_provider_sid', sid);
  if (activeAccounts > 0) throw new DbErrorUnprocessableRequest('cannot delete service provider with active accounts');
}

decorate(router, ServiceProvider, ['delete'], preconditions);

/* add */
router.post('/', async(req, res) => {
  const logger = req.app.locals.logger;
  try {

    // create webhooks if provided
    const obj = Object.assign({}, req.body);
    for (const prop of ['registration_hook']) {
      if (obj[prop]) {
        obj[`${prop}_sid`] = await Webhook.make(obj[prop]);
        delete obj[prop];
      }
    }

    //logger.debug(`Attempting to add account ${JSON.stringify(obj)}`);
    const uuid = await ServiceProvider.make(obj);
    res.status(201).json({sid: uuid});
  } catch (err) {
    sysError(logger, res, err);
  }
});

/* list */
router.get('/', async(req, res) => {
  const logger = req.app.locals.logger;
  try {
    const results = await ServiceProvider.retrieveAll();
    res.status(200).json(results);
  } catch (err) {
    sysError(logger, res, err);
  }
});

/* retrieve */
router.get('/:sid', async(req, res) => {
  const logger = req.app.locals.logger;
  try {
    const results = await ServiceProvider.retrieve(req.params.sid);
    if (results.length === 0) return res.status(404).end();
    return res.status(200).json(results[0]);
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
    // create webhooks if provided
    const obj = Object.assign({}, req.body);
    for (const prop of ['registration_hook']) {
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

    const rowsAffected = await ServiceProvider.update(sid, obj);
    if (rowsAffected === 0) {
      return res.status(404).end();
    }
    res.status(204).end();
  } catch (err) {
    sysError(logger, res, err);
  }
});

module.exports = router;
