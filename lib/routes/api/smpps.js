const router = require('express').Router();
const Smpp = require('../../models/smpp');
const decorate = require('./decorate');
const sysError = require('../error');

decorate(router, Smpp, ['add', 'delete']);

/* list */
router.get('/', async(req, res) => {
  const logger = req.app.locals.logger;
  try {
    const results = await Smpp.retrieveAll(req.query.service_provider_sid);
    res.status(200).json(results);
  } catch (err) {
    sysError(logger, res, err);
  }
});

module.exports = router;
