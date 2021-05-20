const test = require('tape') ;
const exec = require('child_process').exec ;
const Account = require('../lib/models/account');
const request = require('request-promise-native').defaults({
  baseUrl: 'http://127.0.0.1:3000/v1'
});
const theOneAndOnlyServiceProviderSid = '2708b1b3-2736-40ea-b502-c53d8396247f';
const {createApiKey} = require('./utils');

const sleepFor = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test('re-creating schema', (t) => {
  exec(`mysql -h 127.0.0.1 -u root --protocol=tcp --port=3360 -D jambones_test < ${__dirname}/../db/jambones-sql.sql`, (err, stdout, stderr) => {
    if (err) return t.end(err);
    t.pass('schema successfully created');
    t.end();
  });
});

test('seeding database for webapp tests', (t) => {
  exec(`mysql -h 127.0.0.1 -u root  --protocol=tcp --port=3360 -D jambones_test < ${__dirname}/../db/seed-integration-test.sql`, (err, stdout, stderr) => {
    if (err) return t.end(err);
    t.pass('successfully re-seeded database');
    t.end();
  });
});

test('webapp tests', async(t) => {
  const app = require('../app');
  let sid;
  try {
    let result;

    /* create a new user/account using email/password */
    const code = '123456';
    result = await request.post('/register', {
      resolveWithFullResponse: true,
      json: true,
      body: {
        service_provider_sid: theOneAndOnlyServiceProviderSid,
        provider: 'local',
        name: 'Joe User',
        email: 'joe@user.com',
        password: 'fiddlesticks',
        email_activation_code: code
      }
    });
    //console.log(result.body);
    t.ok(result.statusCode === 200 && result.body.pristine === true &&
       !result.body.is_active && result.body.root_domain === 'sip.yakeeda.com', 
      'successfully created a user and account and got jwt using email validation');
    
    const {user_sid, account_sid, jwt} = result.body;
    let authUser = {bearer: jwt};

    /* invalid code */
    result = await request.put('/ActivationCode/38383', {
      resolveWithFullResponse: true,
      auth: authUser,
      simple: false,
      json: true,
      body: {
        user_sid,
        type: 'email'
      }
    });
  
    t.ok(result.statusCode === 400, 'fails to validate email with invalid code');

    /* invalid user */
    result = await request.put(`/ActivationCode/${code}`, {
      resolveWithFullResponse: true,
      auth: authUser,
      simple: false,
      json: true,
      body: {
        user_sid: 'foobar',
        type: 'email'
      }
    });
  
    t.ok(result.statusCode === 400, 'fails to validate email with invalid user');

    /* successfully validate the password */
    result = await request.put(`/ActivationCode/${code}`, {
      resolveWithFullResponse: true,
      auth: authUser,
      json: true,
      body: {
        user_sid,
        type: 'email'
      }
    });
    t.ok(result.statusCode === 204, 'successfully validated email and activated account');
   
    /* create a phone validation code */
    result = await request.post('/ActivationCode', {
      resolveWithFullResponse: true,
      auth: authUser,
      json: true,
      simple: false,
      body: {
        user_sid: 'foobar',
        type: 'phone',
        value: '16173333456',
        code: '12389'
      }
    });
    t.ok(result.statusCode === 400, 'returns 400 bad request creating activation code with invalid user_sid');
    
    result = await request.post('/ActivationCode', {
      resolveWithFullResponse: true,
      auth: authUser,
      json: true,
      simple: false,
      body: {
        user_sid,
        type: 'foobar',
        value: '16173333456',
        code: '12389'
      }
    });
    t.ok(result.statusCode === 400, 'returns 400 bad request creating activation code with invalid type');

    result = await request.post('/ActivationCode', {
      resolveWithFullResponse: true,
      auth: authUser,
      json: true,
      simple: false,
      body: {
        user_sid,
        type: 'email',
        value: 'notanemail',
        code: '12389'
      }
    });
    t.ok(result.statusCode === 400, 'returns 400 bad request creating activation code with invalid email');

    /* create a phone validation code */
    result = await request.post('/ActivationCode', {
      resolveWithFullResponse: true,
      auth: authUser,
      json: true,
      body: {
        user_sid,
        type: 'phone',
        value: '16173333456',
        code: '12389'
      }
    });
    t.ok(result.statusCode === 204, 'successfully added a phone validation code');

    /* successfully validate the code */
    result = await request.put('/ActivationCode/12389', {
      resolveWithFullResponse: true,
      auth: authUser,
      json: true,
      body: {
        user_sid,
        type: 'phone'
      }
    });
    t.ok(result.statusCode === 204, 'successfully validated phone number');
    
    /* check availability of a phone numbers and email */
    result = await request.get('/Availability?type=phone&value=16173333456', {
      resolveWithFullResponse: true,
      auth: authUser,
      json: true,
    });
    t.ok(result.statusCode === 200 && result.body.available === false, 'indicates when phone number is not available');

    result = await request.get('/Availability?type=phone&value=15083084809', {
      resolveWithFullResponse: true,
      auth: authUser,
      json: true,
    });
    t.ok(result.statusCode === 200 && result.body.available === true, 'indicates when phone number is available');

    result = await request.get('/Availability?type=email&value=joe@user.com', {
      resolveWithFullResponse: true,
      auth: authUser,
      json: true,
    });
    t.ok(result.statusCode === 200 && result.body.available === false, 'indicates when email is not available');

    result = await request.get('/Availability?type=email&value=jim@user.com', {
      resolveWithFullResponse: true,
      auth: authUser,
      json: true,
    });
    t.ok(result.statusCode === 200 && result.body.available === true, 'indicates when email is available');
   
    /* check if a subdomain is available */
    result = await request.get('/Availability?type=subdomain&value=mycompany.sip.jambonz.us', {
      resolveWithFullResponse: true,
      auth: authUser,
      json: true,
    });
    t.ok(result.statusCode === 200 && result.body.available === true, 'indicates when subdomain is available');

    /* these hit the DNS provider (dnsmadeeasy) so only do as needed */
    if (process.env.DME_API_KEY) {
      /* add a subdomain to the account */
      result = await request.post(`Accounts/${account_sid}/SipRealms/test.yakeeda.com`, {
        resolveWithFullResponse: true,
        auth: authUser,
      });
      t.ok(result.statusCode === 204, 'added subdomain');

      /* change the subdomain */
      result = await request.post(`Accounts/${account_sid}/SipRealms/myco.yakeeda.com`, {
        resolveWithFullResponse: true,
        auth: authUser,
      });
      t.ok(result.statusCode === 204, 'added subdomain');
      
      /* retrieve account and verify sip_realm */
      result = await request.get(`Accounts/${account_sid}`, {
        resolveWithFullResponse: true,
        auth: authUser,
        json: true,
      });
      //console.log(result.body);
      t.ok(result.statusCode === 200 && result.body.sip_realm === 'myco.yakeeda.com' && result.body.is_active, 
        'sip_realm successfully added to account');

      /* check if a subdomain is available */
      result = await request.get('/Availability?type=subdomain&value=myco.yakeeda.com', {
        resolveWithFullResponse: true,
        auth: authUser,
        json: true,
      });
      t.ok(result.statusCode === 200 && result.body.available === false, 'indicates when subdomain is not available');
    }

    /* retrieve test number and app for a service provider */
    result = await request.get(`/AccountTest/${theOneAndOnlyServiceProviderSid}`, {
      resolveWithFullResponse: true,
      json: true,
    });
    //console.log(JSON.stringify(result.body));
    t.ok(result.statusCode === 200 && 
      result.body.phonenumbers.length === 1 && result.body.applications.length === 1, 'retrieves test number and application');

    /* update user name */
    result = await request.put(`/Users/foobar`, {
      resolveWithFullResponse: true,
      json: true,
      simple: false,
      auth: authUser,
      body: {
        name: 'Jane Doe'
      }
    });
    t.ok(result.statusCode === 403, 'rejects attempt to update different user');

    /* update user name */
    result = await request.put(`/Users/${user_sid}`, {
      resolveWithFullResponse: true,
      json: true,
      auth: authUser,
      body: {
        name: 'Jane Doe'
      }
    });
    t.ok(result.statusCode === 204, 'updates user name');
    
    /* update password */
    result = await request.put(`/Users/${user_sid}`, {
      resolveWithFullResponse: true,
      json: true,
      auth: authUser,
      body: {
        old_password: 'fiddlesticks',
        new_password: 'foobarbazzle'
      }
    });
    t.ok(result.statusCode === 204, 'updates user password');

    /* update email */
    result = await request.put(`/Users/${user_sid}`, {
      resolveWithFullResponse: true,
      json: true,
      auth: authUser,
      body: {
        email: 'janedoe@gmail.com',
        email_activation_code: '39877'
      }
    });
    t.ok(result.statusCode === 204, 'updates email address');

    /* successfully validate the new email */
    result = await request.put('/ActivationCode/39877', {
      resolveWithFullResponse: true,
      auth: authUser,
      json: true,
      body: {
        user_sid,
        type: 'email'
      }
    });
    t.ok(result.statusCode === 204, 'successfully validated the new email address');

    /* add api keys */
    await createApiKey(request, account_sid);
    await createApiKey(request, account_sid);

    /* retrieve my own user info */
    result = await request.get(`/Users/me`, {
      resolveWithFullResponse: true,
      json: true,
      auth: authUser,
    });
    //console.log(result.body);
    t.ok(result.statusCode === 200, 'successfully retrieved my own user details');

    /* sign in with new email and password */
    result = await request.post('/signin', {
      resolveWithFullResponse: true,
      auth: authUser,
      json: true,
      body: {
        email: 'janedoe@gmail.com',
        password: 'foobarbazzle'
      }
    });
    //console.log(result.body);
    t.ok(result.statusCode === 200 && result.body.user_sid === user_sid, 'successfully signed in with changed email and password');

    /* logout */
    result = await request.post('/logout', {
      resolveWithFullResponse: true,
      auth: authUser,
      json: true,
      body: {
        email: 'janedoe@gmail.com',
        password: 'foobarbazzle'
      }
    });
    //console.log(result.body);
    t.ok(result.statusCode === 204, 'successfully logged out');
    await sleepFor(1200);

    /* using old jwt fails */
    result = await request.get(`/Users/me`, {
      resolveWithFullResponse: true,
      simple: false,
      auth: authUser,
    });
    //console.log(result.body);
    t.ok(result.statusCode === 401, 'fails using jwt after logout');

    /* sign in again */
    result = await request.post('/signin', {
      resolveWithFullResponse: true,
      auth: authUser,
      json: true,
      body: {
        email: 'janedoe@gmail.com',
        password: 'foobarbazzle'
      }
    });
    //console.log(result.body);
    t.ok(result.statusCode === 200 && result.body.user_sid === user_sid, 'successfully signed in again');  
    authUser = {bearer: result.body.jwt};

    /* new jwt works */
    result = await request.get(`/Users/me`, {
      resolveWithFullResponse: true,
      json: true,
      auth: authUser,
    });
    //console.log(result.body);
    t.ok(result.statusCode === 200, 'new jwt works');

    /* can not delete a voip_carrier that is not associated to my account */
    result = await request.delete('/VoipCarriers/5145b436-2f38-4029-8d4c-fd8c67831c7a', {
      resolveWithFullResponse: true,
      auth: authUser,
      simple: false
    });
    t.ok(result.statusCode === 422, 'fails to delete a voip_carrier not associated with users account');
    
    /* add a BYOC carrier 
       Note: no need to supply account_sid, it will be assigned based on the jwt
    */    
    result = await request.post('/VoipCarriers', {
      resolveWithFullResponse: true,
      auth: authUser,
      json: true,
      body: {
        name: 'BYCO1',
      }
    });
    t.ok(result.statusCode === 201 && result.body.sid, 'succesfully created BYOC carrier');
    const carrier_sid = result.body.sid;

    /* add a sip gateway to the carrier */
    result = await request.post('/SipGateways', {
      resolveWithFullResponse: true,
      auth: authUser,
      json: true,
      body: {
        voip_carrier_sid: carrier_sid,
        ipv4: '192.168.1.1',
        inbound: true,
        outbound: true
      }
    });
    t.ok(result.statusCode === 201, 'successfully created sip gateway for BYOC carrier');
    const gateway_sid = result.body.sid;

    /* update sip gateway  */
    result = await request.put(`/SipGateways/${gateway_sid}`, {
      resolveWithFullResponse: true,
      auth: authUser,
      json: true,
      body: {
        port: 5080
      }
    });
    t.ok(result.statusCode === 204, 'successfully updated sip gateway for BYOC carrier');

    /* delete sip gateway  */
    result = await request.delete(`/SipGateways/${gateway_sid}`, {
      resolveWithFullResponse: true,
      auth: authUser,
    });
    t.ok(result.statusCode === 204, 'successfully deleted sip gateway for BYOC carrier');

    /* delete account */
    result = await request.delete(`/Accounts/${account_sid}`, {
      resolveWithFullResponse: true,
      auth: authUser,
    });
    t.ok(result.statusCode === 204, 'successfully deleted account');

    /* create a new user/account using same email/password */
    result = await request.post('/register', {
      resolveWithFullResponse: true,
      json: true,
      body: {
        service_provider_sid: theOneAndOnlyServiceProviderSid,
        provider: 'local',
        name: 'Joe User',
        email: 'joe@user.com',
        password: 'fiddlesticks',
        email_activation_code: code
      }
    });
    //console.log(result.body);
    t.ok(result.statusCode === 200 && result.body.pristine === true &&
       !result.body.is_active && result.body.root_domain === 'sip.yakeeda.com', 
      'successfully created a user and account and got jwt using email validation');

  }
  catch (err) {
    console.error(err);
    t.end(err);
  }
});

