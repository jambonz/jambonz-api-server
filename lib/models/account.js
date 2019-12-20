const Model = require('./model');
const {getMysqlConnection} = require('../db');
const listSqlSp = 'SELECT * from accounts WHERE service_provider_sid = ?';
const listSqlAccount = 'SELECT * from accounts WHERE account_sid = ?';
const retrieveSql = 'SELECT * from accounts WHERE service_provider_sid = ? AND account_sid = ?';

class Account extends Model {
  constructor() {
    super();
  }

  /**
   * list all accounts
   */
  static retrieveAll(service_provider_sid, account_sid) {
    if (!service_provider_sid && !account_sid) return super.retrieveAll();
    return new Promise((resolve, reject) => {
      getMysqlConnection((err, conn) => {
        if (err) return reject(err);
        const sql = account_sid ? listSqlAccount : listSqlSp;
        const args = account_sid ? [account_sid] : [service_provider_sid];
        conn.query(sql, args, (err, results, fields) => {
          conn.release();
          if (err) return reject(err);
          resolve(results);
        });
      });
    });
  }

  /**
   * retrieve an account
   */
  static retrieve(sid, service_provider_sid) {
    if (!service_provider_sid) return super.retrieve(sid);
    return new Promise((resolve, reject) => {
      getMysqlConnection((err, conn) => {
        if (err) return reject(err);
        conn.query(retrieveSql, [service_provider_sid, sid], (err, results, fields) => {
          conn.release();
          if (err) return reject(err);
          resolve(results);
        });
      });
    });
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
    name: 'registration_hook',
    type: 'string',
  },
  {
    name: 'hook_basic_auth_user',
    type: 'string',
  },
  {
    name: 'hook_basic_auth_password',
    type: 'string',
  }
];

module.exports = Account;
