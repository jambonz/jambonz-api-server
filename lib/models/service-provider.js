const Emitter = require('events');
const {getMysqlConnection} = require('../db');
const scrubIds = require('../utils/scrub-ids');

class ServiceProvider extends Emitter {
  constructor() {
    super();
  }

  static retrieveAll() {
    return new Promise((resolve, reject) => {
      getMysqlConnection((err, conn) => {
        if (err) return reject(err);
        conn.query('SELECT * from service_providers', (err, results, fields) => {
          if (err) return reject(err);
          resolve(scrubIds(results));
        });
      });
    });
  }
}

module.exports = ServiceProvider;
