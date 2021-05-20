const assert = require('assert');
const router = require('express').Router();
const Product = require('../../models/product');
const {listProducts, listPrices} = require('../../utils/stripe-utils');
const sysError = require('./error');

/* list */
router.get('/', async(req, res) => {
  const logger = req.app.locals.logger;
  try {
    const [stripeProducts, localProducts] = await Promise.all([listProducts(), Product.retrieveAll()]);
    console.log(stripeProducts);
    console.log(localProducts);
    const arr = localProducts.map((p) => {
      const stripe = stripeProducts.data
        .find((s) => s.metadata.jambonz_category === p.category);
      assert.ok(stripe, `No stripe product found for category ${p.category}`);
      Object.assign(p, {
        stripe_product_id: stripe.id,
        statement_descriptor: stripe.statement_descriptor,
        description: stripe.description,
        unit_label: stripe.unit_label
      });
      return p;
    });
    res.status(200).json(arr);
  } catch (err) {
    sysError(logger, res, err);
  }
});

/* get */
router.get('/:sid', async(req, res) => {
  const logger = req.app.locals.logger;
  try {
    const [allPrices, results] = await Promise.all([listPrices(), Product.retrieve(req.params.sid)]);
    if (results.length === 0) return res.sendStatus(404);
    const product = results[0];
    const prices = allPrices.data
      .filter((p) => p.active && p.product.active)
      .filter((p) => p.product.metadata.jambonz_category === product.category);
    assert(prices.length > 0, `No pricing data found for product ${req.params.sid}`);
    const stripe = prices[0].product;
    Object.assign(product, {
      stripe_product_id: stripe.id,
      statement_descriptor: stripe.statement_descriptor,
      description: stripe.description,
      unit_label: stripe.unit_label
    });

    // get pricing
    Object.assign(product, {
      pricing: {
        billing_scheme: stripe.billing_scheme,
        type: prices[0].type
      }
    });

    product.pricing.fees = prices.map((price) => {
      const obj = {
        stripe_price_id: price.id,
        currency: price.currency,
        unit_amount: price.unit_amount,
        unit_amount_decimal: price.unit_amount_decimal
      };
      if (price.tiers) {
        obj.tiers = price.tiers;
        obj.tiers_mode = price.tiers_mode;
      }
      return obj;
    });
    res.status(200).json(product);
  } catch (err) {
    sysError(logger, res, err);
  }
});

module.exports = router;
