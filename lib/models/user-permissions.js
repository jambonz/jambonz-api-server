const Model = require('./model');
const {promisePool} = require('../db');
const sqlAll = `
SELECT * from user_permissions
`;
const sqlByUserIdPermissionSid = `
SELECT * from user_permissions where user_sid = ? and permission_sid = ?
`;

class UserPermissions extends Model {
  constructor() {
    super();
  }

  static async retrieveAll() {
    const [rows] = await promisePool.query(sqlAll);
    return rows;
  }

  static async retrieveByUserIdPermissionSid(user_sid, permission_sid) {
    const [rows] = await promisePool.query(sqlByUserIdPermissionSid, [user_sid, permission_sid]);
    return rows;
  }
}

UserPermissions.table = 'user_permissions';
UserPermissions.fields = [
  {
    name: 'user_permissions_sid',
    type: 'string',
    primaryKey: true
  },
  {
    name: 'user_sid',
    type: 'string',
    required: true
  },
  {
    name: 'permission_sid',
    type: 'string',
    required: true
  }
];

module.exports = UserPermissions;
