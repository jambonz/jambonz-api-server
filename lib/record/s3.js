const s3Stream = require('s3-upload-stream');
const Account = require('../models/account');
const { decrypt } = require('../utils/encrypt-decrypt');
const { S3Client } = require('@aws-sdk/client-s3');

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
          const s3 = new S3Client({
            credentials: {
              accessKeyId: obj.access_key_id,
              secretAccessKey: obj.secret_access_key,
            },
            region: obj.region || 'us-east-1'
          });
          const uploadStream = require('s3-upload-stream')(s3);
          const day = new Date();
          socket.s3Stream = uploadStream({
            Bucket: obj.name,
            Key: `${day.getFullYear()}/${day.getMonth() + 1}/${day.getDate()}/${callSid}.raw`,
            ContentType: 'audio/pcm',
            Metadata: {
              accountSid,
              callSid,
              sampleRate
            }
          });
        } else {
          logger.info(`account ${accountSid} does not have any bucket credential, close the socket`);
          socket.close();
        }
      } else {
        if (socket.s3Stream) {
          s3Stream.write(data);
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
  if (socket.s3Stream) {
    socket.s3Stream.end();
  }
}

module.exports = upload;
