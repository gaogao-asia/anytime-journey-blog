import type { APIRoute, GetStaticPaths } from 'astro'
import type { CollectionEntry } from 'astro:content'
import { getPosts } from '@/utils'
import { renderOgImage } from '@/utils/ogImage'

export const getStaticPaths: GetStaticPaths = async () => {
	const posts = await getPosts()
	return posts.map((post) => ({ params: { slug: post.slug }, props: { post } }))
}

export const GET: APIRoute = async ({ props }) => {
	const { data } = (props as { post: CollectionEntry<'blog'> }).post
	const png = await renderOgImage({ title: data.title, category: data.category })
	return new Response(png, { headers: { 'Content-Type': 'image/png' } })
}
