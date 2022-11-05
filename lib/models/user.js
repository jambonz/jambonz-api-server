const Model = require('./model');
const {promisePool} = require('../db');
const sqlAccount = 'SELECT * FROM users WHERE account_sid = ?';
const sqlSP = 'SELECT * FROM users WHERE service_provider_sid = ?';

class User extends Model {
  constructor() {
    super();
  }

  static async retrieveAllForAccount(account_sid) {
    const [rows] = await promisePool.query(sqlAccount, [account_sid]);
    return rows;
  }

  static async retrieveAllForServiceProvider(service_provider_sid) {
    const [rows] = await promisePool.query(sqlSP, [service_provider_sid]);
    return rows;
  }
}

User.table = 'users';
User.fields = [
  {
    name: 'user_sid',
    type: 'string',
    primaryKey: true
  },
  {
    name: 'name',
    type: 'string',
    required: true
  },
  {
    name: 'email',
    type: 'string',
    required: true
  },
  {
    name: 'pending_email',
    type: 'string'
  },
  {
    name: 'phone',
    type: 'string'
  },
  {
    name: 'hashed_password',
    type: 'string'
  },
  {
    name: 'account_sid',
    type: 'string'
  },
  {
    name: 'service_provider_sid',
    type: 'string'
  },
  {
    name: 'force_change',
    type: 'number'
  },
  {
    name: 'provider',
    type: 'string'
  },
  {
    name: 'provider_userid',
    type: 'string'
  },
  {
    name: 'email_activation_code',
    type: 'string'
  },
  {
    name: 'email_validated',
    type: 'number'
  },
  {
    name: 'is_active',
    type: 'number'
  },
];

module.exports = User;
