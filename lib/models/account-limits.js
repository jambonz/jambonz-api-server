const Model = require('./model');

class AccountLimits extends Model {
  constructor() {
    super();
  }
}

AccountLimits.table = 'account_limits';
AccountLimits.fields = [
  {
    name: 'account_limits_sid',
    type: 'string',
    primaryKey: true
  },
  {
    name: 'account_sid',
    type: 'string',
    required: true
  },
  {
    name: 'category',
    type: 'string',
    required: true
  },
  {
    name: 'quantity',
    type: 'number',
    required: true
  }
];

module.exports = AccountLimits;
