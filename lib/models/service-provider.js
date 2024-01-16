const Model = require('./model');
const {getMysqlConnection, promisePool} = require('../db');

const retrieveSql = `SELECT * from service_providers sp
LEFT JOIN webhooks AS rh
ON sp.registration_hook_sid = rh.webhook_sid`;


function transmogrifyResults(results) {
  return results.map((row) => {
    const obj = row.sp;
    if (row.rh && Object.keys(row.rh).length && row.rh.url !== null) {
      Object.assign(obj, {registration_hook: row.rh});
      delete obj.registration_hook.webhook_sid;
    }
    else obj.registration_hook = null;
    delete obj.registration_hook_sid;
    return obj;
  });
}

class ServiceProvider extends Model {
  constructor() {
    super();
  }

  /**
   * list all service providers
   */
  static retrieveAll() {
    const sql = retrieveSql;
    return this.wrapPromise(sql);
  }

  static async wrapPromise(sql, args = []) {
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

  static async retrieveAllPaginated(limit, page) {
    const offset = (page - 1) * limit;

    const sql = `${retrieveSql} LIMIT ? OFFSET ?`;
    const data = await this.wrapPromise(sql, [limit, offset]);

    const countSql = 'SELECT COUNT(*) as total_items from service_providers sp';
    const [row] = await promisePool.query(countSql, []);
    const [{ total_items = 0 }] = row;
    const total_pages = Math.ceil(total_items / limit) || 1;

    return {
      total_items,
      total_pages,
      page,
      data,
    };
  }

  /**
   * retrieve a service provider
   */
  static retrieve(sid) {
    const args = [sid];
    const sql = `${retrieveSql} WHERE sp.service_provider_sid = ?`;
    return this.wrapPromise(sql, args);
  }
}

ServiceProvider.table = 'service_providers';
ServiceProvider.fields = [
  {
    name: 'service_provider_sid',
    type: 'string',
    primaryKey: true
  },
  {
    name: 'name',
    type: 'string',
    required: true
  },
  {
    name: 'description',
    type: 'string'
  },
  {
    name: 'root_domain',
    type: 'string',
  },
  {
    name: 'registration_hook_sid',
    type: 'string',
  },
  {
    name: 'ms_teams_fqdn',
    type: 'string',
  },
  {
    name: 'lcr_sid',
    type: 'string'
  }

];

module.exports = ServiceProvider;
