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
const retrieveSqlCount = `SELECT COUNT(*) AS total_items 
FROM phone_numbers pn`;

const retrieveSqlCountForAcc = `SELECT COUNT(*) AS total_items 
FROM phone_numbers pn 
WHERE pn.account_sid = ?`;

const retrieveSqlCountForSP = `SELECT COUNT(*) as total_items 
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

  static async retrieveAllPaginated(account_sid, limit, page) {
    const offset = (page - 1) * limit;
    let data;
    const countArgs = [];
    let countSql;
    if (!account_sid) {
      data = await super.retrieveAllPaginated([limit, offset]);
      countSql = retrieveSqlCount;
    } else {
      countSql = retrieveSqlCountForAcc;
      countArgs.push(account_sid);
      const sql = `${sqlRetrieveAll} LIMIT ? OFFSET ?`;
      const [rows] = await promisePool.query(sql, [account_sid, limit, offset]);
      data = rows;
    }

    const [row] = await promisePool.query(countSql, countArgs);
    const [{ total_items = 0 }] = row;
    const total_pages = Math.ceil(total_items / limit) || 1;

    return {
      total_items,
      total_pages,
      page,
      data,
    };
  }

  static async retrieveAllForSP(service_provider_sid) {
    const [rows] = await promisePool.query(sqlSP, service_provider_sid);
    return rows;
  }


  static async retrieveAllForSPPaginated(service_provider_sid, limit, page) {
    const offset = (page - 1) * limit;
    let data;
    const countArgs = [];
    let countSql;
    if (!service_provider_sid) {
      data = await super.retrieveAllPaginated([limit, offset]);
      countSql = retrieveSqlCount;

    } else {
      countArgs.push(service_provider_sid);
      countSql = retrieveSqlCountForSP;
      const sql = `${sqlSP} LIMIT ? OFFSET ?`;
      const [rows] = await promisePool.query(sql, [service_provider_sid, limit, offset]);
      data = rows;
    }

    const [row] = await promisePool.query(countSql, countArgs);
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
