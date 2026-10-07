// @ts-check
// The myWorkSchedule project website: home page and documentation.
// Published on GitHub Pages at https://harautia.github.io/myWorkSchedule/
import { defineConfig } from 'astro/config'
import starlight from '@astrojs/starlight'

const REPO = 'https://github.com/harautia/myWorkSchedule'

export default defineConfig({
  site: 'https://harautia.github.io',
  base: '/myWorkSchedule',
  integrations: [
    starlight({
      title: 'myWorkSchedule',
      description: 'Open-source work schedules for bars: plan the week, publish it, and every employee sees their shifts on their phone.',
      logo: { src: './src/assets/logo.png', alt: '' },
      favicon: '/favicon.png',
      social: [{ icon: 'github', label: 'GitHub', href: REPO }],
      editLink: { baseUrl: `${REPO}/edit/master/website/` },
      lastUpdated: true,
      sidebar: [
        {
          label: 'Self-hosting',
          items: [
            { label: 'Install with Docker', slug: 'self-hosting/install' },
            { label: 'Configuration', slug: 'self-hosting/configuration' },
            { label: 'Upgrades and backups', slug: 'self-hosting/upgrading' }
          ]
        },
        {
          label: 'Project',
          items: [
            { label: 'Contributing', slug: 'project/contributing' },
            { label: 'Architecture', slug: 'project/architecture' },
            { label: 'FAQ', slug: 'project/faq' },
            { label: 'Changelog', link: `${REPO}/blob/master/CHANGELOG.md` },
            { label: 'Specification', link: `${REPO}/blob/master/docs/SPECIFICATION.md` },
            { label: 'Trademark policy', link: `${REPO}/blob/master/TRADEMARK.md` }
          ]
        }
      ]
    })
  ]
})
