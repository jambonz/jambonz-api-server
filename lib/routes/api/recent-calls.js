const router = require('express').Router();
const sysError = require('../error');
const {DbErrorBadRequest} = require('../../utils/errors');

const parseAccountSid = (url) => {
  const arr = /Accounts\/([^\/]*)/.exec(url);
  if (arr) return arr[1];
};

router.get('/', async(req, res) => {
  const {logger, queryCdrs} = req.app.locals;
  try {
    logger.debug({opts: req.query}, 'GET /RecentCalls');
    const account_sid = parseAccountSid(req.originalUrl);
    const {page, count, trunk, direction, days, answered, start, end} = req.query || {};
    if (!page || page < 1) throw new DbErrorBadRequest('missing or invalid "page" query arg');
    if (!count || count < 25 || count > 500) throw new DbErrorBadRequest('missing or invalid "count" query arg');

    const data = await queryCdrs({
      account_sid,
      page,
      page_size: count,
      trunk,
      direction,
      days,
      answered,
      start: days ? undefined : start,
      end: days ? undefined : end,
    });

    res.status(200).json(data);
  } catch (err) {
    sysError(logger, res, err);
  }
});

module.exports = router;
