import fs from 'node:fs'
import path from 'node:path'
import YAML from 'yaml'
import { paths } from './paths.mjs'

export const SLUG_PATTERN = /^\d{8}\d{2}$/

/** MDX ファイルを frontmatter と本文に分ける */
export function splitFrontmatter(source) {
	const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(source)
	if (!match) throw new Error('frontmatter がありません')
	return { data: YAML.parse(match[1]) ?? {}, body: match[2] }
}

export function loadPosts(root) {
	const dir = paths(root).blog
	if (!fs.existsSync(dir)) return []
	return fs
		.readdirSync(dir)
		.filter((name) => /\.mdx?$/.test(name))
		.sort()
		.map((name) => {
			const file = path.join(dir, name)
			const { data, body } = splitFrontmatter(fs.readFileSync(file, 'utf8'))
			return { slug: name.replace(/\.mdx?$/, ''), file, data, body }
		})
}

/** その日 (YYYYMMDD) の次の slug。既存は YYYYMMDDNN */
export function nextSlug(compactDate, existingSlugs) {
	const used = existingSlugs
		.filter((slug) => slug.startsWith(compactDate) && SLUG_PATTERN.test(slug))
		.map((slug) => Number(slug.slice(8)))
	const next = (used.length ? Math.max(...used) : 0) + 1
	if (next > 99) throw new Error(`${compactDate} の記事が多すぎます`)
	return `${compactDate}${String(next).padStart(2, '0')}`
}

/** TS ソースの `export const NAME = [ '...', ... ]` から文字列配列を取り出す (サイト側の定義を正とするため) */
export function extractStringArray(source, constName) {
	const match = new RegExp(`export const ${constName}\\s*=\\s*\\[([\\s\\S]*?)\\]`).exec(source)
	if (!match) throw new Error(`${constName} が見つかりません`)
	const items = [...match[1].matchAll(/'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1] ?? m[2])
	if (items.length === 0) throw new Error(`${constName} が空です`)
	return items
}

/** サイトのスキーマ定義 (カテゴリ・形式・CTA・アフィリエイトのホスト) を読む */
export function loadSiteEnums(root) {
	const p = paths(root)
	const config = fs.readFileSync(p.contentConfig, 'utf8')
	return {
		categories: extractStringArray(fs.readFileSync(p.categories, 'utf8'), 'CATEGORIES'),
		formats: extractStringArray(config, 'FORMATS'),
		ctas: extractStringArray(config, 'CTA_VARIANTS'),
		affiliateHosts: extractStringArray(fs.readFileSync(p.affiliate, 'utf8'), 'AFFILIATE_HOSTS')
	}
}

export function loadRules(root) {
	return YAML.parse(fs.readFileSync(paths(root).rules, 'utf8'))
}

export const normalizeTitle = (title) =>
	String(title ?? '')
		.normalize('NFKC')
		.toLowerCase()
		.replace(/[\s\p{P}\p{S}]+/gu, '')
