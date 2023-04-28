const test = require('tape');
const request = require("request-promise-native").defaults({
  baseUrl: "http://127.0.0.1:3000/v1",
});

let authAdmin;
let admin_user_sid;
let sp_sid;
let sp_user_sid;
let account_sid;
let account_sid2;
let account_user_sid;
let account_user_sid2;

const password = "12345foobar";
const adminEmail = "joe@foo.bar";
const emailInactiveAccount = 'inactive-account@example.com';
const emailInactiveUser = 'inactive-user@example.com';

test('forgot password - prepare', async (t) => {
  /* login as admin to get a jwt */
  let result = await request.post("/login", {
    resolveWithFullResponse: true,
    json: true,
    body: {
      username: "admin",
      password: "admin",
    },
  });
  t.ok(
    result.statusCode === 200 && result.body.token,
    "successfully logged in as admin"
  );
  authAdmin = { bearer: result.body.token };
  admin_user_sid = result.body.user_sid;

  /* add a service provider */
  result = await request.post("/ServiceProviders", {
    resolveWithFullResponse: true,
    auth: authAdmin,
    json: true,
    body: {
      name: "sp" + Date.now(),
    },
  });
  t.ok(result.statusCode === 201, "successfully created service provider");
  sp_sid = result.body.sid;

  /* add service_provider user */
  const randomNumber = Math.floor(Math.random() * 101);
  result = await request.post(`/Users`, {
    resolveWithFullResponse: true,
    json: true,
    auth: authAdmin,
    body: {
      name: "service_provider" + Date.now(),
      email: `sp${randomNumber}@example.com`,
      is_active: true,
      force_change: true,
      initial_password: password,
      service_provider_sid: sp_sid,
    },
  });
  t.ok(
    result.statusCode === 201 && result.body.user_sid,
    "service_provider scope user created"
  );
  sp_user_sid = result.body.user_sid;

  /* add an account - inactive */
  result = await request.post("/Accounts", {
    resolveWithFullResponse: true,
    auth: authAdmin,
    json: true,
    body: {
      name: "sample_account inactive" + Date.now(),
      service_provider_sid: sp_sid,
      registration_hook: {
        url: "http://example.com/reg",
        method: "get",
      },
      is_active: false,
      webhook_secret: "foobar",
    },
  });
  t.ok(result.statusCode === 201, "successfully created account");
  account_sid = result.body.sid;

  /* add an account - inactive */
  result = await request.post("/Accounts", {
    resolveWithFullResponse: true,
    auth: authAdmin,
    json: true,
    body: {
      name: "sample_account active" + Date.now(),
      service_provider_sid: sp_sid,
      registration_hook: {
        url: "http://example.com/reg",
        method: "get",
      },
      is_active: true,
      webhook_secret: "foobar",
    },
  });
  t.ok(result.statusCode === 201, "successfully created account");
  account_sid2 = result.body.sid;

  /* add account user connected to an inactive account */
  result = await request.post(`/Users`, {
    resolveWithFullResponse: true,
    json: true,
    auth: authAdmin,
    body: {
      name: "account user active - inactive account" + randomNumber,
      email: emailInactiveAccount,
      is_active: true,
      force_change: true,
      initial_password: password,
      service_provider_sid: sp_sid,
      account_sid: account_sid,
    },
  });
  t.ok(
    result.statusCode === 201 && result.body.user_sid,
    "account scope user created"
  );
  account_user_sid = result.body.user_sid;

  /* add account user that is not active */
  result = await request.post(`/Users`, {
    resolveWithFullResponse: true,
    json: true,
    auth: authAdmin,
    body: {
      name: "account user inactive - active account" + randomNumber,
      email: emailInactiveUser,
      is_active: false,
      force_change: true,
      initial_password: password,
      service_provider_sid: sp_sid,
      account_sid: account_sid2,
    },
  });
  t.ok(
    result.statusCode === 201 && result.body.user_sid,
    "account scope user created"
  );
  account_user_sid2 = result.body.user_sid;
});

