const Model = require('./model');
const {promisePool} = require('../db');
const sqlAll = `
SELECT * from permissions
`;
const sqlByName = `
SELECT * from permissions where name = ?
`;

class Permissions extends Model {
  constructor() {
    super();
  }

  static async retrieveAll() {
    const [rows] = await promisePool.query(sqlAll);
    return rows;
  }

  static async retrieveByName(name) {
    const [rows] = await promisePool.query(sqlByName, [name]);
    return rows;
  }
}

Permissions.table = 'permissions';
Permissions.fields = [
  {
    name: 'permission_sid',
    type: 'string',
    primaryKey: true
  },
  {
    name: 'name',
    type: 'string',
    required: true
  },
  {
    name: 'description',
    type: 'string',
    required: true
  }
];

module.exports = Permissions;
