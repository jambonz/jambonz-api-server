const Model = require('./model');
const {promisePool} = require('../db');

class Lcr extends Model {
  constructor() {
    super();
  }

  static async countAll() {
    const countSql = `SELECT COUNT(*) AS total_items FROM ${this.table}`;
    const [row] = await promisePool.query(countSql);
    const [{ total_items = 0 }] = row;
    return total_items;
  }

  static async retrieveAllPaginated(limit, page) {
    const offset = (page - 1) * limit;
    const data = await super.retrieveAllPaginated([limit, offset]);

    const total_items = await this.countAll();
    const total_pages = Math.ceil(total_items / limit) || 1;

    return {
      total_items,
      total_pages,
      page,
      data,
    };
  }

  static async retrieveAllByAccountSid(account_sid) {
    const sql = `SELECT * FROM ${this.table} WHERE account_sid = ?`;
    const [rows] = await promisePool.query(sql, account_sid);
    return rows;
  }

  static async countAcc(sid) {
    const countSql = `SELECT COUNT(*) AS total_items FROM ${this.table} WHERE account_sid = ?`;
    const [row] = await promisePool.query(countSql, [sid]);
    const [{ total_items = 0 }] = row;
    return total_items;
  }

  static async retrieveAllByAccountSidPaginated(sid, limit, page) {
    const offset = (page - 1) * limit;
    const sql = `SELECT * FROM ${this.table} WHERE account_sid = ? LIMIT ? OFFSET ?`;
    const [rows] = await promisePool.query(sql, [sid, limit, offset]);

    const total_items = await this.countAcc(sid);
    const total_pages = Math.ceil(total_items / limit) || 1;

    return {
      total_items,
      total_pages,
      page,
      data: rows,
    };
  }

  static async retrieveAllByServiceProviderSid(sid) {
    const sql = `SELECT * FROM ${this.table} WHERE service_provider_sid = ?`;
    const [rows] = await promisePool.query(sql, sid);
    return rows;
  }

  static async countSP(sid) {
    const countSql = `SELECT COUNT(*) AS total_items FROM ${this.table} WHERE service_provider_sid = ?`;
    const [row] = await promisePool.query(countSql, [sid]);
    const [{ total_items = 0 }] = row;
    return total_items;
  }

  static async retrieveAllByServiceProviderSidPaginated(sid, limit, page) {
    const offset = (page - 1) * limit;
    const sql = `SELECT * FROM ${this.table} WHERE account_sid = ? LIMIT ? OFFSET ?`;
    const [rows] = await promisePool.query(sql, [sid, limit, offset]);

    const total_items = await this.countSP(sid);
    const total_pages = Math.ceil(total_items / limit) || 1;

    return {
      total_items,
      total_pages,
      page,
      data: rows,
    };
  }

  static async releaseDefaultEntry(sid) {
    const sql = `UPDATE ${this.table} SET default_carrier_set_entry_sid = null WHERE lcr_sid = ?`;
    const [rows] = await promisePool.query(sql, sid);
    return rows;
  }
}

Lcr.table = 'lcr';
Lcr.fields = [
  {
    name: 'lcr_sid',
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
    type: 'string'
  },
  {
    name: 'service_provider_sid',
    type: 'string'
  },
  {
    name: 'default_carrier_set_entry_sid',
    type: 'string'
  }
];

module.exports = Lcr;
