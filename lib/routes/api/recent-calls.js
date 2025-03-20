const router = require('express').Router();
const sysError = require('../error');
const {DbErrorBadRequest} = require('../../utils/errors');
const {getHomerApiKey, getHomerSipTrace, getHomerPcap} = require('../../utils/homer-utils');
const {getJaegerTrace} = require('../../utils/jaeger-utils');
const Account = require('../../models/account');
const { CloudWatchLogsClient, FilterLogEventsCommand } = require('@aws-sdk/client-cloudwatch-logs');
const {
  getS3Object,
  getGoogleStorageObject,
  getAzureStorageObject,
  deleteS3Object,
  deleteGoogleStorageObject,
  deleteAzureStorageObject
} = require('../../utils/storage-utils');

const parseAccountSid = (url) => {
  const arr = /Accounts\/([^\/]*)/.exec(url);
  if (arr) return arr[1];
};

const parseServiceProviderSid = (url) => {
  const arr = /ServiceProviders\/([^\/]*)/.exec(url);
  if (arr) return arr[1];
};

router.get('/', async(req, res) => {
  const {logger, queryCdrs, queryCdrsSP} = req.app.locals;
  try {
    logger.debug({opts: req.query}, 'GET /RecentCalls');
    const account_sid = parseAccountSid(req.originalUrl);
    const service_provider_sid = account_sid ? null : parseServiceProviderSid(req.originalUrl);
    const {page, count, trunk, direction, days, answered, start, end, filter} = req.query || {};
    if (!page || page < 1) throw new DbErrorBadRequest('missing or invalid "page" query arg');
    if (!count || count > 500) throw new DbErrorBadRequest('missing or invalid "count" query arg');

    if (account_sid) {
      const data = await queryCdrs({
        account_sid,
        page,
        page_size: count,
        trunk,
        direction,
        days,
        answered,
        start: days ? undefined : start,
        end: days ? undefined : end,
        filter
      });
      res.status(200).json(data);
    }
    else {
      const data = await queryCdrsSP({
        service_provider_sid,
        page,
        page_size: count,
        trunk,
        direction,
        days,
        answered,
        start: days ? undefined : start,
        end: days ? undefined : end,
        filter
      });
      res.status(200).json(data);
    }
  } catch (err) {
    sysError(logger, res, err);
  }
});

router.get('/:call_id', async(req, res) => {
  const {logger} = req.app.locals;
  try {
    const token = await getHomerApiKey(logger);
    if (!token) return res.sendStatus(400, {msg: 'Failed to get Homer API token; check server config'});
    const obj = await getHomerSipTrace(logger, token, req.params.call_id);
    if (!obj) {
      logger.info(`/RecentCalls: unable to get sip traces from Homer for ${req.params.call_id}`);
      return res.sendStatus(404);
    }
    res.status(200).json(obj);
  } catch (err) {
    logger.error({err}, '/RecentCalls error retrieving sip traces from homer');
    res.sendStatus(err.statusCode || 500);
  }
});

