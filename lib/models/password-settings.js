const Model = require('./model');
const {promisePool} = require('../db');
const sql = 'SELECT * FROM password_settings WHERE account_sid = ?';
const delete_sql = 'DELETE FROM password_settings WHERE account_sid = ?';

class PasswordSettings extends Model {
  constructor() {
    super();
  }

  static async retrieve(account_sid) {
    const [rows] = await promisePool.query(sql, [account_sid]);
    return rows;
  }

  static async delete(account_sid) {
    await promisePool.execute(delete_sql, [account_sid]);
  }
}

PasswordSettings.table = 'password_settings';
PasswordSettings.fields = [
  {
    name: 'password_settings_sid',
    type: 'string',
    primaryKey: true
  },
  {
    name: 'account_sid',
    type: 'string',
    required: true
  },
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
