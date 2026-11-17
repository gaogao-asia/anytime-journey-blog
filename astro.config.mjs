import { defineConfig } from 'astro/config'
import mdx from '@astrojs/mdx'
import sitemap from '@astrojs/sitemap'
import tailwind from '@astrojs/tailwind'
import { remarkReadingTime } from './src/utils/readTime.ts'
import { rehypeAffiliateLinks } from './src/utils/rehypeAffiliateLinks.ts'

// 公開URL。アプリの WebView が開く Netlify ドメインを既定とし、SITE_URL があれば優先する
const site = process.env.SITE_URL || 'https://anytimejourney.netlify.app'

// https://astro.build/config
export default defineConfig({
	site,
	markdown: {
		remarkPlugins: [remarkReadingTime],
		rehypePlugins: [rehypeAffiliateLinks],
		drafts: true,
		shikiConfig: {
			theme: 'material-theme-palenight',
			wrap: true
		}
	},
	integrations: [
		mdx({
			syntaxHighlight: 'shiki',
			shikiConfig: {
				experimentalThemes: {
					light: 'vitesse-light',
					dark: 'material-theme-palenight'
				},
				wrap: true
			},
			drafts: true
		}),
		sitemap(),
		tailwind()
	]
})
