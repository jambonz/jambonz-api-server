const { Writable } = require('stream');
const {
  S3Client,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
} = require('@aws-sdk/client-s3');

class S3MultipartUploadStream extends Writable {
  constructor(logger, opts) {
    super(opts);
    this.logger = logger;
    this.bucketName = opts.bucketName;
    this.objectKey = opts.Key;
    this.uploadId = null;
    this.partNumber = 1;
    this.multipartETags = [];
    // accumulate incoming chunks to avoid O(n^2) Buffer.concat on every write
    this.chunks = [];
    this.bufferedBytes = 0;
    this.minPartSize = 5 * 1024 * 1024; // 5 MB
    this.s3 = new S3Client(opts.bucketCredential);
    this.metadata = opts.metadata;
  }

  async _initMultipartUpload() {
    const command = new CreateMultipartUploadCommand({
      Bucket: this.bucketName,
      Key: this.objectKey,
      Metadata: this.metadata
    });
    const response = await this.s3.send(command);
    return response.UploadId;
  }

  async _uploadPart(bodyBuffer) {
    const uploadPartCommand = new UploadPartCommand({
      Bucket: this.bucketName,
      Key: this.objectKey,
      PartNumber: this.partNumber,
      UploadId: this.uploadId,
      Body: bodyBuffer,
    });

    const uploadPartResponse = await this.s3.send(uploadPartCommand);
    this.multipartETags.push({
      ETag: uploadPartResponse.ETag,
      PartNumber: this.partNumber,
    });
    this.partNumber += 1;
  }

  async _write(chunk, encoding, callback) {
    try {
      if (!this.uploadId) {
        this.uploadId = await this._initMultipartUpload();
      }

      // accumulate without concatenating on every write
      this.chunks.push(chunk);
      this.bufferedBytes += chunk.length;

      if (this.bufferedBytes >= this.minPartSize) {
        const partBuffer = Buffer.concat(this.chunks, this.bufferedBytes);
        // reset accumulators before awaiting upload to allow GC
        this.chunks = [];
        this.bufferedBytes = 0;
        await this._uploadPart(partBuffer);
      }

      callback(null);
    } catch (error) {
      callback(error);
    }
  }

  async _finalize(err) {
    try {
      if (this.bufferedBytes > 0) {
        const finalBuffer = Buffer.concat(this.chunks, this.bufferedBytes);
        this.chunks = [];
        this.bufferedBytes = 0;
        await this._uploadPart(finalBuffer);
      }

      const completeMultipartUploadCommand = new CompleteMultipartUploadCommand({
        Bucket: this.bucketName,
        Key: this.objectKey,
        MultipartUpload: {
          Parts: this.multipartETags.sort((a, b) => a.PartNumber - b.PartNumber),
        },
        UploadId: this.uploadId,
      });

      await this.s3.send(completeMultipartUploadCommand);
      this.logger.info('Finished upload to S3');
    } catch (error) {
      this.logger.error('Error completing multipart upload:', error);
      throw error;
    }
  }

  async _final(callback) {
    try {
      await this._finalize();
      callback(null);
    } catch (error) {
      callback(error);
    }
  }
}

module.exports = S3MultipartUploadStream;
