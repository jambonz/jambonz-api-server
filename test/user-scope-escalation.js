const test = require('tape');
const jwt = require('jsonwebtoken');
const {v4: uuid} = require('uuid');
const ADMIN_TOKEN = '38700987-c7a4-4685-a5bb-af378f9734de';
const authAdmin = {bearer: ADMIN_TOKEN};
const { createClient } = require('./http-client');
const request = createClient({
  baseUrl: 'http://127.0.0.1:3000/v1'
});
const {createServiceProvider, createAccount} = require('./utils');

const password = 'abcde12345-';
const sign = (claims) => ({bearer: jwt.sign(claims, process.env.JWT_SECRET, {expiresIn: '1h'})});
const opts = (auth, extra = {}) => ({auth, json: true, resolveWithFullResponse: true, simple: false, ...extra});
const login = async(username) => {
  const r = await request.post('/login', opts(undefined, {body: {username, password}}));
  return r.body?.token ? jwt.decode(r.body.token) : null;
};

/* an account-scoped principal must not be able to make, or take over, a more privileged user */
test('user scope escalation tests', async(t) => {
  require('../app');
  let result;
  try {
    const sp1 = await createServiceProvider(request, 'escalation-sp1');
    const sp2 = await createServiceProvider(request, 'escalation-sp2');
    const acc1 = await createAccount(request, sp1, 'escalation-acc1');
    const acc2 = await createAccount(request, sp2, 'escalation-acc2');

    /* an account api key, as the attacker had */
    const token = uuid();
    result = await request.post('/ApiKeys', opts(authAdmin, {body: {account_sid: acc1, token}}));
    t.ok(result.statusCode === 201, `created an account api key (${result.statusCode})`);
    const authAccKey = {bearer: result.body.token || token};

    /* POST /Users with an account key: the user lands in the key's account and SP, whatever the body says */
    result = await request.post('/Users', opts(authAccKey, {body: {
      name: 'escalation-u1', email: 'escalation-u1@example.com', initial_password: password,
      is_active: true, force_change: false,
      service_provider_sid: null, account_sid: acc2, scope: 'admin', email_validated: 1
    }}));
    t.ok(result.statusCode === 201, `account key can create a user in its account (${result.statusCode} ${JSON.stringify(result.body)})`);
    let claims = await login('escalation-u1');
    t.ok(claims && claims.scope === 'account' && claims.account_sid === acc1 && claims.service_provider_sid === sp1,
      'a user created with an account key signs in with account scope, not admin');

    /* PUT /Users: an account key may not set the password of a user outside its account */
    result = await request.post('/Users', opts(authAdmin, {body: {
      name: 'escalation-admin', email: 'escalation-admin@example.com', initial_password: password,
      is_active: true, force_change: false
    }}));
    const adminUserSid = result.body.user_sid;
    result = await request.put(`/Users/${adminUserSid}`, opts(authAccKey, {body: {initial_password: 'zyxwv98765-'}}));
    t.ok(result.statusCode === 403, `account key cannot set the password of an admin user (${result.statusCode})`);
    claims = await login('escalation-admin');
    t.ok(claims && claims.scope === 'admin', 'the admin user\'s password is unchanged');

    /* POST /Users with an SP token: only onto accounts that SP owns */
    const authSp1 = sign({service_provider_sid: sp1, scope: 'service_provider'});
    result = await request.post('/Users', opts(authSp1, {body: {
      name: 'escalation-u2', email: 'escalation-u2@example.com', initial_password: password,
      is_active: true, force_change: false, account_sid: acc2
    }}));
    t.ok(result.statusCode === 403, 'SP scope cannot create a user on another SP\'s account');

    /* ActivationCode: an account key may not point another user's email elsewhere */
    result = await request.post('/ActivationCode', opts(authAccKey, {body: {
      user_sid: adminUserSid, type: 'email', value: 'attacker@example.com', code: '123456'
    }}));
    t.ok(result.statusCode === 400, `account key cannot set an activation code for another user (${result.statusCode})`);

    t.end();
  }
  catch (err) {
    console.error(err);
    t.end(err);
  }
});
