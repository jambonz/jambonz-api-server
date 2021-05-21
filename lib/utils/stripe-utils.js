if (!process.env.JAMBONZ_HOSTING) return;

const assert = require('assert');
assert.ok(process.env.STRIPE_API_KEY || process.env.NODE_ENV === 'test',
  'missing env STRIPE_API_KEY for billing operations');
assert.ok(process.env.STRIPE_BASE_URL || process.env.NODE_ENV === 'test',
  'missing env STRIPE_BASE_URL for billing operations');

const bent = require('bent');
const formurlencoded = require('form-urlencoded').default;
const qs = require('qs');
const toBase64 = (str) => Buffer.from(str || '', 'utf8').toString('base64');
const basicAuth = () => {
  const header = `Basic ${toBase64(process.env.STRIPE_API_KEY)}`;
  return {Authorization: header};
};
const postForm = bent(process.env.STRIPE_BASE_URL || 'http://127.0.0.1', 'POST', 'string',
  Object.assign({'Content-Type': 'application/x-www-form-urlencoded'}, basicAuth()), 200);
const getJSON = bent(process.env.STRIPE_BASE_URL || 'http://127.0.0.1', 'GET', 'json', basicAuth(), 200);
const deleteJSON = bent(process.env.STRIPE_BASE_URL || 'http://127.0.0.1', 'DELETE', 'json', basicAuth(), 200);
//const debug = require('debug')('jambonz:api-server');

const listProducts = async(logger) => await getJSON('/products?active=true');

const listPrices = async(logger) => await getJSON('/prices?active=true&expand[]=data.tiers&expand[]=data.product');

const retrievePricesForProduct = async(logger, id) =>
  await getJSON(`/prices?product=${id}&active=true&expand[]=data.tiers&expand[]=data.product`);

const retrieveProduct = async(logger, id) =>
  await getJSON(`/products/${id}`);


const retrieveCustomer = async(logger, id) =>
  await getJSON(`/customers/${id}`);

const retrieveUpcomingInvoice = async(logger, customer_id, subscription_id, items) => {
  const params = Object.assign(
    {customer: customer_id},
    subscription_id ? {subscription: subscription_id} : {},
    items ? {subscription_items: items} : {});
  const queryString = qs.stringify(params, {encode: false});
  logger.debug({params, qs}, 'retrieving upcoming invoice');
  return await getJSON(`/invoices/upcoming?${queryString}`);
};

const retrieveInvoice = async(logger, id) =>
  await getJSON(`/invoices/${id}`);

const createCustomer = async(logger, account_sid, email, name) => {
  const obj = {
    email,
    metadata: {account_sid}
  };
  if (name) obj.name = name;
  logger.debug({obj}, 'provisioning customer');
  const result = await postForm('/customers', formurlencoded(obj));
  return JSON.parse(result);
};

const updateCustomer = async(logger, id, obj) => {
  logger.debug({obj}, `updating customer ${id}`);
  const result = await postForm(`/customers/${id}`, formurlencoded(obj));
  return JSON.parse(result);
};

const deleteCustomer = async(logger, id) =>
  await deleteJSON(`/customers/${id}`);

const attachPaymentMethod = async(logger, payment_method_id, customer_id) => {
  const obj = {
    customer: customer_id
  };
  const result = await postForm(`/payment_methods/${payment_method_id}/attach`,
    formurlencoded(obj));
  return JSON.parse(result);
};

const detachPaymentMethod = async(logger, payment_method_id) => {
  const result = await postForm(`/payment_methods/${payment_method_id}/detach`);
  return JSON.parse(result);
};

const createSubscription = async(logger, customer, metadata, items) => {
  assert.ok(Array.isArray(items) && items.length > 0);
  const obj = {
    customer,
    metadata,
    items
  };
  const result = await postForm('/subscriptions?expand[]=latest_invoice&expand[]=latest_invoice.payment_intent',
    formurlencoded(obj));
  return JSON.parse(result);
};

/*
const deleteInvoiceItem = async(logger, id) => {
  return JSON.parse(await deleteJSON(`/invoiceitems/${id}`));
};
*/

const updateSubscription = async(logger, id, items) => {
  assert.ok(Array.isArray(items) && items.length > 0);
  const obj = {
    proration_behavior: 'always_invoice',
    payment_behavior: 'pending_if_incomplete',
    items
  };
  const result = await postForm(`/subscriptions/${id}`,
    formurlencoded(obj));
  return JSON.parse(result);
};


