const debug = require('debug')('jambonz:api-server');
const Model = require('./model');
const {getMysqlConnection} = require('../db');
const {promisePool} = require('../db');
const { v4: uuid } = require('uuid');

const {encrypt} = require('../utils/encrypt-decrypt');

const retrieveSql = `SELECT * from accounts acc
LEFT JOIN webhooks AS rh
ON acc.registration_hook_sid = rh.webhook_sid 
LEFT JOIN webhooks AS qh
ON acc.queue_event_hook_sid = qh.webhook_sid`;

const insertPendingAccountSubscriptionSql = `INSERT account_subscriptions 
(account_subscription_sid, account_sid, pending, stripe_subscription_id, 
stripe_payment_method_id, last4, exp_month, exp_year, card_type) 
VALUES (?,?,1,?,?,?,?,?,?)`;

const activateSubscriptionSql = `UPDATE account_subscriptions 
SET pending=0, effective_start_date = CURRENT_TIMESTAMP, stripe_subscription_id = ? 
WHERE account_subscription_sid = ? 
AND pending=1`;

const queryPendingSubscriptionSql = `SELECT * FROM account_subscriptions 
WHERE account_sid = ? 
AND effective_end_date IS NULL 
AND pending=1`;

const deactivateSubscriptionSql = `UPDATE account_subscriptions 
SET pending=1, pending_reason = ? 
WHERE account_sid = ? 
AND effective_end_date IS NULL 
AND pending=0`;

const updatePaymentInfoSql = `UPDATE account_subscriptions 
SET last4 = ?, exp_month = ?, exp_year = ?, card_type = ? 
WHERE account_sid = ? 
AND effective_end_date IS NULL`;

const insertAccountProductsSql = `INSERT account_products 
(account_product_sid, account_subscription_sid, product_sid, quantity) 
VALUES (?,?,?,?);
`;

const replaceOldSubscriptionSql = `UPDATE account_subscriptions 
SET effective_end_date = CURRENT_TIMESTAMP, change_reason = ?  
WHERE account_sid = ? 
AND effective_end_date IS NULL 
AND account_subscription_sid <> ?`;

const retrieveActiveSubscriptionSql = `SELECT * 
FROM account_subscriptions 
WHERE account_sid = ? 
AND effective_end_date IS NULL 
AND pending = 0`;

function transmogrifyResults(results) {
  return results.map((row) => {
    const obj = row.acc;

    /* registration hook */
    if (row.rh && Object.keys(row.rh).length && row.rh.url !== null) {
      Object.assign(obj, {registration_hook: row.rh});
      delete obj.registration_hook.webhook_sid;
    }
    else obj.registration_hook = null;
    delete obj.registration_hook_sid;

    /* queue event hook */
    if (row.qh && Object.keys(row.qh).length && row.qh.url !== null) {
      Object.assign(obj, {queue_event_hook: row.qh});
      delete obj.queue_event_hook.webhook_sid;
    }
    else obj.queue_event_hook = null;
    delete obj.queue_event_hook_sid;

    return obj;
  });
}

class Account extends Model {
  constructor() {
    super();
  }

  /**
   * list all accounts
   */
  static retrieveAll(service_provider_sid, account_sid) {
    let sql = retrieveSql;
    const args = [];
    if (account_sid) {
      sql = `${sql} WHERE acc.account_sid = ?`;
      args.push(account_sid);
    }
    else if (service_provider_sid) {
      sql = `${sql} WHERE acc.service_provider_sid = ?`;
      args.push(service_provider_sid);
    }
    return new Promise((resolve, reject) => {
      getMysqlConnection((err, conn) => {
        if (err) return reject(err);
        conn.query({sql, nestTables: true}, args, (err, results, fields) => {
          conn.release();
          if (err) return reject(err);
          const r = transmogrifyResults(results);
          resolve(r);
        });
      });
    });
  }

  /**
   * retrieve an account
   */
  static retrieve(sid, service_provider_sid) {
    const args = [sid];
    let sql = `${retrieveSql} WHERE acc.account_sid = ?`;
    if (service_provider_sid) {
      sql = `${retrieveSql} WHERE acc.account_sid = ? AND acc.service_provider_sid = ?`;
      args.push(service_provider_sid);
    }
    return new Promise((resolve, reject) => {
      getMysqlConnection((err, conn) => {
        if (err) return reject(err);
        conn.query({sql, nestTables: true}, args, (err, results, fields) => {
          conn.release();
          if (err) return reject(err);
          const r = transmogrifyResults(results);
          resolve(r);
        });
      });
    });
  }

  static async updateStripeCustomerId(sid, customerId) {
    await promisePool.execute(
      'UPDATE accounts SET stripe_customer_id = ? WHERE account_sid = ?',
      [customerId, sid]);
  }

  static async getSubscription(sid) {
    const [r] = await promisePool.execute(retrieveActiveSubscriptionSql, [sid]);
    debug(r, `Account.getSubscription ${sid}`);
    return r.length > 0 ? r[0] : null;
  }

