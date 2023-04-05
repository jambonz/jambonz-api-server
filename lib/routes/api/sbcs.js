const router = require('express').Router();
const Sbc = require('../../models/sbc');
const decorate = require('./decorate');
const sysError = require('../error');
const {DbErrorBadRequest} = require('../../utils/errors');
const {promisePool} = require('../../db');

const validate = (req, res) => {
  if (req.user.hasScope('admin')) return;
  res.status(403).json({
    status: 'fail',
    message: 'insufficient privileges'
  });
};

const preconditions = {
  'add': validate,
  'delete': validate
};

decorate(router, Sbc, ['add', 'delete'], preconditions);

/* list */
router.get('/', async(req, res) => {
  const logger = req.app.locals.logger;
  try {
    let service_provider_sid = req.query.service_provider_sid;

    if (req.user.hasAccountAuth) {
      const [r] = await promisePool.query('SELECT * from accounts WHERE account_sid = ?', req.user.account_sid);
      if (0 === r.length) throw new Error('invalid account_sid');

      service_provider_sid = r[0].service_provider_sid;
    }

    if (req.user.hasServiceProviderAuth) {
      const [r] = await promisePool.query(
        'SELECT * from service_providers where service_provider_sid = ?',
        service_provider_sid);
      if (0 === r.length) throw new Error('invalid account_sid');

      service_provider_sid = r[0].service_provider_sid;

      if (!service_provider_sid) throw new DbErrorBadRequest('missing service_provider_sid in query');
    }

    /** generally, we have a global set of SBCs that all accounts use.
     * However, we can have a set of SBCs that are specific for use by a service provider.
     */
    let results = await Sbc.retrieveAll(service_provider_sid);
    if (results.length === 0) results = await Sbc.retrieveAll();
    res.status(200).json(results);
  } catch (err) {
    sysError(logger, res, err);
  }
});

module.exports = router;
