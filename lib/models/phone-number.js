const Model = require('./model');
const {promisePool} = require('../db');
const sql = 'SELECT * from phone_numbers WHERE account_sid = ? ORDER BY number';
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
    const [rows] = await promisePool.query(sql, account_sid);
    return rows;
  }
  static async retrieveAllForSP(service_provider_sid) {
    const [rows] = await promisePool.query(sqlSP, service_provider_sid);
    return rows;
  }

  /**
   * retrieve a phone number
   */
  static async retrieve(sid, account_sid) {
    if (!account_sid) return super.retrieve(sid);
    const [rows] = await promisePool.query(`${sql} AND phone_number_sid = ?`, [account_sid, sid]);
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
