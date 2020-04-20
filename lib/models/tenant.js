const Model = require('./model');

class MsTeamsTenant extends Model {
  constructor() {
    super();
  }
}

MsTeamsTenant.table = 'ms_teams_tenants';
MsTeamsTenant.fields = [
  {
    name: 'ms_teams_tenant_sid',
    type: 'string',
    primaryKey: true
  },
  {
    name: 'service_provider_sid',
    type: 'string',
    required: true
  },
  {
    name: 'account_sid',
    type: 'string'
  },
  {
    name: 'application_sid',
    type: 'string'
  },
  {
    name: 'tenant_fqdn',
    type: 'string',
    required: true
  }
];

module.exports = MsTeamsTenant;
