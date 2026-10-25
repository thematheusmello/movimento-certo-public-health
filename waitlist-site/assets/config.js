// Page settings. Edit here and redeploy.
window.MC_CONFIG = {
  founderOpen: true,                       // true once the Stripe account takes live payments: the buttons then go to /api/checkout
  founderPrice: 'R$ 97',
  founderPriceValue: 97,                   // must match FOUNDER_PRICE_CENTS on the server (api/_lib/site.js)
  founderGoal: 50,                         // research of 8 Oct: ~1 in 3 odds at R$ 97 (100 was ~1 in 10)
  priceMonthly: 'R$ 29,90',                // planned prices after launch, shown as the anchor
  priceYearly: 'R$ 199,90',
  founderDeadline: '29 de novembro',
  founderDeadlineISO: '2026-11-29T23:59:59-03:00',
  showFoundersFrom: 10,                    // the live "X fundadores" bar appears from this many founders
  showWaitlistCountFrom: 50,               // "Já são X pessoas na lista" appears from this many signups
  launchEstimate: 'fevereiro de 2027',
  refundIfNoLaunchBy: '31 de março de 2027',
  existingBuyersAreFounders: true,         // people who paid R$ 97 on Thiago's current site become founders
  contactEmail: 'matheus@doozle.io',
  crefito: 'CREFITO-3 44558-F',                             // e.g. 'CREFITO-3 12345-F', shown in the footer when filled
  apiBase: '/api'
};
