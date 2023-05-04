const Model = require('./model');
const { promisePool } = require('../db');
class SystemInformation extends Model {
  constructor() {
    super();
  }

  static async add(body) {
    let [sysInfo] = await this.retrieveAll();
    if (sysInfo) {
      const sql = `UPDATE ${this.table} SET ?`;
      await promisePool.query(sql, body);
    } else {
      const sql = `INSERT INTO ${this.table} SET ?`;
      await promisePool.query(sql, body);
    }
    [sysInfo] = await this.retrieveAll();
    return sysInfo;
  }
}

SystemInformation.table = 'system_information';
SystemInformation.fields = [
  {
    name: 'domain_name',
    type: 'string',
  },
  {
    name: 'sip_domain_name',
    type: 'string',
  },
  {
    name: 'monitoring_domain_name',
    type: 'string',
  },
];

module.exports = SystemInformation;
