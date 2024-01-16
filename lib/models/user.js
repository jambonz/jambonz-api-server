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
const sqlCountSP = 'SELECT COUNT(*) AS total_items from users WHERE service_provider_sid = ?';
const sqlCountAcc = 'SELECT COUNT(*) AS total_items from users WHERE account_sid = ?';
const sqlCount = 'SELECT COUNT(*) AS total_items from users';


class User extends Model {
  constructor() {
    super();
  }

  static async retrieveAll() {
    const [rows] = await promisePool.query(sqlAll);
    return rows;
  }

  static async retrieveAllPaginated(limit, page) {
    const offset = (page - 1) * limit;
    const [row] = await promisePool.query(sqlCount);
    const [{total_items = 0}] = row;
    const total_pages = Math.ceil(total_items / limit) || 1;

    const sql = `${sqlAll} LIMIT ? OFFSET ?`;
    const args = [limit, offset];
    const [data] = await promisePool.query(sql, args);

    return {
      total_items,
      total_pages,
      page,
      data
    };
  }


  static async retrieveAllForAccount(account_sid) {
    const [rows] = await promisePool.query(sqlAccount, [account_sid]);
    return rows;
  }

  static async retrieveAllForAccountPaginated(account_sid, limit, page) {
    const offset = (page - 1) * limit;
    const [row] = await promisePool.query(sqlCountAcc, [account_sid]);
    const [{total_items = 0}] = row;
    const total_pages = Math.ceil(total_items / limit) || 1;

    const sql = `${sqlAccount} LIMIT ? OFFSET ?`;
    const args = [account_sid, limit, offset];
    const [data] = await promisePool.query(sql, args);

    return {
      total_items,
      total_pages,
      page,
      data
    };
  }

  static async retrieveAllForServiceProvider(service_provider_sid) {
    const [rows] = await promisePool.query(sqlSP, [service_provider_sid]);
    return rows;
  }

  static async retrieveAllForServiceProviderPaginated(service_provider_sid, limit, page) {
    const offset = (page - 1) * limit;
    const [{total_items}] = await promisePool.query(sqlCountSP, [service_provider_sid]);
    const total_pages = Math.ceil(total_items / limit) || 1;

    const sql = `${sqlSP} LIMIT ? OFFSET ?`;
    const args = [service_provider_sid, limit, offset];
    const [data] = await promisePool.query(sql, args);

    return {
      total_items,
      total_pages,
      page,
      data
    };
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
