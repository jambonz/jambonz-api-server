const router = require('express').Router();
const Webhook = require('../../models/webhook');
const decorate = require('./decorate');
const sysError = require('../error');

decorate(router, Webhook, ['add']);

/* retrieve */
router.get('/:sid', async(req, res) => {
  const logger = req.app.locals.logger;
  try {
    const results = await Webhook.retrieve(req.params.sid);
    if (results.length === 0) return res.status(404).end();
    return res.status(200).json(results[0]);
  }
  catch (err) {
    sysError(logger, res, err);
  }
});

module.exports = router;
