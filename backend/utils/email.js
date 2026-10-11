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
  verifyEmail: {
    en: ({ name, barName, url, days }) => ({
      subject: 'Confirm your email for the work schedule',
      text: `Hi ${name},\n\nWelcome to myWorkSchedule! ${barName} is ready. Open this link to confirm your email address, so you can invite your staff:\n\n${url}\n\nThe link works for ${days} days. If you didn't sign up, you can ignore this email.\n`
    }),
    fi: ({ name, barName, url, days }) => ({
      subject: 'Vahvista sähköpostiosoitteesi työvuoroihin',
      text: `Hei ${name},\n\nTervetuloa myWorkScheduleen! ${barName} on valmis. Vahvista sähköpostiosoitteesi avaamalla tämä linkki, niin voit kutsua henkilökuntasi:\n\n${url}\n\nLinkki on voimassa ${days} päivää. Jos et rekisteröitynyt, voit jättää tämän viestin huomiotta.\n`
    })
  },
  // Billing of the hosted service (BILL-07). Receipts come from Stripe.
  trialEnding: {
    en: ({ name, barName, date, url }) => ({
      subject: `Your ${barName} trial ends on ${date}`,
      text: `Hi ${name},\n\nThe free trial of ${barName} ends on ${date}. After that your card is charged automatically and your schedule keeps working as before.\n\nTo change your plan or cancel, log in and open Billing:\n\n${url}\n`
    }),
    fi: ({ name, barName, date, url }) => ({
      subject: `${barName}: kokeilujakso päättyy ${date}`,
      text: `Hei ${name},\n\nBaarin ${barName} ilmainen kokeilujakso päättyy ${date}. Sen jälkeen korttiasi veloitetaan automaattisesti, ja työvuorot toimivat kuten ennenkin.\n\nVoit vaihtaa tilausta tai perua sen kirjautumalla sisään ja avaamalla Laskutus-sivun:\n\n${url}\n`
    })
  },
  paymentFailed: {
    en: ({ name, barName, url }) => ({
      subject: `Payment failed for ${barName}`,
      text: `Hi ${name},\n\nWe couldn't charge your card for the ${barName} work schedule. We'll try again over the next days. If the payment doesn't go through, the schedule becomes read-only.\n\nTo update your card, log in and open Billing:\n\n${url}\n`
    }),
    fi: ({ name, barName, url }) => ({
      subject: `${barName}: maksu epäonnistui`,
      text: `Hei ${name},\n\nBaarin ${barName} työvuorojen maksua ei voitu veloittaa kortiltasi. Yritämme uudelleen lähipäivinä. Jos maksu ei onnistu, työvuorot muuttuvat vain luettaviksi.\n\nVoit päivittää korttisi kirjautumalla sisään ja avaamalla Laskutus-sivun:\n\n${url}\n`
    })
  },
  readOnly: {
    en: ({ name, barName, lockDate, deletionDate, url }) => ({
      subject: `${barName} is now read-only`,
      text: `Hi ${name},\n\nThe subscription of ${barName} has ended, so the work schedule is now read-only: everyone can still see it, but it can't be changed.\n\nOn ${lockDate} it will be locked, and on ${deletionDate} its data will be deleted. To keep using it, log in, open Billing and subscribe again:\n\n${url}\n`
    }),
    fi: ({ name, barName, lockDate, deletionDate, url }) => ({
      subject: `${barName}: työvuorot ovat nyt vain luettavissa`,
      text: `Hei ${name},\n\nBaarin ${barName} tilaus on päättynyt, joten työvuorot ovat nyt vain luettavissa: kaikki näkevät ne yhä, mutta niitä ei voi muuttaa.\n\n${lockDate} ne lukitaan, ja ${deletionDate} tiedot poistetaan. Jatkaaksesi kirjaudu sisään, avaa Laskutus-sivu ja tilaa uudelleen:\n\n${url}\n`
    })
  },
  locked: {
    en: ({ name, barName, deletionDate, url }) => ({
      subject: `${barName} is now locked`,
      text: `Hi ${name},\n\nThe work schedule of ${barName} is now locked because its subscription ended. Its data will be deleted on ${deletionDate}.\n\nTo get it back, log in and subscribe again:\n\n${url}\n`
    }),
    fi: ({ name, barName, deletionDate, url }) => ({
      subject: `${barName}: työvuorot on lukittu`,
      text: `Hei ${name},\n\nBaarin ${barName} työvuorot on nyt lukittu, koska tilaus päättyi. Tiedot poistetaan ${deletionDate}.\n\nSaat ne takaisin kirjautumalla sisään ja tilaamalla uudelleen:\n\n${url}\n`
    })
  },
  deletionSoon: {
    en: ({ name, barName, deletionDate, url }) => ({
      subject: `${barName}: data will be deleted on ${deletionDate}`,
      text: `Hi ${name},\n\nThe data of ${barName} (employees, shifts and accounts) will be permanently deleted on ${deletionDate}, because its subscription ended.\n\nTo keep it, log in and subscribe again before then:\n\n${url}\n`
    }),
    fi: ({ name, barName, deletionDate, url }) => ({
      subject: `${barName}: tiedot poistetaan ${deletionDate}`,
      text: `Hei ${name},\n\nBaarin ${barName} tiedot (työntekijät, vuorot ja tilit) poistetaan pysyvästi ${deletionDate}, koska tilaus päättyi.\n\nSäilyttääksesi ne kirjaudu sisään ja tilaa uudelleen ennen sitä:\n\n${url}\n`
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
