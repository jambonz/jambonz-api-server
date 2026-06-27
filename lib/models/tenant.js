const Model = require('./model');
const {promisePool} = require('../db');

class MsTeamsTenant extends Model {
  constructor() {
    super();
  }

  static async retrieveAll(account_sid) {
    if (account_sid) {
      const sql = `SELECT * FROM ${this.table} WHERE account_sid = ?`;
      const [rows] = await promisePool.query(sql, account_sid);
      return rows;
    }
    const sql = `SELECT * FROM ${this.table}`;
    const [rows] = await promisePool.query(sql);
    return rows;
  }

  static async retrieveAllByServiceProviderSid(service_provider_sid) {
    const sql = `SELECT * FROM ${this.table} WHERE service_provider_sid = ?`;
    const [rows] = await promisePool.query(sql, service_provider_sid);
    return rows;
  }
}

MsTeamsTenant.table = 'ms_teams_tenants';
MsTeamsTenant.fields = [
  {
    name: 'ms_teams_tenant_sid',
    type: 'string',
    primaryKey: true
  },
  {
    name: 'service_provider_sid',
    type: 'string',
    required: true
  },
  {
    name: 'account_sid',
    type: 'string',
    required: true
  },
  {
    name: 'application_sid',
    type: 'string'
  },
  {
    name: 'tenant_fqdn',
    type: 'string',
    required: true
  }
];

module.exports = MsTeamsTenant;
