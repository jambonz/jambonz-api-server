const formData = require('form-data');
const Mailgun = require('mailgun.js');
const mailgun = new Mailgun(formData);
const validateEmail = (email) => {
  // eslint-disable-next-line max-len
  const re = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return re.test(email);
};

const emailSimpleText = async(logger, to, subject, text) => {
  const mg = mailgun.client({
    username: 'api',
    key: process.env.MAILGUN_API_KEY
  });
  if (!process.env.MAILGUN_API_KEY) throw new Error('MAILGUN_API_KEY env variable is not defined!');
  if (!process.env.MAILGUN_DOMAIN) throw new Error('MAILGUN_DOMAIN env variable is not defined!');

  try {
    const res = await mg.messages.create(process.env.MAILGUN_DOMAIN, {
      from: 'jambonz Support <support@jambonz.org>',
      to,
      subject,
      text
    });
    logger.debug({res}, 'sent email');
  } catch (err) {
    logger.info({err}, 'Error sending email');
  }
};

module.exports = {
  validateEmail,
  emailSimpleText
};
