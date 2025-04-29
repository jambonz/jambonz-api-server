module.exports = (() => {
  const voices = [
    { value: 'Magpie-Multilingual.EN-US.Female.Female-1', name: 'Female Magpie' },
    { value: 'Magpie-Multilingual.EN-US.Female.Calm', name: 'Female Calm' },
    { value: 'Magpie-Multilingual.EN-US.Female.Fearful', name: 'Female Fearful' },
    { value: 'Magpie-Multilingual.EN-US.Female.Happy', name: 'Female Happy' },
    { value: 'Magpie-Multilingual.EN-US.Female.Angry', name: 'Female Angry' },
    { value: 'Magpie-Multilingual.EN-US.Female.Neutral', name: 'Female Neutral' },
    { value: 'Magpie-Multilingual.EN-US.Male.Calm', name: 'Male Calm' },
    { value: 'Magpie-Multilingual.EN-US.Male.Fearful', name: 'Male Fearful' },
    { value: 'Magpie-Multilingual.EN-US.Male.Happy', name: 'Male Happy' },
    { value: 'Magpie-Multilingual.EN-US.Male.Neutral', name: 'Male Neutral' },
    { value: 'Magpie-Multilingual.EN-US.Male.Angry', name: 'Male Angry' },
    { value: 'Magpie-Multilingual.EN-US.Male.Disgusted', name: 'Male Disgusted' },
    { value: 'Magpie-Multilingual.EN-US.Male.Male-1', name: 'Male Magpie' },
    { value: 'Magpie-Multilingual.FR-FR.Male.Male-1', name: 'Male Magpie' },
    { value: 'Magpie-Multilingual.FR-FR.Female.Female-1', name: 'Female Magpie' },
    { value: 'Magpie-Multilingual.FR-FR.Female.Angry', name: 'Female Angry' },
    { value: 'Magpie-Multilingual.FR-FR.Female.Calm', name: 'Female Calm' },
    { value: 'Magpie-Multilingual.FR-FR.Female.Disgust', name: 'Female Disgust' },
    { value: 'Magpie-Multilingual.FR-FR.Female.Sad', name: 'Female Sad' },
    { value: 'Magpie-Multilingual.FR-FR.Female.Happy', name: 'Female Happy' },
    { value: 'Magpie-Multilingual.FR-FR.Female.Fearful', name: 'Female Fearful' },
    { value: 'Magpie-Multilingual.FR-FR.Female.Neutral', name: 'Female Neutral' },
    { value: 'Magpie-Multilingual.FR-FR.Male.Neutral', name: 'Male Neutral' },
    { value: 'Magpie-Multilingual.FR-FR.Male.Angry', name: 'Male Angry' },
    { value: 'Magpie-Multilingual.FR-FR.Male.Calm', name: 'Male Calm' },
    { value: 'Magpie-Multilingual.FR-FR.Male.Sad', name: 'Male Sad' },
    { value: 'Magpie-Multilingual.ES-US.Male.Male-1', name: 'Male Magpie' },
    { value: 'Magpie-Multilingual.ES-US.Female.Female-1', name: 'Female Magpie' },
    { value: 'Magpie-Multilingual.ES-US.Female.Neutral', name: 'Female Neutral' },
    { value: 'Magpie-Multilingual.ES-US.Male.Neutral', name: 'Male Neutral' },
    { value: 'Magpie-Multilingual.ES-US.Male.Angry', name: 'Male Angry' },
    { value: 'Magpie-Multilingual.ES-US.Female.Angry', name: 'Female Angry' },
    { value: 'Magpie-Multilingual.ES-US.Female.Happy', name: 'Female Happy' },
    { value: 'Magpie-Multilingual.ES-US.Male.Happy', name: 'Male Happy' },
    { value: 'Magpie-Multilingual.ES-US.Female.Calm', name: 'Female Calm' },
    { value: 'Magpie-Multilingual.ES-US.Male.Calm', name: 'Male Calm' },
    { value: 'Magpie-Multilingual.ES-US.Female.Pleasant_Surprise', name: 'Female Pleasant Surprise' },
    { value: 'Magpie-Multilingual.ES-US.Male.Pleasant_Surprise', name: 'Male Pleasant Surprise' },
    { value: 'Magpie-Multilingual.ES-US.Female.Sad', name: 'Female Sad' },
    { value: 'Magpie-Multilingual.ES-US.Male.Sad', name: 'Male Sad' },
    { value: 'Magpie-Multilingual.ES-US.Male.Disgust', name: 'Male Disgust' }
  ];

  return [
    {
      value: 'en-US',
      name: 'English',
      voices: [
        { value: 'English-US.Female-1', name: 'Female' },
        { value: 'English-US.Male-1', name: 'Male' },
        ...voices.filter((voice) => voice.value.includes('EN-US'))]
    },
    {
      value: 'fr-FR',
      name: 'French',
      voices: voices.filter((voice) => voice.value.includes('FR-FR'))
    },
    {
      value: 'es-US',
      name: 'Spanish',
      voices: voices.filter((voice) => voice.value.includes('ES-US'))
    }
  ];
})();
