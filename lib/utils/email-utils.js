const formData = require('form-data');
const Mailgun = require('mailgun.js');
const mailgun = new Mailgun(formData);
const validateEmail = (email) => {
  // eslint-disable-next-line max-len
  const re = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return re.test(email);
};

const emailSimpleText = async(logger, to, subject, text) => {
  const from = 'jambonz Support <support@jambonz.org>';
  if (process.env.CUSTOM_EMAIL_VENDOR_URL) {
    await sendEmailByCustomVendor(logger, from, to, subject, text);
  } else {
    await sendEmailByMailgun(logger, from, to, subject, text);
  }

};

const sendEmailByCustomVendor = async(logger, from, to, subject, text) => {
  const response = await fetch(process.env.CUSTOM_EMAIL_VENDOR_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...((process.env.CUSTOM_EMAIL_VENDOR_USERNAME && process.env.CUSTOM_EMAIL_VENDOR_PASSWORD) &&
        ({
          'Authorization':`Basic ${Buffer.from(
            `${process.env.CUSTOM_EMAIL_VENDOR_USERNAME}:${process.env.CUSTOM_EMAIL_VENDOR_PASSWORD}`
          ).toString('base64')}`
        }))
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      text
    })
  });
  if (!response.ok) {
    logger.error({response}, 'Error sending email to custom vendor');
    return;
  }
  const res = await response.json();
  logger.debug({
    res
  }, 'sent email to custom vendor.');
};

const sendEmailByMailgun = async(logger, from, to, subject, text) => {
  if (!process.env.MAILGUN_API_KEY) throw new Error('MAILGUN_API_KEY env variable is not defined!');
  if (!process.env.MAILGUN_DOMAIN) throw new Error('MAILGUN_DOMAIN env variable is not defined!');

  const mg = mailgun.client({
    username: 'api',
    key: process.env.MAILGUN_API_KEY,
    ...(process.env.MAILGUN_URL && {url: process.env.MAILGUN_URL})
  });

  try {
    const res = await mg.messages.create(process.env.MAILGUN_DOMAIN, {
      from,
      to,
      subject,
      text
    });
    logger.debug({
      res
    }, 'sent email');
  } catch (err) {
    logger.info({
      err
    }, 'Error sending email From mailgun');
  }
};

module.exports = {
  validateEmail,
  emailSimpleText
};
