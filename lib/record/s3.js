const Account = require('../models/account');
const Websocket = require('ws');
const S3Stream = require('s3-upload-stream');
const aws = require('aws-sdk');
const PCMToMP3Encoder = require('./encoder');

async function upload(logger, socket) {

  socket.on('message', async function(data, isBinary) {
    try {
      if (!isBinary) {
        const obj = JSON.parse(data.toString());
        logger.info({obj}, 'received JSON message from jambonz');
        const {sampleRate, accountSid, callSid} = obj;
        const account = await Account.retrieve(accountSid);
        if (account && account.length && account[0].bucket_credential) {
          const obj = account[0].bucket_credential;
          const s3 = new aws.S3({
            accessKeyId: obj.access_key_id,
            secretAccessKey: obj.secret_access_key,
            region: obj.region || 'us-east-1'
          });
          const Metadata = {
            accountSid,
            callSid,
            sampleRate: `${sampleRate}`
          };
          if (obj.tags && obj.tags.length) {
            obj.tags.forEach((tag) => {
              Metadata[tag.Key] = tag.Value;
            });
          }
          const day = new Date();
          const s3Stream = new S3Stream(s3);
          let Key = `${day.getFullYear()}/${(day.getMonth() + 1).toString().padStart(2, '0')}`;
          Key += `/${day.getDate().toString().padStart(2, '0')}/${callSid}.wav`;
          socket.upload =  s3Stream.upload({
            Bucket: obj.name,
            Key,
            ContentType: `audio/wav;rate=${sampleRate};channels=2`,
            Metadata
          });
          socket.upload.on('error', function(err) {
            logger.error({err}, `Error uploading audio to ${process.env.RECORD_BUCKET}`);
          });

          /* start streaming data */
          const encoder = new PCMToMP3Encoder({
            channels: 2,
            sampleRate: sampleRate,
            bitrate: 128
          });
          const duplex = Websocket.createWebSocketStream(socket);
          duplex.pipe(encoder).pipe(socket.upload);
        } else {
          logger.info(`account ${accountSid} does not have any bucket credential, close the socket`);
          socket.close();
        }
      }
    } catch (err) {
      logger.error({err}, 'error parsing message during connection');
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
