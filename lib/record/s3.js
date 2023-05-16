const Account = require('../models/account');
const { decrypt } = require('../utils/encrypt-decrypt');
const Websocket = require('ws');
const S3Stream = require('s3-upload-stream');
const aws = require('aws-sdk');

async function upload(logger, socket) {

  socket.on('message', async function(data, isBinary) {
    try {
      if (!isBinary) {
        const obj = JSON.parse(data.toString());
        logger.info({obj}, 'received JSON message from jambonz');
        const {sampleRate, accountSid, callSid} = obj;
        const account = await Account.retrieve(accountSid);
        if (account && account.length && account[0].bucket_credential) {
          const obj = JSON.parse(decrypt(account[0].bucket_credential));
          const s3 = new aws.S3({
            accessKeyId: obj.access_key_id,
            secretAccessKey: obj.secret_access_key,
            region: obj.region || 'us-east-1'
          });
          const day = new Date();
          const s3Stream = new S3Stream(s3);
          socket.upload =  s3Stream.upload({
            Bucket: obj.name,
            Key: `${day.getFullYear()}/${day.getMonth() + 1}/${day.getDate()}/${callSid}.raw`,
            ContentType: `audio/L16;rate=${sampleRate};channels=2`,
            Metadata: {
              accountSid,
              callSid,
              sampleRate
            }
          });
          socket.upload.on('error', function(err) {
            logger.error({err}, `Error uploading audio to ${process.env.RECORD_BUCKET}`);
          });

          /* start streaming data */
          const duplex = socket.duplex = Websocket.createWebSocketStream(socket);
          duplex.pipe(socket.upload);
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
    closeTargetStream(socket);
  });
  socket.on('end', function(err) {
    logger.error({err}, 'aws upload: socket closed from jambonz');
    closeTargetStream(socket);
  });
}

function closeTargetStream(socket) {
  if (socket.upload) {
    socket.upload.destroy();
  }
}

module.exports = upload;
