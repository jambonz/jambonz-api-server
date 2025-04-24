const test = require('tape') ;
const ADMIN_TOKEN = '38700987-c7a4-4685-a5bb-af378f9734de';
const authAdmin = {bearer: ADMIN_TOKEN};
const { createClient } = require('./http-client');
const request = createClient({
  baseUrl: 'http://127.0.0.1:3000/v1'
});
const {createVoipCarrier, deleteObjectBySid} = require('./utils');


process.on('unhandledRejection', (reason, p) => {
  console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
});

test('smpp gateway tests', async(t) => {
  const app = require('../app');
  let sid;
  try {
    let result;
    const voip_carrier_sid = await createVoipCarrier(request);

    /* add a smpp gateway */
    result = await request.post('/SmppGateways', {
      resolveWithFullResponse: true,
      auth: authAdmin,
      json: true,
      body: {
        voip_carrier_sid,
        ipv4: '192.168.1.1',
        netmask: 32,
        inbound: true,
        outbound: true,
        use_tls: true,
        is_primary: true
      }
    });
    t.ok(result.statusCode === 201, 'successfully created smpp gateway ');
    const sid = result.body.sid;

    /* query all smpp gateways */
    console.log('querying with ')
    result = await request.get('/SmppGateways', {
      qs: {voip_carrier_sid},
      auth: authAdmin,
      json: true,
    });
    t.ok(result.length === 1 , 'successfully queried all smpp gateways');

    /* query one smpp gateway */
    result = await request.get(`/SmppGateways/${sid}`, {
      auth: authAdmin,
      json: true,
    });
    //console.log(`result: ${JSON.stringify(result)}`);
    t.ok(result.ipv4 === '192.168.1.1' , 'successfully retrieved voip carrier by sid');


    /* update smpp gateway */
    result = await request.put(`/SmppGateways/${sid}`, {
      auth: authAdmin,
      json: true,
      resolveWithFullResponse: true,
      body: {
        port: 5061,
        netmask:24,
        outbound: false
      }
    });
    t.ok(result.statusCode === 204, 'successfully updated voip carrier');

    /* delete smpp gatewas */
    result = await request.delete(`/SmppGateways/${sid}`, {
      resolveWithFullResponse: true,
      simple: false,
      json: true,
      auth: authAdmin
    });
    //console.log(`result: ${JSON.stringify(result)}`);
    t.ok(result.statusCode === 204, 'successfully deleted smpp gateway');
    
    await deleteObjectBySid(request, '/VoipCarriers', voip_carrier_sid);

    //t.end();
  }
  catch (err) {
    console.error(err);
    t.end(err);
  }
});

