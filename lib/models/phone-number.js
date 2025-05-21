const Model = require('./model');
const {promisePool} = require('../db');
const sqlRetrieveAll = 'SELECT * from phone_numbers WHERE account_sid = ? ORDER BY number';
const sqlRetrieveOne = 'SELECT * from phone_numbers WHERE phone_number_sid = ? AND account_sid = ? ORDER BY number';
const sqlSP = `SELECT * 
FROM phone_numbers 
WHERE account_sid IN 
(
  SELECT account_sid 
  FROM accounts 
  WHERE service_provider_sid = ?
) ORDER BY number`;

class PhoneNumber extends Model {
  constructor() {
    super();
  }

  static async retrieveAll(account_sid) {
    if (!account_sid) return await super.retrieveAll();
    const [rows] = await promisePool.query(sqlRetrieveAll, account_sid);
    return rows;
  }
  static async retrieveAllForSP(service_provider_sid) {
    const [rows] = await promisePool.query(sqlSP, service_provider_sid);
    return rows;
  }

  static _criteriaBuilder(obj, params) {
    let sql = '';
    if (obj.service_provider_sid) {
      sql += ' AND account_sid IN (SELECT account_sid FROM accounts WHERE service_provider_sid = ?)';
      params.push(obj.service_provider_sid);
    }
    if (obj.account_sid) {
      sql += ' AND account_sid = ?';
      params.push(obj.account_sid);
    }
    if (obj.filter) {
      sql += ' AND number LIKE ?';
      params.push(`%${obj.filter}%`);
    }

    return sql;
  }

  static async countAll(obj) {
    let sql = 'SELECT COUNT(*) AS count FROM phone_numbers WHERE 1 = 1';
    const args = [];
    sql += PhoneNumber._criteriaBuilder(obj, args);
    const [rows] = await promisePool.query(sql, args);
    return rows[0].count;
  }

  static async retrieveAllByCriteria(obj) {
    let sql = 'SELECT * FROM phone_numbers WHERE 1=1';
    const params = [];
    sql += PhoneNumber._criteriaBuilder(obj, params);
    sql += ' ORDER BY number';
    const [rows] = await promisePool.query(sql, params);
    return rows;
  }

  /**
   * retrieve a phone number
   */
  static async retrieve(sid, account_sid) {
    if (!account_sid) return super.retrieve(sid);
    const [rows] = await promisePool.query(sqlRetrieveOne, [sid, account_sid]);
    return rows;
  }
}

PhoneNumber.table = 'phone_numbers';
PhoneNumber.fields = [
  {
    name: 'phone_number_sid',
    type: 'string',
    primaryKey: true
  },
  {
    name: 'number',
    type: 'string',
    required: true
  },
  {
    name: 'voip_carrier_sid',
    type: 'string'
  },
  {
    name: 'account_sid',
    type: 'string',
  },
  {
    name: 'application_sid',
    type: 'string',
  }
];

module.exports = PhoneNumber;
