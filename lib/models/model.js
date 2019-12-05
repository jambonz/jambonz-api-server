const Emitter = require('events');
const uuidv4 = require('uuid/v4');
const assert = require('assert');
const {getMysqlConnection} = require('../db');
const {DbErrorBadRequest} = require('../utils/errors');

class Model extends Emitter {
  constructor() {
    super();
  }

  static getPrimaryKey() {
    return this.fields.find((f) => f.primaryKey === true);
  }

  /**
   * check validity of object to be inserted into db
   */
  static checkIsInsertable(obj) {
    // check all required fields are present
    const required = this.fields.filter((f) => f.required === true);
    const missing = required.find((f) => !(f.name in obj));
    if (missing) throw new DbErrorBadRequest(`missing field ${missing.name}`);
    return true;
  }

  /**
   * insert object into the database
   */
  static make(obj) {
    return new Promise((resolve, reject) => {
      const pk = this.getPrimaryKey();
      this.checkIsInsertable(obj);
      getMysqlConnection((err, conn) => {
        if (err) return reject(err);
        const uuid = uuidv4();
        obj[pk.name] = uuid;
        conn.query(`INSERT into ${this.table} SET ?`,
          obj,
          (err, results, fields) => {
            conn.release();
            if (err) return reject(err);
            resolve(uuid);
          });
      });
    });
  }

  /**
   *  delete object from database
   */
  static remove(uuid) {
    return new Promise((resolve, reject) => {
      const pk = this.getPrimaryKey();
      getMysqlConnection((err, conn) => {
        if (err) return reject(err);
        conn.query(`DELETE from ${this.table} WHERE ${pk.name} = ?`, uuid, (err, results) => {
          conn.release();
          if (err) return reject(err);
          resolve(results.affectedRows);
        });
      });
    });
  }

  /**
   * retrieve all objects
   */
  static retrieveAll() {
    return new Promise((resolve, reject) => {
      getMysqlConnection((err, conn) => {
        if (err) return reject(err);
        conn.query(`SELECT * from ${this.table}`, (err, results, fields) => {
          conn.release();
          if (err) return reject(err);
          resolve(results);
        });
      });
    });
  }

  /**
   * retrieve a specific object
   */
  static retrieve(sid) {
    return new Promise((resolve, reject) => {
      const pk = this.getPrimaryKey();
      assert.ok(pk, 'field definitions must include the primary key');
      getMysqlConnection((err, conn) => {
        if (err) return reject(err);
        conn.query(`SELECT * from ${this.table} WHERE ${pk.name} = ?`, sid, (err, results, fields) => {
          conn.release();
          if (err) return reject(err);
          resolve(results);
        });
      });
    });
  }

  /**
   * update an object
   */
  static update(sid, obj) {
    const pk = this.getPrimaryKey();
    assert.ok(pk, 'field definitions must include the primary key');
    return new Promise((resolve, reject) => {
      if (pk.name in obj) throw new DbErrorBadRequest(`primary key ${pk.name} is immutable`);
      getMysqlConnection((err, conn) => {
        if (err) return reject(err);
        conn.query(`UPDATE ${this.table} SET ? WHERE ${pk.name} = '${sid}'`, obj, (err, results, fields) => {
          conn.release();
          if (err) return reject(err);
          resolve(results.affectedRows);
        });
      });
    });
  }

  static getForeignKeyReferences(fk, sid) {
    return new Promise((resolve, reject) => {
      const arr = /(.*)\.(.*)/.exec(fk);
      assert.ok(arr, `foreign key must be written as table.column: ${fk}`);
      const table = arr[1];
      const column = arr[2];
      getMysqlConnection((err, conn) => {
        if (err) return reject(err);
        conn.query(`SELECT COUNT(*) as count from ${table} WHERE ${column} = ?`,
          sid, (err, results, fields) => {
            conn.release();
            if (err) return reject(err);
            resolve(results[0].count);
          });
      });
    });
  }
}

Model.table = 'subclassResponsibility';
Model.fields = [];

module.exports = Model;
