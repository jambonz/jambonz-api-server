const test = require('tape').test ;
const ADMIN_TOKEN = '38700987-c7a4-4685-a5bb-af378f9734de';
const authAdmin = {bearer: ADMIN_TOKEN};
const request = require('request-promise-native').defaults({
  baseUrl: 'http://127.0.0.1:3000/v1'
});
const {createVoipCarrier, createServiceProvider, createPhoneNumber, deleteObjectBySid} = require('./utils');

process.on('unhandledRejection', (reason, p) => {
  console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
});

test('account tests', async(t) => {
  const app = require('../app');
  let sid;
  try {
    let result;

    /* add service provider, phone number, and voip carrier */
    const voip_carrier_sid = await createVoipCarrier(request);
    const service_provider_sid = await createServiceProvider(request);
    const phone_number_sid = await createPhoneNumber(request, voip_carrier_sid);
    
    /* add an account */
    result = await request.post('/Accounts', {
      resolveWithFullResponse: true,
      auth: authAdmin,
      json: true,
      body: {
        name: 'daveh',
        service_provider_sid,
        registration_hook: {
          url: 'http://example.com/reg',
          method: 'get'
        }
      }
    });
    t.ok(result.statusCode === 201, 'successfully created account');
    const sid = result.body.sid;

    /* query all accounts */
    result = await request.get('/Accounts', {
      auth: authAdmin,
      json: true,
    });
    let regHook = result[0].registration_hook;
    t.ok(result.length === 1 &&
      Object.keys(regHook).length == 4, 'successfully queried all accounts');

    /* query one accounts */
    result = await request.get(`/Accounts/${sid}`, {
      auth: authAdmin,
      json: true,
    });
    t.ok(result.name === 'daveh' , 'successfully retrieved account by sid');

    /* update accounts */
    result = await request.put(`/Accounts/${sid}`, {
      auth: authAdmin,
      json: true,
      resolveWithFullResponse: true,
      body: {
        name: 'robb',
        registration_hook: {
          url: 'http://example.com/reg2',
          method: 'get'
        }
      }
    });
    t.ok(result.statusCode === 204, 'successfully updated account');

    result = await request.get(`/Accounts/${sid}`, {
      auth: authAdmin,
      json: true,
    });
    //console.log(`retrieved account after update: ${JSON.stringify(result)}`);
    t.ok(Object.keys(result.registration_hook).length === 4, 'successfully removed a hook from account');

    /* assign phone number to account */
    result = await request.put(`/PhoneNumbers/${phone_number_sid}`, {
      auth: authAdmin,
      json: true,
      resolveWithFullResponse: true,
      body: {
        account_sid: sid
      }
    });
    t.ok(result.statusCode === 204, 'successfully assigned phone number to account');

    /* cannot delete account that has phone numbers assigned */
    result = await request.delete(`/Accounts/${sid}`, {
      auth: authAdmin,
      resolveWithFullResponse: true,
      simple: false,
      json: true
    });
    t.ok(result.statusCode === 422 && result.body.msg === 'cannot delete account with phone numbers', 'cannot delete account with phone numbers');

    /* delete account */
    await request.delete(`/PhoneNumbers/${phone_number_sid}`, {auth: authAdmin});
    result = await request.delete(`/Accounts/${sid}`, {
      auth: authAdmin,
      resolveWithFullResponse: true,
    });
    t.ok(result.statusCode === 204, 'successfully deleted account after removing phone number');

    await deleteObjectBySid(request, '/VoipCarriers', voip_carrier_sid);
    await deleteObjectBySid(request, '/ServiceProviders', service_provider_sid);
    t.end();
  }
  catch (err) {
    //console.error(err);
    t.end(err);
  }
});

