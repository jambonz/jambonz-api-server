const router = require('express').Router();
const sysError = require('./error');
const {parseAccountSid} = require('./utils');

/**
 * retrieve queues for an account
 */
router.get('/', async(req, res) => {
  const account_sid = parseAccountSid(req);
  const {logger, listQueues} = req.app.locals;
  try {
    const queues = await listQueues(account_sid, req.query.name);
    res.status(200).json(queues);
  } catch (err) {
    sysError(logger, res, err);
  }
});


module.exports = router;
