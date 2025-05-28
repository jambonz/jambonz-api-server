const Model = require('./model');
const {getMysqlConnection} = require('../db');

const retrieveSql = `SELECT * from applications app
LEFT JOIN webhooks AS ch
ON app.call_hook_sid = ch.webhook_sid
LEFT JOIN webhooks AS sh
ON app.call_status_hook_sid = sh.webhook_sid 
LEFT JOIN webhooks AS mh
ON app.messaging_hook_sid = mh.webhook_sid`;

function transmogrifyResults(results) {
  return results.map((row) => {
    const obj = row.app;
    if (row.ch && Object.keys(row.ch).length && row.ch.url !== null) {
      Object.assign(obj, {call_hook: row.ch});
    }
    else obj.call_hook = null;
    if (row.sh && Object.keys(row.sh).length && row.sh.url !== null) {
      Object.assign(obj, {call_status_hook: row.sh});
    }
    else obj.call_status_hook = null;
    if (row.mh && Object.keys(row.mh).length && row.mh.url !== null) {
      Object.assign(obj, {messaging_hook: row.mh});
    }
    else obj.messaging_hook = null;
    delete obj.call_hook_sid;
    delete obj.call_status_hook_sid;
    delete obj.messaging_hook_sid;
    return obj;
  });
}

class Application extends Model {
  constructor() {
    super();
  }

  static _criteriaBuilder(obj, args) {
    let sql = '';
    if (obj.account_sid) {
      sql += ' AND app.account_sid = ?';
      args.push(obj.account_sid);
    }
    if (obj.service_provider_sid) {
      sql += ' AND app.account_sid in (SELECT account_sid from accounts WHERE service_provider_sid = ?)';
      args.push(obj.service_provider_sid);
    }
    if (obj.name) {
      sql += ' AND app.name LIKE ?';
      args.push(`%${obj.name}%`);
    }
    return sql;
  }

  static countAll(obj) {
    let sql = 'SELECT COUNT(*) AS count FROM applications app WHERE 1 = 1';
    const args = [];
    sql += Application._criteriaBuilder(obj, args);
    return new Promise((resolve, reject) => {
      getMysqlConnection((err, conn) => {
        if (err) return reject(err);
        conn.query({sql}, args, (err, results) => {
          conn.release();
          if (err) return reject(err);
          resolve(results[0].count);
        });
      });
    });
  }

  /**
   * list all applications - for all service providers, for one service provider, or for one account,
   * or by an optional name
   */
  static retrieveAll(obj) {
    const { page, page_size = 50 } = obj || {};
    let sql = retrieveSql + ' WHERE 1 = 1';
    const args = [];
    sql += Application._criteriaBuilder(obj, args);

    if (page !== null && page !== undefined) {
      const limit = Number(page_size);
      const offset = Number(page > 0 ? (page - 1) : page) * limit;
      sql += ' LIMIT ? OFFSET ?';
      args.push(limit);
      args.push(offset);
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
   * retrieve an application
   */
  static retrieve(sid, service_provider_sid, account_sid) {
    const args = [sid];
    let sql = `${retrieveSql} WHERE app.application_sid = ?`;
    if (account_sid) {
      sql = `${sql} AND app.account_sid = ?`;
      args.push(account_sid);
    }
    if (service_provider_sid) {
      sql = `${sql} AND account_sid in (SELECT account_sid from accounts WHERE service_provider_sid = ?)`;
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

Application.table = 'applications';
Application.fields = [
  {
    name: 'application_sid',
    type: 'string',
    primaryKey: true
  },
  {
    name: 'name',
    type: 'string',
    required: true
  },
  {
    name: 'account_sid',
    type: 'string',
    required: true
  },
  {
    name: 'call_hook_sid',
    type: 'string',
  },
  {
    name: 'call_status_hook_sid',
    type: 'string',
  },
  {
    name: 'messaging_hook_sid',
    type: 'string',
  },
  {
    name: 'record_all_calls',
    type: 'number',
  }
];

module.exports = Application;
