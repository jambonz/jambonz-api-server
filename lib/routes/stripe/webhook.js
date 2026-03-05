const router = require('express').Router();
//const debug = require('debug')('jambonz:api-server');
const Account = require('../../models/account');
const {retrieveSubscription} = require('../../utils/stripe-utils');
const stripeFactory = require('stripe');
const express = require('express');
const sysError = require('../error');

/** Invoice events */
const handleInvoicePaymentSucceeded = async(logger, obj) => {
  const {subscription} = obj;
  logger.debug({obj}, `payment for ${obj.billing_reason} succeeded`);
  const sub = await retrieveSubscription(logger, subscription);
  if ('active' === sub.status) {
    const {account_sid} = sub.metadata;
    if (!account_sid) {
      logger.info({subscription}, `handleInvoicePaymentSucceeded: received subscription ${sub.id} without account_sid`);
      return;
    }
    if (await Account.activateSubscription(logger, account_sid, sub.id,
      'subscription_create' === obj.billing_reason ? 'upgrade to paid plan' : 'change plan details')) {
      logger.info(`handleInvoicePaymentSucceeded: activated subscription for account ${account_sid}`);
    }
  }
};

/**
 * Two cases:
 * (1) A subscription renewal fails.  In this case we deactivate subscription
 * and the customer is down until they provide payment.
 * (2) A customer adds capacity during the month, and the pro-rated amount fails.
 * In this case, we leave the new subscription in a pending state
 * The customer continues (for the rest of the month at least) at
 * previous capacity levels.
 */

const handleInvoicePaymentFailed = async(logger, obj) => {
  const {subscription} = obj;
  const sub = await retrieveSubscription(logger, subscription);
  logger.debug({obj}, `payment for ${obj.billing_reason} failed, subscription status is ${sub.status}`);
  const {account_sid} = sub.metadata;
  if (!account_sid) {
    logger.info({subscription}, `handleInvoicePaymentFailed: received subscription ${sub.id} without account_sid`);
    return;
  }
  if (await Account.deactivateSubscription(logger, account_sid, 'payment failed')) {
    logger.info(`handleInvoicePaymentFailed: deactivated subscription for account ${account_sid}`);
  }
};

const handleInvoiceEvents = async(logger, evt) => {
  if (evt.type === 'invoice.payment_succeeded') handleInvoicePaymentSucceeded(logger, evt.data.object);
  else if (evt.type === 'invoice.payment_failed') handleInvoicePaymentFailed(logger, evt.data.object);
};


router.post('/', express.raw({type: 'application/json'}), async(req, res) => {
  const {logger} = req.app.locals;
  const sig = req.get('stripe-signature');

  let evt;
  try {
    if (!process.env.STRIPE_WEBHOOK_SECRET) throw new Error('missing webhook secret');
    const stripe = stripeFactory(process.env.STRIPE_API_KEY);
    evt = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    res.sendStatus(204);
  } catch (err) {
    sysError(logger, res, err);
  }

  /* process event */
  if (evt?.type?.startsWith('invoice.')) handleInvoiceEvents(logger, evt);
  else {
    logger.debug(evt, 'unhandled stripe webook');
  }
});

module.exports = router;
