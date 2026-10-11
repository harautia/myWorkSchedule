// @ts-check
// The myWorkSchedule project website: home page, the hosted service's pages
// (pricing, contact, legal) and the documentation, in English and Finnish.
// Published on GitHub Pages at https://harautia.github.io/myWorkSchedule/
import { defineConfig } from 'astro/config'
import starlight from '@astrojs/starlight'
import { SERVICE, signupUrl } from './src/data/service.mjs'

const REPO = 'https://github.com/harautia/myWorkSchedule'
const SITE = 'https://harautia.github.io'
const BASE = '/myWorkSchedule'
const APP_URL = SERVICE.appUrl

export default defineConfig({
  site: SITE,
  base: BASE,
  integrations: [
    starlight({
      title: 'myWorkSchedule',
      description: 'Open-source work schedules for bars: plan the week, publish it, and every employee sees their shifts on their phone.',
      logo: { src: './src/assets/logo.png', alt: '' },
      favicon: '/favicon.png',
      // English at the root, Finnish under /fi/ (spec LAND-03). Pages not yet
      // translated show the English page with a notice.
      defaultLocale: 'root',
      locales: {
        root: { label: 'English', lang: 'en' },
        fi: { label: 'Suomi', lang: 'fi' }
      },
      // Social previews (Open Graph, spec LAND-04); Starlight adds the title,
      // description and a sitemap itself.
      head: [
        { tag: 'meta', attrs: { property: 'og:image', content: `${SITE}${BASE}/og-image.png` } },
        { tag: 'meta', attrs: { name: 'twitter:card', content: 'summary' } }
      ],
      social: [{ icon: 'github', label: 'GitHub', href: REPO }],
      editLink: { baseUrl: `${REPO}/edit/master/website/` },
      lastUpdated: true,
      sidebar: [
        {
          label: 'Hosted service',
          translations: { fi: 'Palvelu' },
          items: [
            { label: 'Pricing', translations: { fi: 'Hinnat' }, slug: 'pricing' },
            { label: 'Start free trial', translations: { fi: 'Aloita ilmainen kokeilu' }, link: signupUrl, attrs: { rel: 'noopener' } },
            { label: 'Log in', translations: { fi: 'Kirjaudu sisään' }, link: APP_URL, attrs: { rel: 'noopener' } },
            { label: 'Contact', translations: { fi: 'Yhteystiedot' }, slug: 'contact' }
          ]
        },
        {
          label: 'Self-hosting',
          translations: { fi: 'Oma asennus' },
          items: [
            { label: 'Install with Docker', translations: { fi: 'Asennus Dockerilla' }, slug: 'self-hosting/install' },
            { label: 'Configuration', translations: { fi: 'Asetukset' }, slug: 'self-hosting/configuration' },
            { label: 'Upgrades and backups', translations: { fi: 'Päivitykset ja varmuuskopiot' }, slug: 'self-hosting/upgrading' }
          ]
        },
        {
          label: 'Project',
          translations: { fi: 'Projekti' },
          items: [
            { label: 'Contributing', translations: { fi: 'Osallistu' }, slug: 'project/contributing' },
            { label: 'Architecture', translations: { fi: 'Arkkitehtuuri' }, slug: 'project/architecture' },
            { label: 'FAQ', translations: { fi: 'Usein kysyttyä' }, slug: 'project/faq' },
            { label: 'Changelog', translations: { fi: 'Muutosloki' }, link: `${REPO}/blob/master/CHANGELOG.md` },
            { label: 'Specification', translations: { fi: 'Määrittely' }, link: `${REPO}/blob/master/docs/SPECIFICATION.md` },
            { label: 'Trademark policy', translations: { fi: 'Tavaramerkkikäytäntö' }, link: `${REPO}/blob/master/TRADEMARK.md` }
          ]
        },
        {
          label: 'Legal',
          translations: { fi: 'Ehdot ja tietosuoja' },
          collapsed: true,
          items: [
            { label: 'Terms of service', translations: { fi: 'Käyttöehdot' }, slug: 'legal/terms' },
            { label: 'Privacy policy', translations: { fi: 'Tietosuojaseloste' }, slug: 'legal/privacy' },
            { label: 'Cookie policy', translations: { fi: 'Evästeet' }, slug: 'legal/cookies' },
            { label: 'Data processing agreement', translations: { fi: 'Tietojenkäsittelysopimus' }, slug: 'legal/dpa' },
            { label: 'Subprocessors', translations: { fi: 'Alihankkijat' }, slug: 'legal/subprocessors' }
          ]
        }
      ]
    })
  ]
})
