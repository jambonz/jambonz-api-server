const router = require('express').Router();
const {promisePool} = require('../../db');
const sysError = require('../error');
const retrieveApplicationsSql = `SELECT * from applications app
LEFT JOIN webhooks AS ch
ON app.call_hook_sid = ch.webhook_sid
LEFT JOIN webhooks AS sh
ON app.call_status_hook_sid = sh.webhook_sid 
LEFT JOIN webhooks AS mh
ON app.messaging_hook_sid = mh.webhook_sid
WHERE service_provider_sid = ?`;

const transmogrifyResults = (results) => {
  return results.map((row) => {
    const obj = row.app;
    if (row.ch && Object.keys(row.ch).length && row.ch.url !== null) {
      Object.assign(obj, {call_hook: row.ch});
    }
    else obj.call_hook = null;
    if (row.sh && Object.keys(row.sh).length && row.sh.url !== null) {
      Object.assign(obj, {call_status_hook: row.sh});
    }
    else obj.call_status_hook = null;
    if (row.mh && Object.keys(row.mh).length && row.mh.url !== null) {
      Object.assign(obj, {messaging_hook: row.mh});
    }
    else obj.messaging_hook = null;
    delete obj.call_hook_sid;
    delete obj.call_status_hook_sid;
    delete obj.messaging_hook_sid;
    return obj;
  });
};

router.get('/:service_provider_sid', async(req, res) => {
  const logger = req.app.locals.logger;
  const {service_provider_sid} = req.params;

  try {
    const [r] = await promisePool.query('SELECT * from service_providers where service_provider_sid = ?',
      service_provider_sid);
    if (r.length === 0) {
      logger.info(`/AccountTest invalid service_provider_sid ${service_provider_sid}`);
      return res.sendStatus(404);
    }

    const [numbers] = await promisePool.query('SELECT number FROM phone_numbers WHERE service_provider_sid = ?',
      service_provider_sid);
    const [results] = await promisePool.query({sql: retrieveApplicationsSql, nestTables: true}, service_provider_sid);

    res.json({phonenumbers: numbers.map((n) => n.number), applications: transmogrifyResults(results)});
  } catch (err) {
    sysError(logger, res, err);
  }
});

module.exports = router;
