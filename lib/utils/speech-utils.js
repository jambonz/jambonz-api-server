const ttsGoogle = require('@google-cloud/text-to-speech');
const sttGoogle = require('@google-cloud/speech').v1p1beta1;
const Polly = require('aws-sdk/clients/polly');
const AWS = require('aws-sdk');
const { Deepgram } = require('@deepgram/sdk');
const sdk = require('microsoft-cognitiveservices-speech-sdk');
const bent = require('bent');
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

const testDeepgramStt = async(logger, credentials) => {
  const {api_key} = credentials;
  const deepgram = new Deepgram(api_key);

  const mimetype = 'audio/wav';
  const source = {
    buffer: fs.readFileSync(`${__dirname}/../../data/test_audio.wav`),
    mimetype: mimetype
  };

  return new Promise((resolve, reject) => {
    // Send the audio to Deepgram and get the response
    deepgram.transcription
      .preRecorded(source, {punctuate: true})
      .then((response) => {
        //logger.debug({response}, 'got transcript');
        if (response?.results?.channels[0]?.alternatives?.length > 0) resolve(response);
        else reject(new Error('no transcript returned'));
        return;
      })
      .catch((err) => {
        logger.info({err}, 'failed to get deepgram transcript');
        reject(err);
      });
  });
};

const testMicrosoftStt = async(logger, credentials) => {
  const {api_key, region} = credentials;

  const speechConfig = sdk.SpeechConfig.fromSubscription(api_key, region);
  const audioConfig = sdk.AudioConfig.fromWavFileInput(fs.readFileSync(`${__dirname}/../../data/test_audio.wav`));
  speechConfig.speechRecognitionLanguage = 'en-US';
  const speechRecognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);

  return new Promise((resolve, reject) => {
    speechRecognizer.recognizeOnceAsync((result) => {
      switch (result.reason) {
        case sdk.ResultReason.RecognizedSpeech:
          resolve();
          break;
        case sdk.ResultReason.NoMatch:
          reject('Speech could not be recognized.');
          break;
        case sdk.ResultReason.Canceled:
          const cancellation = sdk.CancellationDetails.fromResult(result);
          logger.info(`CANCELED: Reason=${cancellation.reason}`);
          if (cancellation.reason == sdk.CancellationReason.Error) {
            logger.info(`CANCELED: ErrorCode=${cancellation.ErrorCode}`);
            logger.info(`CANCELED: ErrorDetails=${cancellation.errorDetails}`);
          }
          reject(cancellation.reason);
          break;
      }
      speechRecognizer.close();
    });
  });
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

const testMicrosoftTts = async(logger, credentials) => {
  const {
    api_key,
    region,
    // eslint-disable-next-line no-unused-vars
    use_custom_tts,
    // eslint-disable-next-line no-unused-vars
    custom_tts_endpoint,
    // eslint-disable-next-line no-unused-vars
    use_custom_stt,
    // eslint-disable-next-line no-unused-vars
    custom_stt_endpoint
  } = credentials;

  logger.info({
    api_key,
    region,
    use_custom_tts,
    custom_tts_endpoint,
    use_custom_stt,
    custom_stt_endpoint
  }, 'testing microsoft tts');
  if (!api_key) throw new Error('testMicrosoftTts: credentials are missing api_key');
  if (!region) throw new Error('testMicrosoftTts: credentials are missing region');
  try {
    const getJSON = bent('json', {
      'Ocp-Apim-Subscription-Key': api_key
    });
    const response = await getJSON(`https://${region}.tts.speech.microsoft.com/cognitiveservices/voices/list`);
    return response;
  } catch (err) {
    logger.info({err}, `testMicrosoftTts - failed to list voices for region ${region}`);
    throw err;
  }
};

const testWellSaidTts = async(logger, credentials) => {
  const {api_key} = credentials;
  try {
    const post = bent('https://api.wellsaidlabs.com', 'POST', 'buffer', {
      'X-Api-Key': api_key,
      'Accept': 'audio/mpeg',
      'Content-Type': 'application/json'
    });
    const mp3 = await post('/v1/tts/stream', {
      text: 'Hello, world',
      speaker_id: '3'
    });
    return mp3;
  } catch (err) {
    logger.info({err}, 'testWellSaidTts returned error');
    throw err;
  }
};

const testWellSaidStt = async(logger, credentials) => {
  //TODO
  return true;
};

module.exports = {
  testGoogleTts,
  testGoogleStt,
  testAwsTts,
  testWellSaidTts,
  testAwsStt,
  testMicrosoftTts,
  testMicrosoftStt,
  testWellSaidStt,
  testDeepgramStt
};
