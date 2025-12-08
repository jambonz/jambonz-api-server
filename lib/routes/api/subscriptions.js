const router = require('express').Router();
const {DbErrorBadRequest} = require('../../utils/errors');
const Account = require('../../models/account');
const {
  createCustomer,
  retrieveCustomer,
  updateCustomer,
  createSubscription,
  retrieveSubscription,
  updateSubscription,
  retrieveInvoice,
  payOutstandingInvoicesForCustomer,
  attachPaymentMethod,
  detachPaymentMethod,
  retrievePaymentMethod,
  retrieveUpcomingInvoice
} = require('../../utils/stripe-utils');
const {setupFreeTrial} = require('./utils');
const sysError = require('../error');
const Product = require('../../models/product');
const actions = [
  'upgrade-to-paid',
  'downgrade-to-free',
  'update-payment-method',
  'update-quantities'
];

const MIN_VOICE_CALL_SESSION_QUANTITY = 5;

const handleError = async(logger, method, res, err) => {
  if ('StatusError' === err.name) {
    const text = await err.text();
    let details;
    if (text) {
      details = JSON.parse(text);
      logger.info({details}, `${method} failed`);
    }
    if (402 === err.statusCode && details) {
      return res.status(err.statusCode).json(details);
    }
    return res.sendStatus(err.statusCode);
  }
  sysError(logger, res, err);
};

/**
 * We handle 3 possible outcomes
 * - the initial payment was successful
 * - there was a card error on the initial payment (i.e. decline)
 * - there is a requirement for additional authentication (e.g. SCA)
 * see: https://stripe.com/docs/billing/migration/strong-customer-authentication
 * @param {*} req
 * @param {*} res
 * @param {*} subscription
 */
const handleSubscriptionOutcome = async(req, res, subscription) => {
  const logger = req.app.locals.logger;
  const {account_sid} = subscription.metadata;
  const {status, latest_invoice} = subscription;
  const {payment_intent} = latest_invoice;

  /* success case */
  if ('active' == status && 'paid' === latest_invoice.status && 'succeeded' === payment_intent.status) {
    await Account.activateSubscription(logger, account_sid, subscription.id, 'upgrade to paid plan');
    return res.status(201).json({
      status: 'success',
      chargedAmount: latest_invoice.amount_paid,
      currency: payment_intent.currency,
      statementDescriptor: payment_intent.statement_descriptor
    });
  }

  /* card error */
  if ('incomplete' == status && 'open' === latest_invoice.status &&
    'requires_payment_method' === payment_intent.status) {
    return res.status(201).json({
      status: 'card error',
      subscription: subscription.id,
      client_secret: payment_intent.client_secret,
      reason: payment_intent.last_payment_error.message
    });
  }

  /* more authentication required */
  if ('incomplete' == status && 'open' === latest_invoice.status && 'requires_action' === payment_intent.status) {
    return res.status(201).json({
      status: 'action required',
      subscription: subscription.id,
      client_secret: payment_intent.client_secret
    });
  }

  throw new Error(
    `handleSubscriptionOutcome unexpected status ${status}:${latest_invoice.status}:${payment_intent.status}`);
};

/**
 * Transition from free --> paid
 * Create customer in Stripe, if needed
 * Set the default payment method
 * Create a subscription
 * @param {*} req
 * @param {*} res
 */
