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

test('sip gateway tests', async(t) => {
  const app = require('../app');
  let sid;
  try {
    let result;
    const voip_carrier_sid = await createVoipCarrier(request);

    /* add a invalid sip gateway */
    const STORED_JAMBONZ_MIN_GATEWAY_NETMASK = process.env.JAMBONZ_MIN_GATEWAY_NETMASK;
    process.env.JAMBONZ_MIN_GATEWAY_NETMASK = 24;
    
    result = await request.post('/SipGateways', {
      resolveWithFullResponse: true,
      auth: authAdmin,
      json: true,
      simple: false,
      body: {
        voip_carrier_sid,
        ipv4: '1.2.3.4',
        netmask: 1,
        inbound: true,
        outbound: true,
        protocol: 'tcp'
      }
    });
    t.ok(result.statusCode === 400, 'successfully created sip gateway ');

    result = await request.post('/SipGateways', {
      resolveWithFullResponse: true,
      auth: authAdmin,
      json: true,
      body: {
        voip_carrier_sid,
        ipv4: '1.2.3.4',
        netmask: 24,
        inbound: true,
        outbound: true,
        protocol: 'tcp'
      }
    });
    t.ok(result.statusCode === 201, 'successfully created sip gateway ');

    process.env.JAMBONZ_MIN_GATEWAY_NETMASK = STORED_JAMBONZ_MIN_GATEWAY_NETMASK;

    /* delete sip gateways */
    result = await request.delete(`/SipGateways/${result.body.sid}`, {
      resolveWithFullResponse: true,
      simple: false,
      json: true,
      auth: authAdmin
    });
    //console.log(`result: ${JSON.stringify(result)}`);
    t.ok(result.statusCode === 204, 'successfully deleted sip gateway');

    /* add a sip gateway */
    result = await request.post('/SipGateways', {
      resolveWithFullResponse: true,
      auth: authAdmin,
      json: true,
      body: {
        voip_carrier_sid,
        ipv4: '192.168.1.1',
        netmask: 32,
        inbound: true,
        outbound: true,
        protocol: 'tcp'
      }
    });
    t.ok(result.statusCode === 201, 'successfully created sip gateway ');
    const sid = result.body.sid;

    /* query all sip gateways */
    result = await request.get('/SipGateways', {
      qs: {voip_carrier_sid},
      auth: authAdmin,
      json: true,
    });
    t.ok(result.length === 1 , 'successfully queried all sip gateways');

    /* query one sip gateway */
    result = await request.get(`/SipGateways/${sid}`, {
      auth: authAdmin,
      json: true,
    });
    //console.log(`result: ${JSON.stringify(result)}`);
    t.ok(result.ipv4 === '192.168.1.1' , 'successfully retrieved voip carrier by sid');
    t.ok(result.protocol === 'tcp' , 'successfully retrieved voip carrier by sid');


    /* update sip gateway */
    result = await request.put(`/SipGateways/${sid}`, {
      auth: authAdmin,
      json: true,
      resolveWithFullResponse: true,
      body: {
        port: 5061,
        netmask:24,
        outbound: false,
        protocol: 'udp'
      }
    });
    t.ok(result.statusCode === 204, 'successfully updated voip carrier');

    /* delete sip gateways */
    result = await request.delete(`/SipGateways/${sid}`, {
      resolveWithFullResponse: true,
      simple: false,
      json: true,
      auth: authAdmin
    });
    //console.log(`result: ${JSON.stringify(result)}`);
    t.ok(result.statusCode === 204, 'successfully deleted sip gateway');

    /* add a sip gateway */
    result = await request.post('/SipGateways', {
      resolveWithFullResponse: true,
      auth: authAdmin,
      json: true,
      body: {
        voip_carrier_sid,
        ipv4: '192.168.1.2',
        netmask: 32,
        inbound: true,
        outbound: true,
        protocol: 'tls',
        use_sips_scheme: true
      }
    });
    t.ok(result.statusCode === 201, 'successfully created sip gateway ');
    const sipsSid = result.body.sid;

    /* query one sip gateway */
    result = await request.get(`/SipGateways/${sipsSid}`, {
      auth: authAdmin,
      json: true,
    });
    //console.log(`result: ${JSON.stringify(result)}`);
    t.ok(result.ipv4 === '192.168.1.2' , 'successfully retrieved voip carrier by sid');
    t.ok(result.protocol === 'tls' , 'successfully retrieved voip carrier by sid');
    t.ok(result.use_sips_scheme, 'successfully retrieved voip carrier by sid');

    /* delete sip gateways */
    result = await request.delete(`/SipGateways/${sipsSid}`, {
      resolveWithFullResponse: true,
      simple: false,
      json: true,
      auth: authAdmin
    });
    //console.log(`result: ${JSON.stringify(result)}`);
    t.ok(result.statusCode === 204, 'successfully deleted sip gateway');

    /* add a sip gateway with remove_ice and dtls_off */
    result = await request.post('/SipGateways', {
      resolveWithFullResponse: true,
      auth: authAdmin,
      json: true,
      body: {
        voip_carrier_sid,
        ipv4: '192.168.1.3',
        netmask: 32,
        inbound: true,
        outbound: true,
        remove_ice: true,
        dtls_off: true
      }
    });
    t.ok(result.statusCode === 201, 'successfully created sip gateway with remove_ice and dtls_off');
    const iceDtlsSid = result.body.sid;

    /* query sip gateway with remove_ice and dtls_off */
    result = await request.get(`/SipGateways/${iceDtlsSid}`, {
      auth: authAdmin,
      json: true,
    });
    t.ok(result.ipv4 === '192.168.1.3', 'successfully retrieved sip gateway by sid');
    t.ok(result.remove_ice === 1, 'remove_ice is set correctly');
    t.ok(result.dtls_off === 1, 'dtls_off is set correctly');

    /* update sip gateway to disable remove_ice */
    result = await request.put(`/SipGateways/${iceDtlsSid}`, {
      auth: authAdmin,
      json: true,
      resolveWithFullResponse: true,
      body: {
        remove_ice: false
      }
    });
    t.ok(result.statusCode === 204, 'successfully updated sip gateway remove_ice');

    /* verify update */
    result = await request.get(`/SipGateways/${iceDtlsSid}`, {
      auth: authAdmin,
      json: true,
    });
    t.ok(result.remove_ice === 0, 'remove_ice was updated correctly');
    t.ok(result.dtls_off === 1, 'dtls_off remains unchanged');

    /* delete sip gateway */
    result = await request.delete(`/SipGateways/${iceDtlsSid}`, {
      resolveWithFullResponse: true,
      simple: false,
      json: true,
      auth: authAdmin
    });
    t.ok(result.statusCode === 204, 'successfully deleted sip gateway with ice/dtls flags');

    await deleteObjectBySid(request, '/VoipCarriers', voip_carrier_sid);

    t.end();
  }
  catch (err) {
    console.error(err);
    t.end(err);
  }
});

