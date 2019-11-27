const router = require('express').Router();
const ServiceProvider = require('../../models/service-provider');

function sysError(logger, res, err) {
  logger.error(err, 'Database error');
  res.status(500).end();
}

/* return list of all service providers */
router.get('/', async(req, res) => {
  const logger = req.app.locals.logger;
  logger.info(`user: ${JSON.stringify(req.user)}`);
  logger.info(`scope: ${JSON.stringify(req.authInfo.scope)}`);
  try {
    const results = await ServiceProvider.retrieveAll();
    res.status(200).json(results);
  } catch (err) {
    logger.error(err, 'Error retrieving service providers');
    sysError(logger, res, err);
  }
});

/* add a service provider */
router.post('/', (req, res) => {

});

module.exports = router;
