const Model = require('./model');
const {getMysqlConnection} = require('../db');

class Smpp extends Model {
  constructor() {
    super();
  }

  /**
  * list all SBCs either for a given service provider, or those not associated with a
  * service provider (i.e. community SBCs)
  */
  static retrieveAll(service_provider_sid) {
    const sql = service_provider_sid ?
      'SELECT * from smpp_addresses WHERE service_provider_sid = ?' :
      'SELECT * from smpp_addresses WHERE service_provider_sid IS NULL';
    const args = service_provider_sid ? [service_provider_sid] : [];

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

}

Smpp.table = 'smpp_addresses';
Smpp.fields = [
  {
    name: 'smpp_address_sid',
    type: 'string',
    primaryKey: true
  },
  {
    name: 'ipv4',
    type: 'string',
    required: true
  },
  {
    name: 'port',
    type: 'number'
  },
  {
    name: 'service_provider_sid',
    type: 'string'
  }
];

module.exports = Smpp;
