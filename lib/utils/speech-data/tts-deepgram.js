const TtsDeepgramLanguagesVoiceRaw = require('./tts-model-deepgram');

const languagesVoices = [];

TtsDeepgramLanguagesVoiceRaw.forEach((data) => {
  const lang = languagesVoices.find((l) => {
    return l.value === data.locale;
  });

  if (!lang) {
    languagesVoices.push({
      value: data.locale,
      name: data.localeName,
      voices: TtsDeepgramLanguagesVoiceRaw
        .filter((d) => {
          return d.locale === data.locale;
        })
        .map((d) => {
          return {
            value: d.value,
            name: `${d.name}`,
          };
        }),
    });
  }
});

module.exports = languagesVoices;
