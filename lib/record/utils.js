const AzureStorageUploadStream = require('./azure-storage');
const GoogleStorageUploadStream = require('./google-storage');
const S3MultipartUploadStream = require('./s3-multipart-upload-stream');

const getUploader = (key, metadata, bucket_credential, logger) => {
  const uploaderOpts = {
    bucketName: bucket_credential.name,
    Key: key,
    metadata
  };
  try {
    switch (bucket_credential.vendor) {
      case 'aws_s3':
        uploaderOpts.bucketCredential = {
          credentials: {
            accessKeyId: bucket_credential.access_key_id,
            secretAccessKey: bucket_credential.secret_access_key,
          },
          region: bucket_credential.region || 'us-east-1'
        };
        return new S3MultipartUploadStream(logger, uploaderOpts);
      case 's3_compatible':
        uploaderOpts.bucketCredential = {
          endpoint: bucket_credential.endpoint,
          credentials: {
            accessKeyId: bucket_credential.access_key_id,
            secretAccessKey: bucket_credential.secret_access_key,
          },
          region: bucket_credential.s3_compatible_region || 'us-east-1',
          forcePathStyle: true
        };
        return new S3MultipartUploadStream(logger, uploaderOpts);
      case 'google':
        const serviceKey = JSON.parse(bucket_credential.service_key);
        uploaderOpts.bucketCredential = {
          projectId: serviceKey.project_id,
          credentials: {
            client_email: serviceKey.client_email,
            private_key: serviceKey.private_key
          }
        };
        return new GoogleStorageUploadStream(logger, uploaderOpts);
      case 'azure':
        uploaderOpts.connection_string = bucket_credential.connection_string;
        return new AzureStorageUploadStream(logger, uploaderOpts);
      default:
        logger.error(`unknown bucket vendor: ${bucket_credential.vendor}`);
        break;
    }
  } catch (err) {
    logger.error(`Error creating uploader, vendor: ${bucket_credential.vendor}, reason: ${err.message}`);
  }
  return null;
};

module.exports = {
  getUploader
};
