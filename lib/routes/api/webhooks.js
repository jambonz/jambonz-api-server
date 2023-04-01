const router = require('express').Router();
const Webhook = require('../../models/webhook');
const decorate = require('./decorate');
const sysError = require('../error');
const {DbErrorForbidden} = require('../../utils/errors');
const { parseWebhookSid } = require('./utils');
const {promisePool} = require('../../db');

decorate(router, Webhook, ['add']);

/* retrieve */
router.get('/:sid', async(req, res) => {
  const logger = req.app.locals.logger;

  try {
    const sid = parseWebhookSid(req);
    const results = await Webhook.retrieve(sid);

    if (results.length === 0) return res.status(404).end();

    if (req.user.hasAccountAuth) {
      /* can only update carriers for the user's account */
      if (results[0].account_sid != req.user.account_sid) {
        throw new DbErrorForbidden('insufficient privileges');
      }
    }
    if (req.user.hasServiceProviderAuth) {
      const [r] = await promisePool.execute(
        'SELECT service_provider_sid from accounts WHERE account_sid = ?', [results[0].account_sid]
      );
      if (r.length === 1 && r[0].service_provider_sid === req.user.service_provider_sid) {
        return;
      }
      throw new DbErrorForbidden('insufficient permissions');
    }
    return res.status(200).json(results[0]);
  }
  catch (err) {
    sysError(logger, res, err);
  }
});

module.exports = router;
