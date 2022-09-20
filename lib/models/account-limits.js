const Model = require('./model');
const {promisePool} = require('../db');
const sql = 'SELECT * FROM account_limits WHERE account_sid = ?';

class AccountLimits extends Model {
  constructor() {
    super();
  }

  static async retrieve(account_sid) {
    const [rows] = await promisePool.query(sql, [account_sid]);
    return rows;
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
