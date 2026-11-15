import rss from '@astrojs/rss'
import type { APIContext } from 'astro'
import { siteConfig } from '@/site-config'
import { getPosts } from '@/utils'

export async function GET(context: APIContext) {
	const posts = await getPosts()
	return rss({
		title: siteConfig.title,
		description: siteConfig.description,
		site: context.site!,
		items: posts.map((post) => ({
			title: post.data.title,
			description: post.data.description,
			pubDate: post.data.pubDate,
			categories: [post.data.category, ...post.data.tags],
			link: `/post/${post.slug}/`
		})),
		customData: `<language>${siteConfig.lang}</language>`
	})
}
