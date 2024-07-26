const Model = require('./model');
const {getMysqlConnection} = require('../db');

const sqlCountSP = 'SELECT COUNT(*) AS total_items from api_keys WHERE service_provider_sid = ?';
const sqlCountAcc = 'SELECT COUNT(*) AS total_items from api_keys WHERE account_sid = ?';

class ApiKey extends Model {
  constructor() {
    super();
  }

  /**
  * list all api keys for an account
  */
  static retrieveAll(account_sid) {
    const sql = account_sid ?
      'SELECT * from api_keys WHERE account_sid = ?' :
      'SELECT * from api_keys WHERE account_sid IS NULL';
    const args = account_sid ? [account_sid] : [];

    return this.wrapPromise(sql, args);
  }

  /**
    * list all api keys for an account paginated
    */
  static async retrieveAllPaginated(account_sid, limit, page) {
    const offset = (page - 1) * limit;

    const [{ total_items = 0 }] = await this.wrapPromise(sqlCountAcc, [account_sid]);
    const total_pages = Math.ceil(total_items / limit) || 1;

    const sql = 'SELECT * from api_keys WHERE account_sid = ? LIMIT ? OFFSET ?';
    const args = [account_sid, limit, offset];
    const data = await this.wrapPromise(sql, args);

    return {
      total_items,
      total_pages,
      page,
      data
    };
  }

  static wrapPromise(sql, args) {
    return new Promise((resolve, reject) => {
      getMysqlConnection((err, conn) => {
        if (err) return reject(err);
        conn.query(sql, args, (err, results) => {
          conn.release();
          if (err) return reject(err);
          resolve(results);
        });
      });
    });
  }

  /**
  * list all api keys for a service provider
  */
  static async retrieveAllForSP(service_provider_sid) {
    const sql = 'SELECT * from api_keys WHERE service_provider_sid = ?';
    const args = [service_provider_sid];
    return this.wrapPromise(sql, args);
  }

  /**
  * list all api keys for a service provider paginated
  */
  static async retrieveAllForSPPaginated(service_provider_sid, limit = 25, page = 1) {
    const offset = (page - 1) * limit;

    const [{total_items = 0}] = await this.wrapPromise(sqlCountSP, [service_provider_sid]);
    const total_pages = Math.ceil(total_items / limit) || 1;

    const sql = 'SELECT * from api_keys WHERE service_provider_sid = ? LIMIT ? OFFSET ?';
    const args = [service_provider_sid, limit, offset];
    const data = await this.wrapPromise(sql, args);

    return {
      total_items,
      total_pages,
      page,
      data
    };
  }

  /**
  * update last_used api key for an account
  */
  static updateLastUsed(account_sid) {
    const sql = 'UPDATE api_keys SET last_used = NOW() WHERE account_sid = ?';
    const args = [account_sid];

    return this.wrapPromise(sql, args);
  }
}


ApiKey.table = 'api_keys';
ApiKey.fields = [
  {
    name: 'api_key_sid',
    type: 'string',
    primaryKey: true
  },
  {
    name: 'token',
    type: 'string',
    required: true
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
    name: 'expires_at',
    type: 'date'
  },
  {
    name: 'created_at',
    type: 'date'
  },
  {
    name: 'last_used',
    type: 'date'
  }
];

module.exports = ApiKey;
