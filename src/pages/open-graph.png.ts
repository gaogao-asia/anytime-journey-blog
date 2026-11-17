// サイト共通の既定 OGP 画像
import type { APIRoute } from 'astro'
import { siteConfig } from '@/data/site.config'
import { renderOgImage } from '@/utils/ogImage'

export const GET: APIRoute = async () => {
	const png = await renderOgImage({
		title: '自分で学べて、続けられる。ジム通いの習慣化を後押しするブログ',
		subtitle: siteConfig.title
	})
	return new Response(png, { headers: { 'Content-Type': 'image/png' } })
}
