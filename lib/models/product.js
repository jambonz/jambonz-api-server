const Model = require('./model');

class Product extends Model {
  constructor() {
    super();
  }
}

Product.table = 'products';
Product.fields = [
  {
    name: 'product_sid',
    type: 'string',
    primaryKey: true
  },
  {
    name: 'name',
    type: 'string',
    required: true
  },
  {
    name: 'category',
    type: 'string',
    required: true
  },
];

module.exports = Product;
