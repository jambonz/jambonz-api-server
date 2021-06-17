const router = require('express').Router();
const assert = require('assert');
const Account = require('../../models/account');
const {
  retrieveUpcomingInvoice
} = require('../../utils/stripe-utils');
const sysError = require('../error');

/* retrieve */
router.get('/', async(req, res) => {
  const logger = req.app.locals.logger;
  const {account_sid} = req.user;
  try {
    const results = await Account.retrieve(account_sid);
    assert.ok(1 === results.length, `account ${account_sid} not found`);
    const {stripe_customer_id} = results[0];
    if (!stripe_customer_id) return res.sendStatus(404);
    const invoice = await retrieveUpcomingInvoice(logger, stripe_customer_id);
    res.status(200).json(invoice);
  } catch (err) {
    if (err.statusCode) return res.sendStatus(err.statusCode);
    sysError(logger, res, err);
  }
});

module.exports = router;
