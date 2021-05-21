if (!process.env.JAMBONZ_HOSTING) return;

const bent = require('bent');
const crypto = require('crypto');
const assert = require('assert');
const domains = new Map();
const debug = require('debug')('jambonz:api-server');

const checkAsserts = () => {
  assert.ok(process.env.DME_API_KEY, 'missing env DME_API_KEY for dns operations');
  assert.ok(process.env.DME_API_SECRET, 'missing env DME_API_SECRET for dns operations');
  assert.ok(process.env.DME_BASE_URL, 'missing env DME_BASE_URL for dns operations');
};

const createAuthHeaders = () => {
  const now = (new Date()).toUTCString();
  const hash = crypto.createHmac('SHA1', process.env.DME_API_SECRET);
  hash.update(now);
  return {
    'x-dnsme-apiKey': process.env.DME_API_KEY,
    'x-dnsme-requestDate': now,
    'x-dnsme-hmac': hash.digest('hex')
  };
};

const getDnsDomainId = async(logger, name) => {
  checkAsserts();
  const headers = createAuthHeaders();
  const get = bent(process.env.DME_BASE_URL, 'GET', 'json', headers);
  try {
    const result = await get('/dns/managed');
    debug(result, 'getDnsDomainId: all domains');
    if (Array.isArray(result.data)) {
      const domain = result.data.find((o) => o.name === name);
      if (domain) return domain.id;
      debug(`getDnsDomainId: failed to find domain ${name}`);
    }
  } catch (err) {
    logger.error({err}, 'Error retrieving domains');
  }
};

/**
 * Add the DNS records for a given subdomain
 * We will add an A record and an SRV record for each SBC public IP address
 * Note: this assumes we have manually added DNS A records:
 *    sbc01.root.domain, sbc0.root.domain, etc to dnsmadeeasy
 */
const createDnsRecords = async(logger, domain, name, value, ttl = 3600) => {
  checkAsserts();
  try {
    if (!domains.has(domain)) {
      const domainId = await getDnsDomainId(logger, domain);
      if (!domainId) return false;
      domains.set(domain, domainId);
    }
    const domainId = domains.get(domain);

    value = Array.isArray(value) ? value : [value];
    const a_records = value.map((v) => {
      return {
        type: 'A',
        gtdLocation: 'DEFAULT',
        name,
        value: v,
        ttl
      };
    });
    const srv_records = [
      {
        type: 'SRV',
        gtdLocation: 'DEFAULT',
        name: `_sip._udp.${name}`,
        value: `${name}`,
        port: 5060,
        priority: 10,
        weight: 100,
        ttl
      }
    ];
    const headers = createAuthHeaders();
    const records = [...a_records, ...srv_records];
    const post = bent(process.env.DME_BASE_URL, 'POST', 201, 400, headers);
    logger.debug({records}, 'Attemting to create dns records');
    const res = await post(`/dns/managed/${domainId}/records/createMulti`,
      [...a_records, ...srv_records]);

    if (201 === res.statusCode) {
      const str = await res.text();
      return JSON.parse(str);
    }
    logger.error({res}, 'Error creating records');
  } catch (err) {
    logger.error({err}, 'Error retrieving domains');
  }
};

const deleteDnsRecords = async(logger, domain, recIds) => {
  checkAsserts();
  const headers = createAuthHeaders();
  const del = bent(process.env.DME_BASE_URL, 'DELETE', 200, headers);
  try {
    if (!domains.has(domain)) {
      const domainId = await getDnsDomainId(logger, domain);
      if (!domainId) return false;
      domains.set(domain, domainId);
    }
    const domainId = domains.get(domain);
    const url = `/dns/managed/${domainId}/records?${recIds.map((r) => `ids=${r}`).join('&')}`;
    await del(url);
    return true;
  } catch (err) {
    console.error(err);
    logger.error({err}, 'Error deleting records');
  }
};


module.exports = {
  getDnsDomainId,
  createDnsRecords,
  deleteDnsRecords
};
