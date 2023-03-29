const router = require('express').Router();
const sysError = require('../error');
const {DbErrorBadRequest} = require('../../utils/errors');
const { parseServiceProviderSid } = require('./utils');

const parseAccountSid = (url) => {
  const arr = /Accounts\/([^\/]*)/.exec(url);
  if (arr) return arr[1];
};

router.get('/', async(req, res) => {
  const {logger, queryAlerts, queryAlertsSP} = req.app.locals;
  try {
    logger.debug({opts: req.query}, 'GET /Alerts');
    const account_sid = parseAccountSid(req.originalUrl);
    const service_provider_sid = account_sid ? null : parseServiceProviderSid(req.originalUrl);
    const {page, count, alert_type, days, start, end} = req.query || {};
    if (!page || page < 1) throw new DbErrorBadRequest('missing or invalid "page" query arg');
    if (!count || count < 25 || count > 500) throw new DbErrorBadRequest('missing or invalid "count" query arg');

    if (account_sid) {
      const data = await queryAlerts({
        account_sid,
        page,
        page_size: count,
        alert_type,
        days,
        start: days ? undefined : start,
        end: days ? undefined : end,
      });

      res.status(200).json(data);
    }
    else {
      const data = await queryAlertsSP({
        service_provider_sid,
        page,
        page_size: count,
        alert_type,
        days,
        start: days ? undefined : start,
        end: days ? undefined : end,
      });

      res.status(200).json(data);
    }
  } catch (err) {
    sysError(logger, res, err);
  }
});

module.exports = router;
