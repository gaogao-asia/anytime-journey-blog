import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

/** root を差し替えられるようにして、テストでは一時ディレクトリを使う */
export function paths(root = ROOT) {
	return {
		root,
		blog: path.join(root, 'src/content/blog'),
		calendar: path.join(root, 'editorial/calendar.yaml'),
		rules: path.join(root, 'editorial/rules.yaml'),
		used: path.join(root, 'editorial/used-topics.json'),
		social: path.join(root, 'editorial/social'),
		note: path.join(root, 'editorial/note'),
		categories: path.join(root, 'src/data/categories.ts'),
		contentConfig: path.join(root, 'src/content/config.ts'),
		affiliate: path.join(root, 'src/utils/affiliate.ts')
	}
}

export const DEFAULT_SITE_URL = 'https://anytimejourney.netlify.app'

export function siteUrl(env = process.env) {
	return (env.SITE_URL || DEFAULT_SITE_URL).replace(/\/+$/, '')
}

export function postUrl(slug, env = process.env) {
	return `${siteUrl(env)}/post/${slug}/`
}
