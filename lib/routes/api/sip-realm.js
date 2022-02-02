const router = require('express').Router();
const {promisePool} = require('../../db');
const {DbErrorBadRequest} = require('../../utils/errors');
const {createDnsRecords, deleteDnsRecords} = require('../../utils/dns-utils');
const { v4: uuid } = require('uuid');
const sysError = require('../error');
const insertDnsRecords = `INSERT INTO dns_records 
(dns_record_sid, account_sid, record_type, record_id) 
VALUES  `;


router.post('/:sip_realm', async(req, res) => {
  const logger = req.app.locals.logger;
  const account_sid = req.user.account_sid;
  const sip_realm = req.params.sip_realm;
  try {
    const arr = /(.*)\.(.*\..*)$/.exec(sip_realm);
    if (!arr) throw new DbErrorBadRequest(`invalid sip_realm: ${sip_realm}`);
    const subdomain = arr[1];
    const domain = arr[2];

    /* update the account */
    const [r] = await promisePool.execute('UPDATE accounts set sip_realm = ? WHERE account_sid = ?',
      [sip_realm, account_sid]);
    if (r.affectedRows !== 1) throw new Error('failure updating accounts table with sip_realm value');

    if (process.env.NODE_ENV !== 'test' || process.env.DME_API_KEY) {
      /* update DNS provider */

      /* retrieve sbc addresses */
      const [sbcs] = await promisePool.query('SELECT ipv4 from sbc_addresses');
      if (sbcs.length === 0) throw new Error('no SBC addresses provisioned in the database!');
      const ips = sbcs.map((s) => s.ipv4);

      /* retrieve existing dns records */
      const [old_recs] = await promisePool.query('SELECT record_id from dns_records WHERE account_sid = ?',
        account_sid);

      if (old_recs.length > 0) {
        /* remove existing records from the database and dns provider */
        await promisePool.query('DELETE from dns_records WHERE account_sid = ?', account_sid);

        const deleted = await deleteDnsRecords(logger, domain, old_recs.map((r) => r.record_id));
        if (!deleted) {
          logger.error({old_recs, sip_realm, account_sid},
            'Failed to remove old dns records when changing sip_realm for account');
        }
      }

      /* add the dns records */
      const records = await createDnsRecords(logger, domain, subdomain, ips);
      if (!records) throw new Error(`failure updating dns records for ${sip_realm}`);
      const values = records.map((r) => {
        return `('${uuid()}', '${account_sid}', '${r.type}', ${r.id})`;
      }).join(',');
      const sql = `${insertDnsRecords}${values};`;
      const [result] = await promisePool.execute(sql);
      if (result.affectedRows != records.length) throw new Error('failed inserting dns records');
    }
    res.sendStatus(204);
  } catch (err) {
    sysError(logger, res, err);
  }
});


module.exports = router;
