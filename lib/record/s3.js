const Account = require('../models/account');
const { decrypt } = require('../utils/encrypt-decrypt');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const Websocket = require('ws');
const stream = require('stream');

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
          const day = new Date();
          socket.s3Stream = new stream.PassThrough();
          const command = new PutObjectCommand({
            Bucket: obj.name,
            Key: `${day.getFullYear()}/${day.getMonth() + 1}/${day.getDate()}/${callSid}.raw`,
            ContentType: 'audio/pcm',
            Metadata: {
              accountSid,
              callSid,
              sampleRate
            },
            Body: socket.s3Stream
          });
          s3.send(command, (err, data) => {
            logger.info(`AWS S3 return Error: ${err} and Data ${data}`);
          });

          /* start streaming data */
          const duplex = socket.duplex = Websocket.createWebSocketStream(socket);
          duplex.pipe(socket.s3Stream);
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
  if (socket.s3Stream) {
    socket.s3Stream.destroy();
  }
}

module.exports = upload;
