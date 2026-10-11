// Facts about the hosted service, used by the pricing, contact and legal
// pages. Change them here only (spec LAND-06).
//
// PLACEHOLDERS: the operator's details and the app's address are not decided
// yet. Replace every value in [brackets] before the hosted service opens, and
// have the legal pages reviewed by a lawyer.
export const SERVICE = {
  // Where the hosted app runs; sign-up opens at `${appUrl}/?signup`.
  appUrl: 'https://app.example.com',

  operator: {
    name: '[Operator name]',
    businessId: '[Business ID (Y-tunnus)]',
    address: '[Street address, postcode, city, Finland]',
    email: '[contact@example.com]'
  },

  // Price of one bar, without VAT (D3).
  prices: { month: 10, year: 100 },
  currency: 'EUR',
  trialDays: 30,

  // After a subscription ends (D8), and after asking to delete a bar (DATA-02).
  readOnlyDays: 14,
  deleteAfterDays: 90,
  deletionGraceDays: 30,

  // Who processes data for the service (the subprocessors page).
  subprocessors: [
    {
      name: 'Stripe Payments Europe Ltd.',
      purpose: { en: 'Payments, invoices and VAT', fi: 'Maksut, laskut ja arvonlisävero' },
      location: { en: 'Ireland (EU); transfers to the US under the EU–US Data Privacy Framework', fi: 'Irlanti (EU); siirrot Yhdysvaltoihin EU:n ja Yhdysvaltojen tietosuojakehyksen perusteella' },
      url: 'https://stripe.com/privacy'
    },
    {
      name: '[Hosting provider]',
      purpose: { en: 'Servers and the database', fi: 'Palvelimet ja tietokanta' },
      location: { en: '[EU country]', fi: '[EU-maa]' },
      url: '[https://…]'
    },
    {
      name: '[Email delivery provider]',
      purpose: { en: 'Sending email (invitations, password reset, billing notices)', fi: 'Sähköpostien lähetys (kutsut, salasanan vaihto, laskutusviestit)' },
      location: { en: '[EU country]', fi: '[EU-maa]' },
      url: '[https://…]'
    },
    {
      name: 'Cloudflare, Inc.',
      purpose: { en: 'Bot check on the sign-up form (Turnstile)', fi: 'Bottitarkistus rekisteröitymislomakkeella (Turnstile)' },
      location: { en: 'Global network; EU Standard Contractual Clauses', fi: 'Maailmanlaajuinen verkko; EU:n vakiosopimuslausekkeet' },
      url: 'https://www.cloudflare.com/privacypolicy/'
    }
  ]
}

export const signupUrl = `${SERVICE.appUrl}/?signup`
