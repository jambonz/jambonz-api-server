const Model = require('./model');
const {promisePool} = require('../db');
const retrieveSql = 'SELECT * from speech_credentials WHERE account_sid = ?';
const retrieveSqlForSP = 'SELECT * from speech_credentials WHERE service_provider_sid = ? and account_sid is null';

class SpeechCredential extends Model {
  constructor() {
    super();
  }

  /**
   * list all credentials for an account
   */
  static async retrieveAll(account_sid) {
    const [rows] = await promisePool.query(retrieveSql, account_sid);
    return rows;
  }
  static async retrieveAllForSP(service_provider_sid) {
    const [rows] = await promisePool.query(retrieveSqlForSP, service_provider_sid);
    return rows;
  }

  static async getSpeechCredentialsByVendorAndLabel(service_provider_sid, account_sid, vendor, label) {
    let sql;
    let rows = [];
    if (account_sid) {
      sql = `SELECT * FROM speech_credentials WHERE account_sid = ? AND vendor = ?
        AND label ${label ? '= ?' : 'is NULL'}`;
      [rows] = await promisePool.query(sql, [account_sid, vendor, label]);
    }
    if (rows.length === 0) {
      sql = `SELECT * FROM speech_credentials WHERE service_provider_sid = ? AND vendor = ?
        AND label ${label ? '= ?' : 'is NULL'}`;
      [rows] = await promisePool.query(sql, [service_provider_sid, vendor, label]);
    }
    return rows;
  }

  static async disableStt(account_sid) {
    await promisePool.execute('UPDATE speech_credentials SET use_for_stt = 0 WHERE account_sid = ?', [account_sid]);
  }
  static async disableTts(account_sid) {
    await promisePool.execute('UPDATE speech_credentials SET use_for_tts = 0 WHERE account_sid = ?', [account_sid]);
  }

  static async ttsTestResult(sid, success) {
    await promisePool.execute(
      'UPDATE speech_credentials SET last_tested = NOW(), tts_tested_ok = ? WHERE speech_credential_sid = ?',
      [success, sid]);
  }
  static async sttTestResult(sid, success) {
    await promisePool.execute(
      'UPDATE speech_credentials SET last_tested = NOW(), stt_tested_ok = ? WHERE speech_credential_sid = ?',
      [success, sid]);
  }
}

SpeechCredential.table = 'speech_credentials';
SpeechCredential.fields = [
  {
    name: 'speech_credential_sid',
    type: 'string',
    primaryKey: true
  },
  {
    name: 'account_sid',
    type: 'string',
  },
  {
    name: 'service_provider_sid',
    type: 'string',
  },
  {
    name: 'vendor',
    type: 'string',
    required: true,
  },
  {
    name: 'credential',
    type: 'string',
  },
  {
    name: 'use_for_tts',
    type: 'number'
  },
  {
    name: 'use_for_stt',
    type: 'number'
  },
  {
    name: 'tts_tested_ok',
    type: 'number'
  },
  {
    name: 'stt_tested_ok',
    type: 'number'
  },
  {
    name: 'last_used',
    type: 'date'
  },
  {
    name: 'last_tested',
    type: 'date'
  },
  {
    name: 'label',
    type: 'string'
  }
];

module.exports = SpeechCredential;
