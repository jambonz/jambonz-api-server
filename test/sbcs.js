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

    /* add a community sbc */
    result = await request.post('/Sbcs', {
      resolveWithFullResponse: true,
      auth: authAdmin,
      json: true,
      body: {
        ipv4: '192.168.1.1'
      }
    });
    t.ok(result.statusCode === 201, 'successfully created community sbc ');
    const sid1 = result.body.sid;

    /* add a service provider sbc */
    result = await request.post('/Sbcs', {
      resolveWithFullResponse: true,
      auth: authAdmin,
      json: true,
      body: {
        ipv4: '192.168.1.4',
        service_provider_sid
      }
    });
    t.ok(result.statusCode === 201, 'successfully created service provider sbc ');
    const sid2 = result.body.sid;

    result = await request.get('/Sbcs', {
      resolveWithFullResponse: true,
      auth: authAdmin,
      json: true
    });
    t.ok(result.body.length === 1 && result.body[0].ipv4 === '192.168.1.1', 'successfully retrieved community sbc');

    result = await request.get(`/Sbcs?service_provider_sid=${service_provider_sid}`, {
      resolveWithFullResponse: true,
      auth: authAdmin,
      json: true
    });
    t.ok(result.body.length === 1 && result.body[0].ipv4 === '192.168.1.4', 'successfully retrieved service provider sbc');

    await deleteObjectBySid(request, '/Sbcs', sid1);
    await deleteObjectBySid(request, '/Sbcs', sid2);
    await deleteObjectBySid(request, '/ServiceProviders', service_provider_sid);

    t.end();
  }
  catch (err) {
    console.error(err);
    t.end(err);
  }
});