router.get('/:call_id/:method/pcap', async(req, res) => {
  const {logger} = req.app.locals;
  try {
    const token = await getHomerApiKey(logger);
    if (!token) return res.sendStatus(400, {msg: 'getHomerApiKey: Failed to get Homer API token; check server config'});
    const stream = await getHomerPcap(logger, token, [req.params.call_id], req.params.method);
    if (!stream) {
      logger.info(`getHomerApiKey: unable to get sip traces from Homer for ${req.params.call_id}`);
      return res.sendStatus(404);
    }
    res.set({
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename=callid-${req.params.call_id}.pcap`
    });
    stream.pipe(res);
  } catch (err) {
    logger.error({err}, 'getHomerApiKey error retrieving sip traces from homer');
    res.sendStatus(err.statusCode || 500);
  }
});

router.get('/:call_sid/logs', async(req, res) => {
  const {logger, queryCdrs} = req.app.locals;
  const aws_region = process.env.AWS_REGION;
  const {call_sid} = req.params;
  const {logGroupName = 'jambonz-feature_server'} = req.query;
  const account_sid = parseAccountSid(req.originalUrl);
  if (!aws_region) {
    return res.status(400).send({msg: 'Logs are only available in AWS environments'});
  }
  if (!account_sid) {
    return res.status(400).send({msg: 'account_sid is required,' +
      'please use /Accounts/{account_sid}/RecentCalls/{call_sid}/logs'});
  }
  try {
    //find back the call in CDR to get timestame of the call
    // this allow us limit search in cloudwatch logs
    const data = await queryCdrs({
      account_sid,
      filter: call_sid,
      page: 0,
      page_size: 50
    });
    if (!data || data.data.length === 0) {
      return res.status(404).send({msg: 'Call not found'});
    }

    const {
      attempted_at, //2025-02-24T13:11:51.969Z
      terminated_at, //2025-02-24T13:11:56.153Z
      sip_callid
    } = data.data[0];
    const TIMEBUFFER = 60; //60 seconds
    const startTime = new Date(attempted_at).getTime() - TIMEBUFFER * 1000;
    const endTime = new Date(terminated_at).getTime() + TIMEBUFFER * 1000;
    const client = new CloudWatchLogsClient({ region: aws_region });
    let params = {
      logGroupName,
      startTime,
      endTime,
      filterPattern: `{ ($.callSid = "${call_sid}") || ($.callId = "${sip_callid}") }`
    };
    const command = new FilterLogEventsCommand(params);
    const response = await client.send(command);
    // if response have nextToken, we need to fetch all logs
    while (response.nextToken) {
      params = {
        ...params,
        nextToken: response.nextToken
      };
      const command = new FilterLogEventsCommand(params);
      const response2 = await client.send(command);
      response.events = response.events.concat(response2.events);
      response.nextToken = response2.nextToken;
    }
    let logs = [];
    if (response.events && response.events.length > 0) {
      logs = response.events.map((e) => e.message);
    }
    res.status(200).json(logs);
  } catch (err) {
    logger.error({err}, 'Cannot fetch logs from cloudwatch');
    res.status(500).send({msg: err.message});
  }
});

router.get('/trace/:trace_id', async(req, res) => {
  const {logger} = req.app.locals;
  const {trace_id} = req.params;
  try {
    const obj = await getJaegerTrace(logger, trace_id);
    if (!obj) {
      logger.info(`/RecentCalls: unable to get spans from jaeger for ${trace_id}`);
      return res.sendStatus(404);
    }
    res.status(200).json(obj.result);
  } catch (err) {
    logger.error({err}, `/RecentCalls error retrieving jaeger trace ${trace_id}`);
    res.sendStatus(500);
  }
});

router.get('/:call_sid/record/:year/:month/:day/:format', async(req, res) => {
  const {logger} = req.app.locals;
  const {call_sid, year, month, day, format} = req.params;

  try {
    const account_sid = parseAccountSid(req.originalUrl);
    const r = await Account.retrieve(account_sid);
    if (r.length === 0 || !r[0].bucket_credential) return res.sendStatus(404);
    const {bucket_credential} = r[0];
    const getOptions  = {
      ...bucket_credential,
      key: `${year}/${month}/${day}/${call_sid}.${format || 'mp3'}`
    };
    let stream;
    switch (bucket_credential.vendor) {
      case 'aws_s3':
      case 's3_compatible':
        stream = await getS3Object(logger, getOptions);
        break;
      case 'google':
        stream = await getGoogleStorageObject(logger, getOptions);
        break;
      case 'azure':
        stream = await getAzureStorageObject(logger, getOptions);
        break;
      default:
        logger.error(`There is no handler for fetching record from ${bucket_credential.vendor}`);
        return res.sendStatus(500);
    }
    res.set({
      'Content-Type': `audio/${format || 'mp3'}`
    });
    if (stream) {
      stream.pipe(res);
    } else {
      return res.sendStatus(404);
    }
  }  catch (err) {
    logger.error({err}, ` error retrieving recording ${call_sid}`);
    res.sendStatus(404);
  }
});

router.delete('/:call_sid/record/:year/:month/:day/:format', async(req, res) => {
  const {logger} = req.app.locals;
  const {call_sid, year, month, day, format} = req.params;

  try {
    const account_sid = parseAccountSid(req.originalUrl);
    const r = await Account.retrieve(account_sid);
    if (r.length === 0 || !r[0].bucket_credential) return res.sendStatus(404);
    const {bucket_credential} = r[0];

    const deleteOptions  = {
      ...bucket_credential,
      key: `${year}/${month}/${day}/${call_sid}.${format || 'mp3'}`
    };

    switch (bucket_credential.vendor) {
      case 'aws_s3':
      case 's3_compatible':
        await deleteS3Object(logger, deleteOptions);
        break;
      case 'google':
        await deleteGoogleStorageObject(logger, deleteOptions);
        break;
      case 'azure':
        await deleteAzureStorageObject(logger, deleteOptions);
        break;
      default:
        logger.error(`There is no handler for deleting record from ${bucket_credential.vendor}`);
        return res.sendStatus(500);
    }
    res.sendStatus(204);
  }  catch (err) {
    logger.error({err}, ` error deleting recording ${call_sid}`);
    res.sendStatus(404);
  }
});

module.exports = router;
