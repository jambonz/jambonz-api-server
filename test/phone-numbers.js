const test = require('tape') ;
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
    t.ok(result.statusCode === 201, 
      'accepts E.164 format');
    const sid = result.body.sid;

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
    const sid2 = result.body.sid;
    
    /* query all phone numbers */
    result = await request.get('/PhoneNumbers', {
      auth: authAdmin,
      json: true,
    });
    t.ok(result.length === 2, 'successfully queried all phone numbers');

    /* query one phone numbers */
    result = await request.get(`/PhoneNumbers/${sid2}`, {
      auth: authAdmin,
      json: true,
    });
    t.ok(result.number === '16173333456' , 'successfully retrieved phone number by sid');

    /* fail to query one phone number with invalid uuid */
    try {
      result = await request.get(`/PhoneNumbers/foobar`, {
        auth: authAdmin,
        json: true,
      });
    } catch (err) {
      t.ok(err.statusCode === 400, 'returns 400 bad request if phone number sid param is not a valid uuid');
    }

    /* delete phone number */
    result = await request.delete(`/PhoneNumbers/${sid}`, {
      auth: authAdmin,
      resolveWithFullResponse: true,
    });
    t.ok(result.statusCode === 204, 'successfully deleted phone number');
    result = await request.delete(`/PhoneNumbers/${sid2}`, {
      auth: authAdmin,
      resolveWithFullResponse: true,
    });

    await deleteObjectBySid(request, '/VoipCarriers', voip_carrier_sid);

    //t.end();
  }
  catch (err) {
    console.error(err);
    t.end(err);
  }
});