  static async deactivateSubscription(logger, account_sid, reason) {
    logger.debug('deactivateSubscription');

    /**
     * Two cases:
     * (1) A subscription renewal fails.  In this case we deactivate subscription
     * and the customer is down until they provide payment.
     * (2) A customer adds capacity during the month, and the pro-rated amount fails.
     * In this case, we leave the new subscription in a pending state
     * The customer continues (for the rest of the month at least) at
     * previous capacity levels.
     */
    const [r] = await promisePool.query(queryPendingSubscriptionSql, account_sid);
    if (r.length > 0) {
      /* leave new subscription pending */
      await promisePool.execute(
        'UPDATE account_subscriptions set pending_reason = ? WHERE account_subscription_sid = ?',
        [reason, r[0].account_subscription_sid]);
      logger.debug('deactivateSubscription - leave pending subscription in pending state');
    }
    else {
      /* deactivate their current active subscription */
      const [r] = await promisePool.execute(deactivateSubscriptionSql, [reason, account_sid]);
      logger.debug('deactivateSubscription - deactivated subscription; customer will not have service');
      return 1 == r.affectedRows;
    }
  }

  static async activateSubscription(logger, account_sid, subscription_id, reason) {
    logger.debug('activateSubscription');

    const [r] = await promisePool.query(queryPendingSubscriptionSql, account_sid);
    if (0 === r.length) return false;

    const [r2] = await promisePool.execute(activateSubscriptionSql,
      [subscription_id, r[0].account_subscription_sid]);
    if (0 === r2.affectedRows) return false;

    /* disable the old subscription, if any */
    const [r3] = await promisePool.execute(replaceOldSubscriptionSql, [
      reason, account_sid, r[0].account_subscription_sid]);
    debug(r3, 'Account.activateSubscription - replaced old subscription');

    /* update account.plan to paid, if it isnt already */
    await promisePool.execute(
      'UPDATE accounts SET plan_type = \'paid\' WHERE account_sid = ?',
      [account_sid]);
    return true;
  }

  static async updatePaymentInfo(logger, account_sid, pm) {
    const {card} = pm;
    const last4_encrypted = encrypt(card.last4);
    await promisePool.execute(updatePaymentInfoSql,
      [last4_encrypted, card.exp_month, card.exp_year, card.brand, account_sid]);
  }

  static async provisionPendingSubscription(logger, account_sid, products, payment_method, subscription_id) {
    logger.debug('provisionPendingSubscription');
    const account_subscription_sid = uuid();
    const {id, card} = payment_method;

    /* add a row to account_subscription */
    let last4_encrypted = null;
    if (card) {
      last4_encrypted = encrypt(card.last4);
    }
    const [r] = await promisePool.execute(insertPendingAccountSubscriptionSql, [
      account_subscription_sid,
      account_sid,
      subscription_id || null,
      id,
      last4_encrypted,
      card ? card.exp_month : null,
      card ? card.exp_year : null,
      card ? card.brand : null
    ]);
    debug(r, 'Account.activateSubscription - insert account_subscriptions');
    if (r.affectedRows !== 1) {
      throw new Error(`failed inserting account_subscriptions for accunt_sid ${account_sid}`);
    }

    /* add a row for each product to account_products */
    await Promise.all(products.map((product) => {
      const {product_sid, quantity} = product;
      const account_products_sid = uuid();
      return promisePool.execute(insertAccountProductsSql, [
        account_products_sid, account_subscription_sid, product_sid, quantity
      ]);
    }));
    return account_subscription_sid;
  }
}

Account.table = 'accounts';
Account.fields = [
  {
    name: 'account_sid',
    type: 'string',
    primaryKey: true
  },
  {
    name: 'name',
    type: 'string',
    required: true
  },
  {
    name: 'service_provider_sid',
    type: 'string',
    required: true
  },
  {
    name: 'sip_realm',
    type: 'string',
  },
  {
    name: 'queue_event_hook_sid',
    type: 'string',
  },
  {
    name: 'registration_hook_sid',
    type: 'string',
  },
  {
    name: 'device_calling_application_sid',
    type: 'string',
  },
  {
    name: 'is_active',
    type: 'number',
  },
  {
    name: 'created_at',
    type: 'date',
  },
  {
    name: 'plan_type',
    type: 'string',
  },
  {
    name: 'stripe_customer_id',
    type: 'string',
  },
  {
    name: 'webhook_secret',
    type: 'string',
  },
  {
    name: 'disable_cdrs',
    type: 'number',
  },
  {
    name: 'subspace_client_id',
    type: 'string',
  },
  {
    name: 'subspace_client_secret',
    type: 'string',
  },
  {
    name: 'subspace_sip_teleport_id',
    type: 'string',
  },
  {
    name: 'subspace_sip_teleport_destinations',
    type: 'string',
  },
  {
    name: 'siprec_hook_sid',
    type: 'string',
  },
  {
    name: 'record_all_calls',
    type: 'number'
  },
  {
    name: 'bucket_credential',
    type: 'string'
  }
];

module.exports = Account;
