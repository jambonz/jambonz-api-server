const TtsAwsLanguagesVoiceRaw = require('./tts-microsoft-raw');

const languagesVoices = [];

TtsAwsLanguagesVoiceRaw.forEach((data) => {
  const lang = languagesVoices.find((l) => {
    return l.value === data.Locale;
  });

  if (!lang) {
    languagesVoices.push({
      value: data.Locale,
      name: data.LocaleName,
      voices: TtsAwsLanguagesVoiceRaw
        .filter((d) => {
          return d.Locale === data.Locale;
        })
        .map((d) => {
          return {
            value: d.ShortName,
            name: `${d.DisplayName} (${d.Gender})`,
          };
        }),
    });
  }
});

module.exports = languagesVoices;
