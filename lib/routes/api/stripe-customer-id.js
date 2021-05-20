const router = require('express').Router();
const Account = require('../../models/account');
const sysError = require('../error');

/* list */
router.get('/', async(req, res) => {
  const {createCustomer} = require('../../utils/stripe-utils');
  const logger = req.app.locals.logger;
  try {
    const {account_sid, email, name} = req.user;
    logger.debug({account_sid, email, name}, 'GET /StripeCustomerId');
    const results = await Account.retrieve(account_sid);
    if (results.length === 0) return res.sendStatus(404);
    const account = results[0];

    /* is account already provisioned in Stripe ? */
    if (account.stripe_customer_id) return res.status(200).json({stripe_customer_id: account.stripe_customer_id});

    /* no - provision it now */
    const customer = await createCustomer(logger, account_sid, email, name);
    account.stripe_customer_id = customer.id;
    await Account.updateStripeCustomerId(account_sid, customer.id);
    res.status(200).json({stripe_customer_id: customer.id});
  } catch (err) {
    sysError(logger, res, err);
  }
});

/* delete */
router.delete('/', async(req, res) => {
  const {deleteCustomer} = require('../../utils/stripe-utils');
  const logger = req.app.locals.logger;
  const {account_sid} = req.user;
  try {
    const acc = await Account.retrieve(account_sid);
    logger.debug({acc}, 'retrieved account');
    if (!acc || 0 === acc.length || !acc[0].stripe_customer_id) return res.sendStatus(404);
    const {stripe_customer_id} = acc[0];
    logger.info(`deleting stripe customer id ${stripe_customer_id}`);
    await deleteCustomer(logger, stripe_customer_id);
    await Account.updateStripeCustomerId(account_sid, null);
    res.sendStatus(204);
  } catch (err) {
    sysError(logger, res, err);
  }
});

module.exports = router;
