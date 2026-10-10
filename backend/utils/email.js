// Sending email through any SMTP server (SMTP_URL). When it isn't configured,
// isEnabled() is false and callers show links in the app instead.
const nodemailer = require('nodemailer')
const config = require('./config')
const logger = require('./logger')

let transport = config.SMTP_URL ? nodemailer.createTransport(config.SMTP_URL) : null

const isEnabled = () => Boolean(transport)

// For tests: replace the transport, e.g. with { sendMail: async (message) => ... }.
const setTransport = (replacement) => {
  transport = replacement
}

// The address links in emails point to: APP_URL, or where the request came in.
const appUrl = (request) => config.APP_URL || `${request.protocol}://${request.get('host')}`

// Sends a message; returns true when sent. A failure is logged, not thrown, so
// the action that triggered the email (e.g. an invitation) still succeeds.
const send = async ({ to, subject, text }) => {
  if (!transport) return false
  try {
    await transport.sendMail({ from: config.EMAIL_FROM, to, subject, text })
    return true
  } catch (error) {
    logger.error(`Sending email failed: ${error.message}`)
    return false
  }
}

// Message texts by language (the bar's language, 'en' or 'fi').
const TEMPLATES = {
  invite: {
    en: ({ name, barName, url, days }) => ({
      subject: `You're invited to the ${barName} work schedule`,
      text: `Hi ${name},\n\nYou've been added to the work schedule of ${barName}. Open this link to set your password and see your shifts:\n\n${url}\n\nThe link works for ${days} days.\n`
    }),
    fi: ({ name, barName, url, days }) => ({
      subject: `Kutsu: ${barName} – työvuorot`,
      text: `Hei ${name},\n\nSinut on lisätty baarin ${barName} työvuoroihin. Avaa tämä linkki, aseta salasana ja näet vuorosi:\n\n${url}\n\nLinkki on voimassa ${days} päivää.\n`
    })
  },
  passwordReset: {
    en: ({ name, url, minutes }) => ({
      subject: 'Reset your work schedule password',
      text: `Hi ${name},\n\nSomeone asked to reset the password of your work schedule account. To choose a new password, open this link:\n\n${url}\n\nThe link works for ${minutes} minutes and only once. If it wasn't you, you can ignore this email.\n`
    }),
    fi: ({ name, url, minutes }) => ({
      subject: 'Työvuorojen salasanan vaihto',
      text: `Hei ${name},\n\nTyövuorotilisi salasanan vaihtoa on pyydetty. Valitse uusi salasana avaamalla tämä linkki:\n\n${url}\n\nLinkki toimii ${minutes} minuuttia ja vain kerran. Jos et pyytänyt vaihtoa, voit jättää tämän viestin huomiotta.\n`
    })
  }
}

const message = (template, locale, values) => (TEMPLATES[template][locale] ?? TEMPLATES[template].en)(values)

module.exports = { isEnabled, setTransport, appUrl, send, message }
