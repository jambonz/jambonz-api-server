const test = require('tape').test ;
const ADMIN_TOKEN = '38700987-c7a4-4685-a5bb-af378f9734de';
const authAdmin = {bearer: ADMIN_TOKEN};
const request = require('request-promise-native').defaults({
  baseUrl: 'http://127.0.0.1:3000/v1'
});

process.on('unhandledRejection', (reason, p) => {
  console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
});

test('voip carrier tests', async(t) => {
  const app = require('../app');
  let sid;
  try {
    let result;

    /* add a voip carrier */
    result = await request.post('/VoipCarriers', {
      resolveWithFullResponse: true,
      auth: authAdmin,
      json: true,
      body: {
        name: 'daveh'
      }
    });
    t.ok(result.statusCode === 201, 'successfully created voip carrier');
    const sid = result.body.sid;

    /* query all voip carriers */
    result = await request.get('/VoipCarriers', {
      auth: authAdmin,
      json: true,
    });
    t.ok(result.length === 1 , 'successfully queried all voip carriers');

    /* query one voip carriers */
    result = await request.get(`/VoipCarriers/${sid}`, {
      auth: authAdmin,
      json: true,
    });
    t.ok(result.name === 'daveh' , 'successfully retrieved voip carrier by sid');


    /* update voip carriers */
    result = await request.put(`/VoipCarriers/${sid}`, {
      auth: authAdmin,
      json: true,
      resolveWithFullResponse: true,
      body: {
        name: 'robb'
      }
    });
    t.ok(result.statusCode === 204, 'successfully updated voip carrier');

    /* provision a phone number for the voip carrier */
    result = await request.post('/PhoneNumbers', {
      resolveWithFullResponse: true,
      simple: false,
      auth: authAdmin,
      json: true,
      body: {
        number: '15083084809',
        voip_carrier_sid: sid
      }
    });
    t.ok(result.statusCode === 201, 'successfully provisioned a phone number from voip carrier');
    const phone_number_sid = result.body.sid;


    /* can't delete a voip carrier that has phone numbers assigned */
    result = await request.delete(`/VoipCarriers/${sid}`, {
      resolveWithFullResponse: true,
      simple: false,
      json: true,
      auth: authAdmin
    });
    //console.log(`result: ${JSON.stringify(result)}`);
    t.ok(result.statusCode === 422 && result.body.msg === 'cannot delete voip carrier with active phone numbers',
      'cannot delete voip carrier with active phone numbers');

    /* delete phone number */
    result = await request.delete(`/PhoneNumbers/${phone_number_sid}`, {
      resolveWithFullResponse: true,
      simple: false,
      json: true,
      auth: authAdmin
    });
    //console.log(`result: ${JSON.stringify(result)}`);
    t.ok(result.statusCode === 204, 'successfully deleted phone number');

    /* delete voip carrier */
    result = await request.delete(`/VoipCarriers/${sid}`, {
      resolveWithFullResponse: true,
      simple: false,
      json: true,
      auth: authAdmin
    });
    //console.log(`result: ${JSON.stringify(result)}`);
    t.ok(result.statusCode === 204, 'successfully deleted voip carrier');
    
    t.end();
  }
  catch (err) {
    console.error(err);
    t.end(err);
  }
});