const upgradeToPaidPlan = async(req, res) => {
  const logger = req.app.locals.logger;
  const {account_sid, name, email} = req.user;
  const {payment_method_id, products} = req.body;
  const arr = await Account.retrieve(req.user.account_sid);
  const account = arr[0];

  /* retrieve stripe customer id locally, provision on Stripe if needed */
  logger.debug({account}, 'upgradeToPaidPlan retrieved account');
  let stripe_customer_id = account.stripe_customer_id;
  if (!stripe_customer_id) {
    logger.debug('upgradeToPaidPlan provisioning customer');
    const customer = await createCustomer(logger, account_sid, email, name);
    logger.debug(`upgradeToPaidPlan provisioned customer_id ${customer.id}`);
    await Account.updateStripeCustomerId(account_sid, customer.id);
    stripe_customer_id = customer.id;
  }

  /* attach the payment method to the customer and make it their default */
  const pm = await attachPaymentMethod(logger, payment_method_id, stripe_customer_id);
  const customer = await updateCustomer(logger, stripe_customer_id, {
    invoice_settings: {
      default_payment_method: req.body.payment_method_id,
    }
  });
  logger.debug({customer}, 'successfully updated customer');

  /* create a pending subscription -- will be activated on invoice.paid */
  const account_subscription_sid = await Account.provisionPendingSubscription(logger, account_sid, products, pm);

  /* create the subscription in Stripe */
  const items = products.map((product) => {
    return {
      price: product.price_id,
      quantity: product.quantity,
      metadata: {
        product_sid: product.product_sid
      }
    };
  });
  logger.debug({items}, 'creating subscription');
  const subscription = await createSubscription(logger, stripe_customer_id,
    {account_sid, account_subscription_sid}, items);
  logger.debug({subscription}, 'created subscription');

  await handleSubscriptionOutcome(req, res, subscription);
};

const validateProductQuantities = async(products) => {
  // validate voice call session minimums
  const productModel = new Product();
  const availableProducts = await productModel.retrieveAll();
  const voiceCallSessionsProductSid =
    availableProducts.find((p) => p.category === 'voice_call_session')?.product_sid;
  if (voiceCallSessionsProductSid) {
    const invalid = products.find((p) => {
      return (p.product_sid === voiceCallSessionsProductSid &&
        (typeof p.quantity !== 'number' || p.quantity < MIN_VOICE_CALL_SESSION_QUANTITY));
    });
    if (invalid) {
      throw new DbErrorBadRequest('invalid voice call session value, minimum is ' +
        MIN_VOICE_CALL_SESSION_QUANTITY);
    }
  }
};
const downgradeToFreePlan = async(req, res) => {
  const logger = req.app.locals.logger;
  const {account_sid} = req.user;
  try {
    await setupFreeTrial(logger, account_sid);
    return res.status(200).json({status: 'success'});
  } catch (err) {
    handleError(logger, 'downgradeToFreePlan', res, err);
  }
};
const updatePaymentMethod = async(req, res) => {
  const logger = req.app.locals.logger;
  const {account_sid} = req.user;
  try {
    const {payment_method_id} = req.body;
    const arr = await Account.retrieve(req.user.account_sid);
    const account = arr[0];
    if (!account.stripe_customer_id) {
      throw new DbErrorBadRequest(`Account ${account_sid} is not provisioned in Stripe`);
    }
    const customer = await retrieveCustomer(logger, account.stripe_customer_id);
    //logger.debug({customer}, 'retrieved customer');

    /* attach the payment method to the customer */
    const pm = await attachPaymentMethod(logger, payment_method_id, account.stripe_customer_id);
    logger.debug({pm}, 'attached payment method to customer');

    /* update last4 etc in our db */
    await Account.updatePaymentInfo(logger, account_sid, pm);

    /* make it the customer's default payment method */
    await updateCustomer(logger, account.stripe_customer_id, {
      invoice_settings: {
        default_payment_method: req.body.payment_method_id,
      }
    });

    /* detach the customer's old payment method */
    const old_pm = customer.default_source || customer.invoice_settings.default_payment_method;
    if (old_pm) await detachPaymentMethod(logger, old_pm);

    /* if the customer has an unpaid invoice, try to pay it */
    const success = await payOutstandingInvoicesForCustomer(logger, account.stripe_customer_id);
    res.status(200).json({
      status: success ? 'success' : 'failed to pay outstanding invoices'
    });
  } catch (err) {
    handleError(logger, 'updatePaymentMethod', res, err);
  }
};
const updateQuantities = async(req, res) => {
  /**
   * see https://stripe.com/docs/billing/subscriptions/upgrade-downgrade#immediate-payment
   * and https://stripe.com/docs/billing/subscriptions/pending-updates
   */
  const logger = req.app.locals.logger;
  const {account_sid} = req.user;
  const {products, dry_run} = req.body;

  if (!products || !Array.isArray(products) ||
    0 === products.length ||
    products.find((p) => !p.price_id || !p.product_sid)) {
    logger.info({products}, 'Subscription:updateQuantities invalid products');
    return res.sendStatus(400);
  }

  try {
    const account_subscription = await Account.getSubscription(req.user.account_sid);
    if (!account_subscription || !account_subscription.stripe_subscription_id) {
      logger.info(`Subscription:updateQuantities No active subscription found for account_sid ${account_sid}`);
      return res.sendStatus(400);
    }
    const subscription_id = account_subscription.stripe_subscription_id;

    const subscription = await retrieveSubscription(logger, subscription_id);
    logger.debug({subscription}, 'retrieved existing subscription');
    const pm = await retrievePaymentMethod(logger, account_subscription.stripe_payment_method_id);
    logger.debug({pm}, 'retrieved existing payment method');
    const items = products.map((product) => {
      const existingItem = subscription.items.data.find((i) => i.price.id === product.price_id);
      const obj = {
        quantity: product.quantity,
      };
      return Object.assign(obj, existingItem ? {id: existingItem.id} : {price: product.price_id});
    });

    if (dry_run) {
      const invoice = await retrieveUpcomingInvoice(logger, subscription.customer, subscription.id, items);
      logger.debug({invoice}, 'dry run - upcoming invoice');
      const dt = new Date(invoice.next_payment_attempt * 1000);
      const sum = (acc, current) => acc + current.amount;
      const prorated_cost = invoice.lines.data
        .filter((l) => l.proration === true)
        .reduce(sum, 0);
      const monthly_cost = invoice.lines.data
        .filter((l) => l.proration === false)
        .reduce(sum, 0);
      return res.status(201).json({
        currency: invoice.currency,
        prorated_cost,
        monthly_cost,
        next_invoice_date: dt.toDateString()
      });
    }

    /* create a pending subscription */
    await Account.provisionPendingSubscription(logger, account_sid, products,
      pm, subscription_id);

    /* update the subscription in Stripe */
    const updated = await updateSubscription(logger, subscription_id, items);
    logger.debug({updated}, 'updated subscription');

    /* get latest invoice, to see if payment is needed */
    const invoice = await retrieveInvoice(logger, updated.latest_invoice);
    logger.debug({invoice}, 'latest invoice');

    if ('paid' === invoice.status) {
      logger.debug('activating pending subscription to new quantities since no invoice outstanding');
      await Account.activateSubscription(logger, account_sid, subscription_id, 'selected new capacities');
      return res.status(201).json({
        status: 'success'
      });
    }
    else {
      return res.status(201).json({
        status: 'failed',
        reason: 'payment required'
      });
    }
  } catch (err) {
    handleError(logger, 'updatePaymentMethod', res, err);
  }
};

