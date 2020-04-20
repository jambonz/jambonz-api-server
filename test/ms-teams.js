const test = require('tape').test ;
const ADMIN_TOKEN = '38700987-c7a4-4685-a5bb-af378f9734de';
const authAdmin = {bearer: ADMIN_TOKEN};
const request = require('request-promise-native').defaults({
  baseUrl: 'http://127.0.0.1:3000/v1'
});
const {createServiceProvider, deleteObjectBySid} = require('./utils');

process.on('unhandledRejection', (reason, p) => {
  console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
});

test('sbc_addresses tests', async(t) => {
  const app = require('../app');
  let sid;
  try {
    let result;
    const service_provider_sid = await createServiceProvider(request);

    /* add a tenant  */
    result = await request.post('/MicrosoftTeamsTenants', {
      resolveWithFullResponse: true,
      auth: authAdmin,
      json: true,
      body: {
        service_provider_sid,
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

    await deleteObjectBySid(request, '/MicrosoftTeamsTenants', sid1);
    await deleteObjectBySid(request, '/MicrosoftTeamsTenants', sid2);
    await deleteObjectBySid(request, '/ServiceProviders', service_provider_sid);

    t.end();
  }
  catch (err) {
    console.error(err);
    t.end(err);
  }
});

