
const ADMIN_TOKEN = '38700987-c7a4-4685-a5bb-af378f9734de';
const authAdmin = {bearer: ADMIN_TOKEN};

async function createServiceProvider(request, name = 'daveh') {
  const result = await request.post('/ServiceProviders', {
    auth: authAdmin,
    json: true,
    body: {
      name
    }
  });
  return result.sid;
}

async function createVoipCarrier(request, name = 'daveh') {
  const result = await request.post('/VoipCarriers', {
    auth: authAdmin,
    json: true,
    body: {
      name
    }
  });
  return result.sid;
}

async function createPhoneNumber(request, voip_carrier_sid, number = '15083333456') {
  const result = await request.post('/PhoneNumbers', {
    auth: authAdmin,
    json: true,
    body: {
      number,
      voip_carrier_sid
    }
  });
  return result.sid;
}

async function createAccount(request, service_provider_sid, name = 'daveh') {
  const result = await request.post('/Accounts', {
    auth: authAdmin,
    json: true,
    body: {
      name,
      service_provider_sid
  }
  });
  return result.sid;
}

async function deleteObjectBySid(request, path, sid) {
  const result = await request.delete(`${path}/${sid}`, {
    auth: authAdmin,
  });
  return result;
}

module.exports = {
  createServiceProvider,
  createVoipCarrier,
  createPhoneNumber,
  createAccount,
  deleteObjectBySid
};
