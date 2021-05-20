const router = require('express').Router();
const Product = require('../../models/product');
const {promisePool} = require('../../db');
const sysError = require('../error');
const sqlRetrieveSpecialOffers = `SELECT *
FROM account_offers offer
LEFT JOIN products AS product ON product.product_sid = offer.product_sid 
WHERE offer.account_sid = ?`;

const combineProductAndPrice = (localProducts, product, prices) => {
  const lp = localProducts.find((lp) => lp.category === product.metadata.jambonz_category);
  return {
    product_sid: lp.product_sid,
    name: lp.name,
    category: lp.category,
    stripe_product_id: product.id,
    description: product.description,
    unit_label: product.unit_label,
    prices: prices.map((price) => {
      return {
        stripe_price_id: price.id,
        billing_scheme: price.billing_scheme,
        currency: price.currency,
        recurring: price.recurring,
        tiers_mode: price.tiers_mode,
        tiers: price.tiers,
        type: price.type,
        unit_amount: price.unit_amount,
        unit_amount_decimal: price.unit_amount_decimal
      };
    })
  };
};


/* list */
router.get('/', async(req, res) => {
  const logger = req.app.locals.logger;
  const {account_sid} = req.user || {};
  const {listProducts, retrieveProduct, retrievePricesForProduct} = require('../../utils/stripe-utils');
  try {
    const localProducts = await Product.retrieveAll();

    /**
     * If this request is for a specific account (we have an account_sid)
     * then check to see if we have any special offers for this account
     */
    const selectedProducts = [];
    if (account_sid) {
      const [r] = await promisePool.query({sql: sqlRetrieveSpecialOffers, nestTables: true}, account_sid);
      logger.debug({r}, `retrieved special offer ids for account_sid ${account_sid}`);

      if (r.length > 0) {
        /* retrieve all the offers for this account */
        const products = await Promise.all(r.map((row) => retrieveProduct(logger, row.offer.stripe_product_id)));
        logger.debug({products}, `retrieved special offer products for account_sid ${account_sid}`);
        const prices = await Promise.all(products.map((prod) => retrievePricesForProduct(logger, prod.id)));
        logger.debug({prices}, `retrieved special offer prices for account_sid ${account_sid}`);

        for (let i = 0; i < products.length; i++) {
          selectedProducts.push(combineProductAndPrice(localProducts, products[i], prices[i].data));
        }
      }
    }

    /**
     * we must return at least pricing for sessions and devices, so find and use
     * the general pricing if no account-specific product was specified for these
     */
    const haveSessionPricing = selectedProducts.find((prod) => prod.category === 'voice_call_session');
    const haveDevicePricing = selectedProducts.find((prod) => prod.category === 'device');

    if (haveSessionPricing && haveDevicePricing) {
      logger.debug({selectedProducts}, 'found account level offers for sessions and devices');
      return res.status(200).json(selectedProducts);
    }

    /* need to get default pricing */
    const allProducts = await listProducts(logger);
    logger.debug({allProducts}, 'retrieved all products');
    const defaultProducts = allProducts.data.filter((prod) =>
      ['voice_call_session', 'device'].includes(prod.metadata.jambonz_category) &&
      'general' === prod.metadata.availability);
    logger.debug({defaultProducts}, 'default products');

    if (!haveSessionPricing) {
      const product = defaultProducts.find((prod) => 'voice_call_session' === prod.metadata.jambonz_category);
      if (product) {
        logger.debug(`retrieving prices for product id ${product.id}`);
        const prices = await retrievePricesForProduct(logger, product.id);
        selectedProducts.push(combineProductAndPrice(localProducts, product, prices.data));
      }
    }
    if (!haveDevicePricing) {
      const product = defaultProducts.find((prod) => 'device' === prod.metadata.jambonz_category);
      if (product) {
        logger.debug(`retrieving prices for product id ${product.id}`);
        const prices = await retrievePricesForProduct(logger, product.id);
        selectedProducts.push(combineProductAndPrice(localProducts, product, prices.data));
      }
    }
    res.status(200).json(selectedProducts);
  } catch (err) {
    sysError(logger, res, err);
  }
});

module.exports = router;
