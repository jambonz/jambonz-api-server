const {promisePool} = require('../db');

class PasswordSettings {

  /**
   * Retrieve object from database
   */
  static async retrieve() {
    const [r] = await promisePool.execute(`SELECT * FROM ${this.table}`);
    return r;
  }

  /**
  * Update object into the database
  */
  static async update(obj) {
    let sql = `UPDATE ${this.table} SET `;
    const values = [];
    const keys = Object.keys(obj);
    this.fields.forEach(({name}) => {
      if (keys.includes(name)) {
        sql = sql + `${name} = ?,`;
        values.push(obj[name]);
      }
    });
    if (values.length) {
      sql = sql.slice(0, -1);
      await promisePool.execute(sql, values);
    }
  }

  /**
     * insert object into the database
     */
  static async make(obj) {
    let params = '', marks = '';
    const values = [];
    const keys = Object.keys(obj);
    this.fields.forEach(({name}) => {
      if (keys.includes(name)) {
        params = params + `${name},`;
        marks = marks + '?,';
        values.push(obj[name]);
      }
    });
    if (values.length) {
      params = `(${params.slice(0, -1)})`;
      marks = `values(${marks.slice(0, -1)})`;
      return await promisePool.execute(`INSERT into ${this.table} ${params} ${marks}`, values);
    }
  }
}


PasswordSettings.table = 'password_settings';
PasswordSettings.fields = [
  {
    name: 'min_password_length',
    type: 'number'
  },
  {
    name: 'require_digit',
    type: 'number'
  },
  {
    name: 'require_special_character',
    type: 'number'
  }
];
module.exports = PasswordSettings;