test('forgot password with valid email', async (t) => {
  const res = await request
    .post('/forgot-password',
      {
        resolveWithFullResponse: true,
        json: true,
        auth: authAdmin,
        body: { email: adminEmail }
      });

  t.equal(res.statusCode, 204, 'returns 204 status code');
  t.end();
});

test('forgot password with invalid email', async (t) => {
  const statusCode = 400;
  const errorMessage = 'invalid or missing email';
  const email = 'invalid-email';

  try {
    await request
      .post('/forgot-password', {
        resolveWithFullResponse: true,
        json: true,
        auth: authAdmin,
        body: { email }
      });
  } catch (error) {
    t.throws(
      () => {
        throw error;
      },
      {
        name: "StatusCodeError",
        statusCode,
        message: `${statusCode} - {"error":"${errorMessage}"}`,
      }
    );
  }
  t.end();
});

test('forgot password with non-existent email', async (t) => {
  const statusCode = 400;
  const errorMessage = 'email does not exist';
  const email = 'non-existent-email@example.com';

  try {
    await request
      .post('/forgot-password', {
        resolveWithFullResponse: true,
        json: true,
        auth: authAdmin,
        body: { email }
      });
  } catch (error) {
    t.throws(
      () => {
        throw error;
      },
      {
        name: "StatusCodeError",
        statusCode,
        message: `${statusCode} - {"error":"${errorMessage}"}`,
      }
    );
  }
  t.end();
});

test('forgot password with inactive user', async (t) => {
  const statusCode = 400;
  const errorMessage = 'you may not reset the password of an inactive user';

  try {
    await request
      .post('/forgot-password', {
        resolveWithFullResponse: true,
        json: true,
        auth: authAdmin,
        body: { email: emailInactiveUser }
      });
  } catch (error) {
    t.throws(
      () => {
        throw error;
      },
      {
        name: "StatusCodeError",
        statusCode,
        message: `${statusCode} - {"error":"${errorMessage}"}`,
      }
    );
  }
  t.end();
});

test('forgot password with inactive account', async (t) => {
  const statusCode = 400;
  const errorMessage = 'you may not reset the password of an inactive account';
  try {
    await request
      .post('/forgot-password', {
        resolveWithFullResponse: true,
        json: true,
        auth: authAdmin,
        body: { email: emailInactiveAccount }
      });
  } catch (error) {
    t.throws(
      () => {
        throw error;
      },
      {
        name: "StatusCodeError",
        statusCode,
        message: `${statusCode} - {"error":"${errorMessage}"}`,
      }
    );
  }
  t.end();
});


test('cleanup', async (t) => {
  /* login as admin to get a jwt */
  let result = await request.post("/login", {
    resolveWithFullResponse: true,
    json: true,
    body: {
      username: "admin",
      password: "admin",
    },
  });
  t.ok(
    result.statusCode === 200 && result.body.token,
    "successfully logged in as admin"
  );
  authAdmin = { bearer: result.body.token };

  /* list users */
  result = await request.get(`/Users`, {
    resolveWithFullResponse: true,
    json: true,
    auth: authAdmin,
  });
  const users = result.body;

  /* delete all users except admin */
  for (const user of users) {
    if (user.user_sid === admin_user_sid) continue;
    result = await request.delete(`/Users/${user.user_sid}`, {
      resolveWithFullResponse: true,
      json: true,
      auth: authAdmin,
    });
    t.ok(result.statusCode === 204, "user deleted");
  }

  /* list accounts */
  result = await request.get(`/Accounts`, {
    resolveWithFullResponse: true,
    json: true,
    auth: authAdmin,
  });
  const accounts = result.body;  
  for (const acc of accounts) {    
    result = await request.delete(`/Accounts/${acc.account_sid}`, {
      resolveWithFullResponse: true,
      json: true,
      auth: authAdmin,
    });
    t.ok(result.statusCode === 204, "acc deleted");
  }
});