const payInvoice = async(logger, id) => {
  const result = await postForm(`/invoices/${id}/pay`);
  return JSON.parse(result);
};

const payOutstandingInvoicesForCustomer = async(logger, customer_id) => {
  let success = true;
  const customer = await retrieveCustomer(logger, customer_id);
  const {subscriptions} = customer;
  logger.debug({subscriptions}, 'payOutstandingInvoicesForCustomer - subscriptions');
  if (subscriptions && subscriptions.data.length > 0) {
    const promises = subscriptions.data
      .filter((s) => ['incomplete', 'past_due'].includes(s.status) || s.pending_update)
      .map((s) => payInvoice(logger, s.latest_invoice));
    const invoices = await Promise.all(promises);
    if (invoices.find((i) => 'paid' !== i.status)) {
      success = false;
    }
  }
  return success;
};

const retrieveSubscription = async(logger, id) =>
  await getJSON(`/subscriptions/${id}?expand[]=latest_invoice`);

const cancelSubscription = async(logger, id) =>
  await deleteJSON(`/subscriptions/${id}`);

const retrievePaymentMethod = async(logger, id) => await getJSON(`/payment_methods/${id}`);

const calculateInvoiceAmount = async(logger, products) => {
  assert.ok(Array.isArray(products) && products.length, 'calculateInvoiceAmount: products must be array');
  assert.ok(!products.find((p) => !p.priceId || !p.quantity), 'calculateInvoiceAmount: invalid products array');

  const prices = await Promise.all(products.map((p) => {
    return getJSON(`/prices/${p.priceId}?expand[]=tiers`);
  }));
  logger.debug({prices, products}, 'calculateInvoiceAmount retrieved prices');

  const total = prices.reduce((acc, pr) => {
    const product = products.find((product) => product.priceId === pr.id);
    logger.debug({product}, 'calculating price for line item');
    if (pr.billing_scheme === 'per_unit') {
      const lineItemCost = pr.unit_amount * product.quantity;
      logger.debug(`per-unit pricing: ${product.quantity} * ${pr.unit_amount} = ${lineItemCost} usd`);
      return acc + lineItemCost;
    }
    else if (pr.billing_scheme === 'tiered') {
      const tier = pr.tiers.find((t) => product.quantity <= t.up_to || t.up_to === null);
      if (typeof tier.flat_amount === 'number') {
        const lineItemCost = tier.flat_amount;
        logger.debug({tier}, `tiered pricing, flat amount: ${product.quantity} = ${lineItemCost} usd`);
        return acc + lineItemCost;
      }
      else {
        const lineItemCost = tier.unit_amount * product.quantity;
        logger.debug({tier},
          `tiered pricing, per-unit based: ${product.quantity} * ${tier.unit_amount} = ${lineItemCost} usd`);
        return acc + (tier.unit_amount * product.quantity);
      }
    }
    else {
      // TODO: handle volume pricing
      assert(false, `calculateInvoiceAmount: billing_scheme ${pr.billing_scheme} not implemented!!`);
    }

  }, 0);
  logger.debug(`calculateInvoiceAmount total cost ${total}`);
  return {amount: total, currency: prices[0].currency};
};

const createPaymentIntent = async(logger,
  {account_sid, stripe_customer_id, amount, email, currency, stripe_payment_method_id}) => {
  const obj = {
    amount,
    currency,
    customer: stripe_customer_id,
    payment_method: stripe_payment_method_id,
    receipt_email: email,
    metadata: {
      account_sid
    },
    setup_future_usage: 'off_session'
  };
  const result = await postForm('/payment_intents', formurlencoded(obj));
  return JSON.parse(result);
};

module.exports = {
  listProducts,
  listPrices,
  createCustomer,
  retrieveCustomer,
  updateCustomer,
  deleteCustomer,
  createSubscription,
  retrieveSubscription,
  cancelSubscription,
  updateSubscription,
  retrievePaymentMethod,
  calculateInvoiceAmount,
  createPaymentIntent,
  attachPaymentMethod,
  detachPaymentMethod,
  retrieveUpcomingInvoice,
  payOutstandingInvoicesForCustomer,
  retrieveInvoice,
  retrieveProduct,
  retrievePricesForProduct
};
