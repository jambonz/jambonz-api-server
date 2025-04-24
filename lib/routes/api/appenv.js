const router = require('express').Router();
const sysError = require('../error');
const { fetchAppEnvSchema, validateAppEnvSchema } = require('../../utils/appenv_utils');

const URL = require('url').URL;

const isValidUrl = (s) => {
  const protocols = ['https:', 'http:', 'ws:', 'wss:'];
  try {
    const url = new URL(s);
    if (protocols.includes(url.protocol)) {
      return true;
    }
    else {
      return false;
    }
  } catch (err) {
    return false;
  }
};

/* get appenv schema for endpoint */
router.get('/', async(req, res) => {
  const logger = req.app.locals.logger;
  const url = req.query.url;
  if (!isValidUrl(url)) {
    sysError(logger, res, 'Invalid URL');
  } else {
    try {
      const appenv = await fetchAppEnvSchema(logger, url);
      if (appenv && validateAppEnvSchema(appenv)) {
        return res.status(200).json(appenv);
      } else if (appenv) {
        return res.status(400, 'Invaid appenv schema');
      } else {
        return res.status(204); //No appenv returned from url, normal scenario
      }
    }
    catch (err) {
      sysError(logger, res, err);
    }
  }
});

module.exports = router;
