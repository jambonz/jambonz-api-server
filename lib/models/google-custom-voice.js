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
    name: 'language',
    type: 'string',
    required: true
  },
  {
    name: 'voice',
    type: 'string'
  }
];

module.exports = GoogleCustomVoice;
