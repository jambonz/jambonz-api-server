const router = require('express').Router();
const Sbc = require('../../models/sbc');
const decorate = require('./decorate');
const sysError = require('../error');
//const {DbErrorBadRequest} = require('../../utils/errors');
//const {promisePool} = require('../../db');

decorate(router, Sbc, ['add', 'delete']);

/* list */
router.get('/', async(req, res) => {
  const logger = req.app.locals.logger;
  try {
    /*
    let service_provider_sid = req.query.service_provider_sid;
    if (req.user.hasAccountAuth) {
      const [r] = await promisePool.query('SELECT * from accounts WHERE account_sid = ?', req.user.account_sid);
      if (0 === r.length) throw new Error('invalid account_sid');
      service_provider_sid = r[0].service_provider_sid;
    }
    if (!service_provider_sid) throw new DbErrorBadRequest('missing service_provider_sid in query');
    */
    const results = await Sbc.retrieveAll(/*service_provider_sid*/);
    res.status(200).json(results);
  } catch (err) {
    sysError(logger, res, err);
  }
});

module.exports = router;
