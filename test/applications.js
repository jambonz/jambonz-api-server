const test = require('tape').test ;
const ADMIN_TOKEN = '38700987-c7a4-4685-a5bb-af378f9734de';
const authAdmin = {bearer: ADMIN_TOKEN};
const request = require('request-promise-native').defaults({
  baseUrl: 'http://127.0.0.1:3000/v1'
});
const {createVoipCarrier, createServiceProvider, 
  createPhoneNumber, createAccount, deleteObjectBySid
} = require('./utils');

process.on('unhandledRejection', (reason, p) => {
  console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
});

test('application tests', async(t) => {
  const app = require('../app');
  let sid;
  try {
    let result;

    /* add service provider, phone number, and voip carrier */
    const voip_carrier_sid = await createVoipCarrier(request);
    const service_provider_sid = await createServiceProvider(request);
    const phone_number_sid = await createPhoneNumber(request, voip_carrier_sid);
    const account_sid = await createAccount(request, service_provider_sid);
    
    /* add an application */
    result = await request.post('/Applications', {
      resolveWithFullResponse: true,
      auth: authAdmin,
      json: true,
      body: {
        name: 'daveh',
        account_sid,
        call_hook: 'http://example.com',
        call_status_hook: 'http://example.com'
      }
    });
    t.ok(result.statusCode === 201, 'successfully created application');
    const sid = result.body.sid;

    /* query all applications */
    result = await request.get('/Applications', {
      auth: authAdmin,
      json: true,
    });
    t.ok(result.length === 1 , 'successfully queried all applications');

    /* query one applications */
    result = await request.get(`/Applications/${sid}`, {
      auth: authAdmin,
      json: true,
    });
    t.ok(result.name === 'daveh' , 'successfully retrieved application by sid');

    /* update applications */
    result = await request.put(`/Applications/${sid}`, {
      auth: authAdmin,
      json: true,
      resolveWithFullResponse: true,
      body: {
        call_hook: 'http://example2.com'
      }
    });
    t.ok(result.statusCode === 204, 'successfully updated application');

    /* assign phone number to application */
    result = await request.put(`/PhoneNumbers/${phone_number_sid}`, {
      auth: authAdmin,
      json: true,
      resolveWithFullResponse: true,
      body: {
        application_sid: sid,
        account_sid
      }
    });
    t.ok(result.statusCode === 204, 'successfully assigned phone number to application');

    /* delete application */
    result = await request.delete(`/Applications/${sid}`, {
      auth: authAdmin,
      resolveWithFullResponse: true,
      simple: false,
      json: true
    });
    //console.log(results);
    t.ok(result.statusCode === 422, 'cannot delete application with phone numbers');

    /* delete application */
    await request.delete(`/PhoneNumbers/${phone_number_sid}`, {auth: authAdmin});
    result = await request.delete(`/Applications/${sid}`, {
      auth: authAdmin,
      resolveWithFullResponse: true,
    });
    //console.log(result);
    t.ok(result.statusCode === 204, 'successfully deleted application after removing phone number');

    await deleteObjectBySid(request, '/Accounts', account_sid);
    await deleteObjectBySid(request, '/VoipCarriers', voip_carrier_sid);
    await deleteObjectBySid(request, '/ServiceProviders', service_provider_sid);

    t.end();
  }
  catch (err) {
    //console.error(err);
    t.end(err);
  }
});

