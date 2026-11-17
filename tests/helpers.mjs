import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { ROOT } from '../scripts/lib/paths.mjs'
import { loadRules, loadSiteEnums } from '../scripts/lib/posts.mjs'

export const fixture = (name) => JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/fixtures', name), 'utf8'))

export const rules = loadRules(ROOT)
export const enums = loadSiteEnums(ROOT)

/** 設定ファイルとスキーマ定義だけをコピーした、記事が空の作業用リポジトリを作る */
export function makeTempRoot() {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blog-pipeline-'))
	for (const file of [
		'editorial/calendar.yaml',
		'editorial/rules.yaml',
		'src/data/categories.ts',
		'src/content/config.ts',
		'src/utils/affiliate.ts'
	]) {
		fs.mkdirSync(path.join(root, path.dirname(file)), { recursive: true })
		fs.copyFileSync(path.join(ROOT, file), path.join(root, file))
	}
	fs.mkdirSync(path.join(root, 'src/content/blog'), { recursive: true })
	return root
}

/** 検証に通る記事 1 本ぶんの bundle。overrides で一部を壊して使う */
export function validBundle(overrides = {}) {
	const draft = fixture('draft-habit.json')
	const base = {
		slug: '2026111601',
		frontmatter: {
			title: draft.title,
			description: draft.description,
			pubDate: '2026-11-16',
			category: '習慣化',
			tags: draft.tags,
			format: 'article',
			affiliate: false,
			cta: 'habit',
			generated: true,
			draft: false
		},
		body: draft.body_mdx,
		social: { text: draft.x_text, hashtags: draft.x_hashtags },
		note: { title: draft.note_title, body: draft.note_body }
	}
	return {
		...base,
		...overrides,
		frontmatter: { ...base.frontmatter, ...(overrides.frontmatter ?? {}) }
	}
}

export const ctx = (extra = {}) => ({ rules, enums, otherPosts: [], ...extra })
