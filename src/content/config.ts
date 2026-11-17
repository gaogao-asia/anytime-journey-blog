import { defineCollection, z } from 'astro:content'
import { CATEGORIES } from '@/data/categories'

export const FORMATS = ['article', 'dialogue', 'visual', 'video'] as const
export const CTA_VARIANTS = [
	'habit',
	'crowd',
	'menu',
	'ai',
	'gym',
	'data',
	'beginner',
	'default'
] as const

const blog = defineCollection({
	// Type-check frontmatter using a schema
	schema: ({ image }) =>
		z.object({
			title: z.string().max(80),
			description: z.string(),
			// Transform string to Date object
			pubDate: z
				.string()
				.or(z.date())
				.transform((val) => new Date(val)),
			// 省略時は自動生成の OGP 画像 (/og/{slug}.png) をアイキャッチ兼 og:image に使う
			heroImage: image().optional(),
			category: z.enum(CATEGORIES),
			tags: z.array(z.string()),
			draft: z.boolean().default(false),
			// 記事の形式
			format: z.enum(FORMATS).default('article'),
			// true の記事は冒頭にプロモーション表記を自動表示する
			affiliate: z.boolean().default(false),
			// 記事末 CTA の訴求
			cta: z.enum(CTA_VARIANTS).default('default'),
			// AI 生成記事フラグ
			generated: z.boolean().default(false)
		})
})

export const collections = { blog }
