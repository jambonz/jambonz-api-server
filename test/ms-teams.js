const test = require('tape') ;
const ADMIN_TOKEN = '38700987-c7a4-4685-a5bb-af378f9734de';
const authAdmin = {bearer: ADMIN_TOKEN};
const request = require('request-promise-native').defaults({
  baseUrl: 'http://127.0.0.1:3000/v1'
});
const {createServiceProvider, createAccount, deleteObjectBySid} = require('./utils');

process.on('unhandledRejection', (reason, p) => {
  console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
});

test('ms teams tests', async(t) => {
  const app = require('../app');
  let sid;
  try {
    let result;
    const service_provider_sid = await createServiceProvider(request);
    const account_sid = await createAccount(request, service_provider_sid);
    const account_sid2 = await createAccount(request, service_provider_sid, 'account2');

    /* add a tenant  */
    result = await request.post('/MicrosoftTeamsTenants', {
      resolveWithFullResponse: true,
      auth: authAdmin,
      json: true,
      body: {
        service_provider_sid,
        account_sid,
        tenant_fqdn: 'foo.bar.baz'
      }
    });
    t.ok(result.statusCode === 201, 'successfully added ms teams tenant');
    const sid1 = result.body.sid;

    /* add a second tenant  */
    result = await request.post('/MicrosoftTeamsTenants', {
      resolveWithFullResponse: true,
      auth: authAdmin,
      json: true,
      body: {
        service_provider_sid,
        account_sid: account_sid2,
        tenant_fqdn: 'junk.bar.baz'
      }
    });
    t.ok(result.statusCode === 201, 'successfully added ms teams tenant');
    const sid2 = result.body.sid;

    result = await request.get('/MicrosoftTeamsTenants', {
      resolveWithFullResponse: true,
      auth: authAdmin,
      json: true
    });
    t.ok(result.body.length === 2, 'successfully retrieved tenants');

    /* update tenant */
    result = await request.put(`/MicrosoftTeamsTenants/${sid1}`, {
      auth: authAdmin,
      json: true,
      resolveWithFullResponse: true,
      body: {
        tenant_fqdn: 'foo.bar.bazzle'
      }
    });
    t.ok(result.statusCode === 204, 'successfully updated ms teams tenant');

    /* get tenant */
    result = await request.get(`/MicrosoftTeamsTenants/${sid1}`, {
      auth: authAdmin,
      json: true
    });
    t.ok(result.tenant_fqdn === 'foo.bar.bazzle', 'successfully retrieved ms teams tenant');
    

    await deleteObjectBySid(request, '/MicrosoftTeamsTenants', sid1);
    await deleteObjectBySid(request, '/MicrosoftTeamsTenants', sid2);
    await deleteObjectBySid(request, '/Accounts', account_sid);
    await deleteObjectBySid(request, '/Accounts', account_sid2);
    await deleteObjectBySid(request, '/ServiceProviders', service_provider_sid);

    //t.end();
  }
  catch (err) {
    console.error(err);
    t.end(err);
  }
});

