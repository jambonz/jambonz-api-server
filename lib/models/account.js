const Model = require('./model');
const {getMysqlConnection} = require('../db');

const retrieveSql = `SELECT * from accounts acc
LEFT JOIN webhooks AS rh
ON acc.registration_hook_sid = rh.webhook_sid
LEFT JOIN webhooks AS dh
ON acc.device_calling_hook_sid = dh.webhook_sid
LEFT JOIN webhooks AS eh
ON acc.error_hook_sid = eh.webhook_sid`;

function transmogrifyResults(results) {
  return results.map((row) => {
    const obj = row.acc;
    if (row.rh && Object.keys(row.rh).length && row.rh.url !== null) {
      Object.assign(obj, {registration_hook: row.rh});
    }
    else obj.registration_hook = null;
    if (row.dh && Object.keys(row.dh).length && row.dh.url !== null) {
      Object.assign(obj, {device_calling_hook: row.dh});
    }
    else obj.device_calling_hook = null;
    if (row.eh && Object.keys(row.eh).length && row.eh.url !== null) {
      Object.assign(obj, {error_hook: row.eh});
    }
    else obj.error_hook = null;
    delete obj.registration_hook_sid;
    delete obj.device_calling_hook_sid;
    delete obj.error_hook_sid;
    return obj;
  });
}

class Account extends Model {
  constructor() {
    super();
  }

  /**
   * list all accounts
   */
  static retrieveAll(service_provider_sid, account_sid) {
    let sql = retrieveSql;
    const args = [];
    if (account_sid) {
      sql = `${sql} WHERE acc.account_sid = ?`;
      args.push(account_sid);
    }
    else if (service_provider_sid) {
      sql = `${sql} WHERE acc.service_provider_sid = ?`;
      args.push(service_provider_sid);
    }
    return new Promise((resolve, reject) => {
      getMysqlConnection((err, conn) => {
        if (err) return reject(err);
        conn.query({sql, nestTables: true}, args, (err, results, fields) => {
          conn.release();
          if (err) return reject(err);
          const r = transmogrifyResults(results);
          resolve(r);
        });
      });
    });
  }

  /**
   * retrieve an account
   */
  static retrieve(sid, service_provider_sid) {
    const args = [sid];
    let sql = `${retrieveSql} WHERE acc.account_sid = ?`;
    if (service_provider_sid) {
      sql = `${retrieveSql} WHERE acc.account_sid = ? AND acc.service_provider_sid = ?`;
      args.push(service_provider_sid);
    }
    return new Promise((resolve, reject) => {
      getMysqlConnection((err, conn) => {
        if (err) return reject(err);
        conn.query({sql, nestTables: true}, args, (err, results, fields) => {
          conn.release();
          if (err) return reject(err);
          const r = transmogrifyResults(results);
          resolve(r);
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
    name: 'registration_hook_sid',
    type: 'string',
  },
  {
    name: 'device_calling_hook_sid',
    type: 'string',
  },
  {
    name: 'error_hook_sid',
    type: 'string',
  }
];

module.exports = Account;
