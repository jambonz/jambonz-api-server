const Model = require('./model');
const {promisePool} = require('../db');

class Lcr extends Model {
  constructor() {
    super();
  }

  static async retrieveAllByAccountSid(account_sid) {
    const sql = `SELECT * FROM ${this.table} WHERE account_sid = ?`;
    const [rows] = await promisePool.query(sql, account_sid);
    return rows;
  }

  static async retrieveAllByServiceProviderSid(sid) {
    const sql = `SELECT * FROM ${this.table} WHERE service_provider_sid = ?`;
    const [rows] = await promisePool.query(sql, sid);
    return rows;
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
