const Model = require('./model');
const {promisePool} = require('../db');

class GoogleCustomVoice extends Model {
  constructor() {
    super();
  }

  static async retrieveAllBySpeechCredentialSid(speech_credential_sid) {
    const sql = `SELECT * FROM ${this.table} WHERE speech_credential_sid = ?`;
    const [rows] = await promisePool.query(sql, speech_credential_sid);
    return rows;
  }

  static async deleteAllBySpeechCredentialSid(speech_credential_sid) {
    const sql = `DELETE FROM ${this.table} WHERE speech_credential_sid = ?`;
    const [rows] = await promisePool.query(sql, speech_credential_sid);
    return rows;
  }

  static async retrieveAllByLabel(service_provider_sid, account_sid, label) {
    let sql;
    if (account_sid) {
      sql = `SELECT gcv.* FROM ${this.table} gcv 
LEFT JOIN speech_credentials sc ON gcv.speech_credential_sid = sc.speech_credential_sid 
WHERE sc.account_sid = ? OR (sc.account_sid is NULL && sc.service_provider_sid = ?) ${label ? 'AND label = ?' : ''}`;
    } else {
      sql = `SELECT gcv.* FROM ${this.table} gcv 
LEFT JOIN speech_credentials sc ON gcv.speech_credential_sid = sc.speech_credential_sid 
WHERE sc.service_provider_sid = ? ${label ? 'AND label = ?' : ''}`;
    }
    const [rows] = await promisePool.query(sql, [...(account_sid ?
      [account_sid, service_provider_sid] : [service_provider_sid]), label]);
    return rows;
  }
}
GoogleCustomVoice.table = 'google_custom_voices';
GoogleCustomVoice.fields = [
  {
    name: 'google_custom_voice_sid',
    type: 'string',
    primaryKey: true
  },
  {
    name: 'model',
    type: 'string',
    required: true
  },
  {
    name: 'reported_usage',
    type: 'number'
  },
  {
    name: 'name',
    type: 'string',
    required: true
  }
];

module.exports = GoogleCustomVoice;
