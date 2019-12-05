const test = require('tape').test ;
const ADMIN_TOKEN = '38700987-c7a4-4685-a5bb-af378f9734de';
const authAdmin = {bearer: ADMIN_TOKEN};
const request = require('request-promise-native').defaults({
  baseUrl: 'http://127.0.0.1:3000/v1'
});
const {createVoipCarrier, deleteObjectBySid} = require('./utils');

process.on('unhandledRejection', (reason, p) => {
  console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
});

test('phone number tests', async(t) => {
  const app = require('../app');
  let sid;
  try {
    let result;

    /* add service provider, phone number, and voip carrier */
    const voip_carrier_sid = await createVoipCarrier(request);

    /* provision phone number - failure case:  voip_carrier_sid is required */
    result = await request.post('/PhoneNumbers', {
      resolveWithFullResponse: true,
      simple: false,
      auth: authAdmin,
      json: true,
      body: {
        number: '15083084809'
      }
    });
    t.ok(result.statusCode === 400 && result.body.msg === 'voip_carrier_sid is required', 
      'voip_carrier_sid is required when provisioning a phone number');

    /* provision phone number - failure case: digits only */
    result = await request.post('/PhoneNumbers', {
      resolveWithFullResponse: true,
      simple: false,
      auth: authAdmin,
      json: true,
      body: {
        number: '+15083084809',
        voip_carrier_sid
      }
    });
    t.ok(result.statusCode === 400 && result.body.msg === 'phone number must only include digits', 
      'service_provider_sid is required when provisioning a phone number');
    
    /* provision phone number - failure case: insufficient digits */
    result = await request.post('/PhoneNumbers', {
      resolveWithFullResponse: true,
      simple: false,
      auth: authAdmin,
      json: true,
      body: {
        number: '1508308',
        voip_carrier_sid
      }
    });
    //console.log(`result: ${JSON.stringify(result)}`);
    t.ok(result.statusCode === 400 && result.body.msg === 'invalid phone number: insufficient digits', 
      'invalid phone number: insufficient digits');

    /* provision phone number - failure case: invalid US number */
    result = await request.post('/PhoneNumbers', {
      resolveWithFullResponse: true,
      simple: false,
      auth: authAdmin,
      json: true,
      body: {
        number: '150830848091',
        voip_carrier_sid
      }
    });
    t.ok(result.statusCode === 400 && result.body.msg === 'invalid US phone number', 
      'invalid US phone number');

    /* add a phone number */
    result = await request.post('/PhoneNumbers', {
      resolveWithFullResponse: true,
      auth: authAdmin,
      json: true,
      body: {
        number: '16173333456',
        voip_carrier_sid
      }
    });
    t.ok(result.statusCode === 201, 'successfully created phone number');
    const sid = result.body.sid;
    
    /* query all phone numbers */
    result = await request.get('/PhoneNumbers', {
      auth: authAdmin,
      json: true,
    });
    t.ok(result.length === 1 , 'successfully queried all phone numbers');

    /* query one phone numbers */
    result = await request.get(`/PhoneNumbers/${sid}`, {
      auth: authAdmin,
      json: true,
    });
    t.ok(result.number === '16173333456' , 'successfully retrieved phone number by sid');

    /* delete phone number */
    result = await request.delete(`/PhoneNumbers/${sid}`, {
      auth: authAdmin,
      resolveWithFullResponse: true,
    });
    t.ok(result.statusCode === 204, 'successfully deleted phone number');

    await deleteObjectBySid(request, '/VoipCarriers', voip_carrier_sid);

    t.end();
  }
  catch (err) {
    console.error(err);
    t.end(err);
  }
});

