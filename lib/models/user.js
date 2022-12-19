const Model = require('./model');
const {promisePool} = require('../db');
const sqlAll = `
SELECT u.user_sid, u.name, u.email, u.account_sid, u.service_provider_sid, u.is_active, 
u.force_change, u.phone, u.pending_email, u.provider, u.provider_userid, 
u.email_activation_code, u.email_validated, 
sp.name as service_provider_name, acc.name as account_name  
FROM users u   
LEFT JOIN service_providers as sp ON u.service_provider_sid = sp.service_provider_sid 
LEFT JOIN accounts acc ON u.account_sid = acc.account_sid  
`;
const sqlAccount = `
SELECT u.user_sid, u.name, u.email, u.account_sid, u.service_provider_sid, u.is_active, 
u.force_change, u.phone, u.pending_email, u.provider, u.provider_userid, 
u.email_activation_code, u.email_validated, 
sp.name as service_provider_name, acc.name as account_name  
FROM users u   
LEFT JOIN service_providers as sp ON u.service_provider_sid = sp.service_provider_sid 
LEFT JOIN accounts acc ON u.account_sid = acc.account_sid  
WHERE u.account_sid = ? 
`;
const sqlSP = `
SELECT u.user_sid, u.name, u.email, u.account_sid, u.service_provider_sid, u.is_active, 
u.force_change, u.phone, u.pending_email, u.provider, u.provider_userid, 
u.email_activation_code, u.email_validated, 
sp.name as service_provider_name, acc.name as account_name  
FROM users u   
LEFT JOIN service_providers as sp ON u.service_provider_sid = sp.service_provider_sid 
LEFT JOIN accounts acc ON u.account_sid = acc.account_sid  
WHERE u.service_provider_sid = ? 
`;

class User extends Model {
  constructor() {
    super();
  }

  static async retrieveAll() {
    const [rows] = await promisePool.query(sqlAll);
    return rows;
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
