const Model = require('./model');
const {promisePool} = require('../db');

class LlmCredential extends Model {
  constructor() {
    super();
  }

  static async retrieveAll(account_sid) {
    const [rows] = await promisePool.query('SELECT * from llm_credentials WHERE account_sid = ?', [account_sid]);
    return rows;
  }

  static async retrieveAllForSP(service_provider_sid) {
    const [rows] = await promisePool.query(`SELECT * from llm_credentials WHERE service_provider_sid = ? 
      AND account_sid IS NULL`, [service_provider_sid]);
    return rows;
  }

  static async getLlmCredentialsByVendorAndLabel(service_provider_sid, account_sid, vendor, label) {
    let sql;
    let rows = [];
    if (account_sid) {
      sql = `SELECT * FROM llm_credentials WHERE account_sid = ? AND vendor = ?
        AND label ${label ? '= ?' : 'is NULL'}`;
      [rows] = await promisePool.query(sql, [account_sid, vendor, label]);
    }
    if (rows.length === 0) {
      sql = `SELECT * FROM llm_credentials WHERE service_provider_sid = ? AND vendor = ?
        AND label ${label ? '= ?' : 'is NULL'}`;
      [rows] = await promisePool.query(sql, [service_provider_sid, vendor, label]);
    }
    return rows;
  }

  static async testResult(sid, success) {
    await promisePool.execute(
      'UPDATE llm_credentials SET tested_ok = ? WHERE llm_credential_sid = ?',
      [success, sid]);
  }
}

LlmCredential.table = 'llm_credentials';
LlmCredential.fields = [
  {
    name: 'llm_credential_sid',
    type: 'string',
    primaryKey: true
  },
  {
    name: 'account_sid',
    type: 'string',
  },
  {
    name: 'service_provider_sid',
    type: 'string',
  },
  {
    name: 'vendor',
    type: 'string',
    required: true,
  },
  {
    name: 'credential',
    type: 'string',
  },
  {
    name: 'tested_ok',
    type: 'number'
  },
  {
    name: 'label',
    type: 'string'
  }
];

module.exports = LlmCredential;
