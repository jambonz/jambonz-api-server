const Model = require('./model');
const {getMysqlConnection} = require('../db');
const { promisePool } = require('../db');

const retrieveSql = `SELECT * from applications app
LEFT JOIN webhooks AS ch
ON app.call_hook_sid = ch.webhook_sid
LEFT JOIN webhooks AS sh
ON app.call_status_hook_sid = sh.webhook_sid 
LEFT JOIN webhooks AS mh
ON app.messaging_hook_sid = mh.webhook_sid`;

const retrieveAllSqlCount = `SELECT COUNT(*) as total_items
FROM applications app
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

  /**
   * list all applications - for all service providers, for one service provider, or for one account
   */
  static retrieveAll(service_provider_sid, account_sid) {
    let sql = retrieveSql;
    const args = [];
    if (account_sid) {
      sql = `${sql} WHERE app.account_sid = ?`;
      args.push(account_sid);
    }
    else if (service_provider_sid) {
      sql = `${sql} WHERE account_sid in (SELECT account_sid from accounts WHERE service_provider_sid = ?)`;
      args.push(service_provider_sid);
    }
    return this.wrapPromise(sql, args);
  }

  static async retrieveAllPaginated(service_provider_sid, account_sid, limit, page) {
    const offset = (page - 1) * limit;

    const args = [];
    let sql = retrieveSql;
    let sqlCount = retrieveAllSqlCount;

    if (account_sid) {
      sql = `${sql} WHERE app.account_sid = ?`;
      sqlCount = `${sqlCount} WHERE app.account_sid = ?`;
      args.push(account_sid);

    } else if (service_provider_sid) {
      sql = `${sql} WHERE account_sid in (SELECT account_sid from accounts WHERE service_provider_sid = ?)`;
      sqlCount = `${sqlCount} WHERE account_sid in (SELECT account_sid from accounts WHERE service_provider_sid = ?)`;
      args.push(service_provider_sid);
    }

    const [row] = await promisePool.query(sqlCount, args);
    const [{total_items = 0}] = row;
    const total_pages = Math.ceil(total_items  / limit) || 1;

    sql = `${sql} LIMIT ? OFFSET ?`;
    args.push(limit, offset);
    const data = await this.wrapPromise(sql, args);

    return {
      total_items,
      total_pages,
      page,
      data,
    };
  }

  static wrapPromise(sql, args) {
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
    return this.wrapPromise(sql, args);
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