/* create */
router.post('/', async(req, res) => {
  const logger = req.app.locals.logger;
  try {
    const {action, payment_method_id, products} = req.body;

    if (!actions.includes(action)) throw new DbErrorBadRequest('invalid or missing action');
    if ('update-payment-method' === action && typeof payment_method_id !== 'string') {
      throw new DbErrorBadRequest('missing payment_method_id');
    }
    if (['update-quantities', 'upgrade-to-paid'].includes(action)) {
      if ((!Array.isArray(products) || 0 === products.length)) {
        throw new DbErrorBadRequest('missing products');
      }
      await validateProductQuantities(products);
    }

    switch (action) {
      case 'upgrade-to-paid':
        await upgradeToPaidPlan(req, res);
        break;
      case 'downgrade-to-free':
        await downgradeToFreePlan(req, res);
        break;
      case 'update-payment-method':
        await updatePaymentMethod(req, res);
        break;
      case 'update-quantities':
        await updateQuantities(req, res);
        break;
    }
  } catch (err) {
    handleError(logger, 'POST /Subscription', res, err);
  }
});

/* get */
router.get('/', async(req, res) => {
  const logger = req.app.locals.logger;
  const {account_sid} = req.user;
  try {
    const subscription = await Account.getSubscription(account_sid);
    if (!subscription || !subscription.stripe_subscription_id) return res.sendStatus(404);
    const sub = await retrieveSubscription(logger, subscription.stripe_subscription_id);
    res.status(200).json(sub);
  } catch (err) {
    handleError(logger, 'GET /Subscription', res, err);
  }
});

module.exports = router;
