const ttsGoogle = require('@google-cloud/text-to-speech');
const sttGoogle = require('@google-cloud/speech').v1p1beta1;
const Polly = require('aws-sdk/clients/polly');
const AWS = require('aws-sdk');
const fs = require('fs');

const testGoogleTts = async(logger, credentials) => {
  const client = new ttsGoogle.TextToSpeechClient({credentials});
  await client.listVoices();
};

const testGoogleStt = async(logger, credentials) => {
  const client = new sttGoogle.SpeechClient({credentials});
  const config = {
    sampleRateHertz: 8000,
    languageCode: 'en-US',
    model: 'default',
  };
  const audio = {
    content: fs.readFileSync(`${__dirname}/../../data/test_audio.wav`).toString('base64'),
  };
  const request = {
    config: config,
    audio: audio,
  };

  // Detects speech in the audio file
  const [response] = await client.recognize(request);
  if (!Array.isArray(response.results) || 0 === response.results.length) {
    throw new Error('failed to transcribe speech');
  }
};

const testAwsTts = (logger, credentials) => {
  const polly = new Polly(credentials);
  return new Promise((resolve, reject) => {
    polly.describeVoices({LanguageCode: 'en-US'}, (err, data) => {
      if (err) return reject(err);
      resolve();
    });
  });
};

const testAwsStt = (logger, credentials) => {
  const transcribeservice = new AWS.TranscribeService(credentials);
  return new Promise((resolve, reject) => {
    transcribeservice.listVocabularies((err, data) => {
      if (err) return reject(err);
      logger.info({data}, 'retrieved language models');
      resolve();
    });
  });
};

module.exports = {
  testGoogleTts,
  testGoogleStt,
  testAwsTts,
  testAwsStt
};
