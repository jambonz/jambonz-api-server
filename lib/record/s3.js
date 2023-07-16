const Account = require('../models/account');
const Websocket = require('ws');
const PCMToMP3Encoder = require('./encoder');
const S3MultipartUploadStream = require('./s3-multipart-upload-stream');
const wav = require('wav');

async function upload(logger, socket) {

  socket._recvInitialMetadata = false;
  socket.on('message', async function(data, isBinary) {
    try {
      if (!isBinary && !socket._recvInitialMetadata) {
        socket._recvInitialMetadata = true;
        logger.debug(`initial metadata: ${data}`);
        const obj = JSON.parse(data.toString());
        logger.info({obj}, 'received JSON message from jambonz');
        const {sampleRate, accountSid, callSid, direction, from, to,
          callId, applicationSid, originatingSipIp, originatingSipTrunkName} = obj;
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
          let Key = `${day.getFullYear()}/${(day.getMonth() + 1).toString().padStart(2, '0')}`;
          Key += `/${day.getDate().toString().padStart(2, '0')}/${callSid}.${account[0].record_format}`;

          // Uploader
          const uploaderOpts = {
            bucketName: obj.name,
            Key,
            metadata,
            bucketCredential: {
              credentials: {
                accessKeyId: obj.access_key_id,
                secretAccessKey: obj.secret_access_key,
              },
              region: obj.region || 'us-east-1'
            }
          };
          const uploadStream = new S3MultipartUploadStream(logger, uploaderOpts);

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
            });
          }
          /* start streaming data */
          const duplex = Websocket.createWebSocketStream(socket);
          duplex.pipe(encoder).pipe(uploadStream);
        } else {
          logger.info(`account ${accountSid} does not have any bucket credential, close the socket`);
          socket.close();
        }
      }
    } catch (err) {
      logger.error({err, data}, 'error parsing message during connection');
    }
  });
  socket.on('error', function(err) {
    logger.error({err}, 'aws upload: error');
  });
  socket.on('close', (data) => {
    logger.info({data}, 'aws_s3: close');
  });
  socket.on('end', function(err) {
    logger.error({err}, 'aws upload: socket closed from jambonz');
  });
}

module.exports = upload;
