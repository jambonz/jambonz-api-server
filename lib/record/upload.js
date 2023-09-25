const Account = require('../models/account');
const Websocket = require('ws');
const PCMToMP3Encoder = require('./encoder');
const wav = require('wav');
const { getUploader } = require('./utils');

async function upload(logger, socket) {
  socket._recvInitialMetadata = false;
  socket.on('message', async function(data, isBinary) {
    try {
      if (!isBinary && !socket._recvInitialMetadata) {
        socket._recvInitialMetadata = true;
        logger.debug(`initial metadata: ${data}`);
        const obj = JSON.parse(data.toString());
        logger.info({ obj }, 'received JSON message from jambonz');
        const { sampleRate, accountSid, callSid, direction, from, to,
          callId, applicationSid, originatingSipIp, originatingSipTrunkName } = obj;
        const account = await Account.retrieve(accountSid);
        if (account && account.length && account[0].bucket_credential) {
          const obj = account[0].bucket_credential;
          // add tags to metadata
          const metadata = {
            accountSid,
            callSid,
            direction,
            from,
            to,
            callId,
            applicationSid,
            originatingSipIp,
            originatingSipTrunkName,
            sampleRate: `${sampleRate}`
          };
          if (obj.tags && obj.tags.length) {
            obj.tags.forEach((tag) => {
              metadata[tag.Key] = tag.Value;
            });
          }
          // create S3 path
          const day = new Date();
          let key = `${day.getFullYear()}/${(day.getMonth() + 1).toString().padStart(2, '0')}`;
          key += `/${day.getDate().toString().padStart(2, '0')}/${callSid}.${account[0].record_format}`;

          // Uploader
          const uploadStream = getUploader(key, metadata, obj, logger);
          if (!uploadStream) {
            logger.info('There is no available record uploader, close the socket.');
            socket.close();
          }

          /**encoder */
          let encoder;
          if (account[0].record_format === 'wav') {
            encoder = new wav.Writer({ channels: 2, sampleRate, bitDepth: 16 });
          } else {
            // default is mp3
            encoder = new PCMToMP3Encoder({
              channels: 2,
              sampleRate: sampleRate,
              bitrate: 128
            }, logger);
          }
          const handleError = (err, streamType) => {
            logger.error(
              { err },
              `Error while streaming for vendor: ${obj.vendor}, pipe: ${streamType}: ${err.message}`
            );
          };

          /* start streaming data */
          const duplex = Websocket.createWebSocketStream(socket);
          duplex
            .on('error', (err) => handleError(err, 'duplex'))
            .pipe(encoder)
            .on('error', (err) => handleError(err, 'encoder'))
            .pipe(uploadStream)
            .on('error', (err) => handleError(err, 'uploadStream'));

        } else {
          logger.info(`account ${accountSid} does not have any bucket credential, close the socket`);
          socket.close();
        }
      }
    } catch (err) {
      logger.error({ err, data }, 'error parsing message during connection');
    }
  });
  socket.on('error', function(err) {
    logger.error({ err }, 'record upload: error');
  });
  socket.on('close', (data) => {
    logger.info({ data }, 'record upload: close');
  });
  socket.on('end', function(err) {
    logger.error({ err }, 'record upload: socket closed from jambonz');
  });
}

module.exports = upload;
