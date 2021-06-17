const uuid = require('uuid').v4;
const Account = require('../../models/account');
const {promisePool} = require('../../db');
const {cancelSubscription, detachPaymentMethod} = require('../../utils/stripe-utils');
const freePlans = require('../../utils/free_plans');
const insertAccountSubscriptionSql = `INSERT INTO account_subscriptions 
(account_subscription_sid, account_sid) 
values (?, ?)`;
const replaceOldSubscriptionSql = `UPDATE account_subscriptions 
SET effective_end_date = CURRENT_TIMESTAMP, change_reason = ?  
WHERE account_subscription_sid = ?`;

const setupFreeTrial = async(logger, account_sid, isReturningUser) => {
  const sid = uuid();

  /* see if we have an existing subscription */
  const account_subscription = await Account.getSubscription(account_sid);
  const planType = account_subscription || isReturningUser ? 'free' : 'trial';
  logger.debug({account_subscription}, `setupFreeTrial: assigning ${account_sid} to ${planType} plan`);

  /* create a subscription */
  await promisePool.execute(insertAccountSubscriptionSql, [sid, account_sid]);

  /* add products to it */
  const [products] = await promisePool.query('SELECT * from products');
  const name2Product = new Map();
  products.forEach((p) => name2Product.set(p.category, p.product_sid));

  await Promise.all(freePlans[planType].map((p) => {
    const data = {
      account_product_sid: uuid(),
      account_subscription_sid: sid,
      product_sid: name2Product.get(p.category),
      quantity: p.quantity
    };
    return promisePool.query('INSERT INTO account_products SET ?', data);
  }));
  logger.debug({products}, 'setupFreeTrial: added products');

  /* disable the old subscription, if any */
  if (account_subscription) {
    const {
      account_subscription_sid,
      stripe_subscription_id,
      stripe_payment_method_id
    } = account_subscription;
    await promisePool.execute(replaceOldSubscriptionSql, [
      'downgraded to free plan', account_subscription_sid]);
    logger.debug('setupFreeTrial: deactivated previous plan');

    const promises = [];
    if (stripe_subscription_id) {
      logger.debug(`setupFreeTrial: deactivating subscription ${stripe_subscription_id}`);
      promises.push(cancelSubscription(logger, stripe_subscription_id));
    }
    if (stripe_payment_method_id) {
      promises.push(detachPaymentMethod(logger, stripe_payment_method_id));
    }
    if (promises.length) await Promise.all(promises);
  }

  /* update account.plan */
  await promisePool.execute(
    'UPDATE accounts SET plan_type = ? WHERE account_sid = ?',
    [planType, account_sid]);
};

const createTestCdrs = async(writeCdrs,  account_sid) => {
  const points = 2000;
  const data = [];
  const start = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000));
  const now = new Date();
  const increment = (now.getTime() - start.getTime()) / points;
  for (let i = 0 ; i < points; i++) {
    const attempted_at = new Date(start.getTime() + (i * increment));
    const failed = 0 === i % 5;
    data.push({
      call_sid: 'b6f48929-8e86-4d62-ae3b-64fb574d91f6',
      from: '15083084809',
      to: '18882349999',
      answered:  !failed,
      sip_callid: '685cd008-0a66-4974-b37a-bdd6d9a3c4aa@192.168.1.100',
      sip_status: 200,
      duration: failed ? 0 : 45,
      attempted_at: attempted_at.getTime(),
      answered_at: attempted_at.getTime() + 3000,
      terminated_at: attempted_at.getTime() + 45000,
      termination_reason: 'caller hungup',
      host: '192.168.1.100',
      remote_host: '3.55.24.34',
      account_sid,
      direction: 0 === i % 2 ? 'inbound' : 'outbound',
      trunk:  0 === i % 2 ? 'twilio' : 'user'
    });
  }

  await writeCdrs(data);

};

const createTestAlerts = async(writeAlerts, AlertType, account_sid) => {
  const points = 100;
  const data = [];
  const start = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000));
  const now = new Date();
  const increment = (now.getTime() - start.getTime()) / points;
  for (let i = 0 ; i < points; i++) {
    const timestamp = new Date(start.getTime() + (i * increment));
    const scenario = i % 5;
    switch (scenario) {
      case 0:
        data.push({timestamp, account_sid,
          alert_type: AlertType.WEBHOOK_STATUS_FAILURE, url: 'http://foo.bar', status: 404});
        break;
      case 1:
        data.push({timestamp, account_sid, alert_type: AlertType.WEBHOOK_CONNECTION_FAILURE, url: 'http://foo.bar'});
        break;
      case 2:
        data.push({timestamp, account_sid, alert_type: AlertType.TTS_NOT_PROVISIONED, vendor: 'google'});
        break;
      case 3:
        data.push({timestamp, account_sid, alert_type: AlertType.CARRIER_NOT_PROVISIONED});
        break;
      case 4:
        data.push({timestamp, account_sid, alert_type: AlertType.CALL_LIMIT, count: 50});
        break;
      default:
        break;
    }
  }

  await writeAlerts(data);

};

const parseServiceProviderSid = (req) => {
  const arr = /ServiceProviders\/([^\/]*)/.exec(req.originalUrl);
  if (arr) return arr[1];
};

const parseAccountSid = (req) => {
  const arr = /Accounts\/([^\/]*)/.exec(req.originalUrl);
  if (arr) return arr[1];
};

const hasAccountPermissions = (req, res, next) => {
  if (req.user.hasScope('admin')) return next();
  if (req.user.hasScope('account')) {
    const account_sid = parseAccountSid(req);
    if (account_sid === req.user.account_sid) return next();
  }
  res.status(403).json({
    status: 'fail',
    message: 'insufficient privileges'
  });
};

const hasServiceProviderPermissions = (req, res, next) => {
  if (req.user.hasScope('admin')) return next();
  if (req.user.hasScope('service_provider')) {
    const service_provider_sid = parseServiceProviderSid(req);
    if (service_provider_sid === req.user.service_provider_sid) return next();
  }
  res.status(403).json({
    status: 'fail',
    message: 'insufficient privileges'
  });
};

module.exports = {
  setupFreeTrial,
  createTestCdrs,
  createTestAlerts,
  parseAccountSid,
  parseServiceProviderSid,
  hasAccountPermissions,
  hasServiceProviderPermissions
};
