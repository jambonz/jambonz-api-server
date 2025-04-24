const test = require('tape') ;
const ADMIN_TOKEN = '38700987-c7a4-4685-a5bb-af378f9734de';
const authAdmin = {bearer: ADMIN_TOKEN};
const { createClient } = require('./http-client');
const request = createClient({
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

    /* add service_provider user */
    const sp_name = 'sbc_service_provider';
    const sp_password = 'password';
    result = await request.post(`/Users`, {
      resolveWithFullResponse: true,
      json: true,
      auth: authAdmin,
      body: {
        name: sp_name,
        email: 'sbc_sp@jambonz.com',
        is_active: true,
        force_change: false,
        initial_password: sp_password,
        service_provider_sid,
      }
    });
    t.ok(result.statusCode === 201 && result.body.user_sid, 'SBC service_provider scope user created');
    const sbc_sp_user_sid = result.body.user_sid;

    result = await request.post('/login', {
      resolveWithFullResponse: true,
      json: true,
      body: {
        username: sp_name,
        password: sp_password,  
      }
    });
    t.ok(result.statusCode === 200 && result.body.token, 'successfully logged in as sbc user');
    const authSbcSp = {bearer: result.body.token};


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
    const sid = result.body.sid;

    result = await request.get(`/Sbcs?service_provider_sid=${service_provider_sid}`, {
      resolveWithFullResponse: true,
      auth: authAdmin,
      json: true
    });
    //console.log(result.body)
    t.ok(result.body.length === 1 && result.body[0].ipv4 === '192.168.1.4', 'successfully retrieved service provider sbc');

    result = await request.get('/Sbcs', {
      resolveWithFullResponse: true,
      auth: authSbcSp,
      json: true
    });
    //console.log(result.body)
    t.ok(result.body.length === 1 && result.body[0].ipv4 === '192.168.1.4', 'successfully retrieved service provider sbc');

    await request.delete(`/Users/${sbc_sp_user_sid}`, {
      resolveWithFullResponse: true,
      json: true,
      auth: authAdmin,
    });

    await deleteObjectBySid(request, '/Sbcs', sid);
    await deleteObjectBySid(request, '/ServiceProviders', service_provider_sid);

    //t.end();
  }
  catch (err) {
    console.error(err);
    t.end(err);
  }
});

