const Model = require('./model');
const {promisePool} = require('../db');
const sql = 'SELECT * FROM service_provider_limits WHERE service_provider_sid = ?';

class ServiceProviderLimits extends Model {
  constructor() {
    super();
  }
  static async retrieve(service_provider_sid) {
    const [rows] = await promisePool.query(sql, [service_provider_sid]);
    return rows;
  }
}

ServiceProviderLimits.table = 'service_provider_limits';
ServiceProviderLimits.fields = [
  {
    name: 'service_provider_limits_sid',
    type: 'string',
    primaryKey: true
  },
  {
    name: 'service_provider_sid',
    type: 'string',
    required: true
  },
  {
    name: 'category',
    type: 'string',
    required: true
  },
  {
    name: 'quantity',
    type: 'number',
    required: true
  }
];

module.exports = ServiceProviderLimits;
