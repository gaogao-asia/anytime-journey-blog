#!/usr/bin/env node
// リポジトリ内の記事を検証する (CI 用)。
//   全記事: frontmatter の基本チェックとタイトルの重複
//   自動生成記事 (generated: true): 本文・禁止表現・リンク・X 投稿文・note 原稿まで
//   node scripts/validate-posts.mjs [slug ...]   slug を渡すとその記事だけを詳しく検証する
import fs from 'node:fs'
import path from 'node:path'
import { ROOT, paths } from './lib/paths.mjs'
import { loadPosts, loadRules, loadSiteEnums } from './lib/posts.mjs'
import { parseNoteFile } from './lib/assemble.mjs'
import { validateBundle, validateCollection } from './lib/validate.mjs'

const only = process.argv.slice(2)
const p = paths(ROOT)
const posts = loadPosts(ROOT)
const ctx = { rules: loadRules(ROOT), enums: loadSiteEnums(ROOT), otherPosts: posts }

const errors = validateCollection(posts, ctx)
const missing = only.filter((slug) => !posts.some((post) => post.slug === slug))
errors.push(...missing.map((slug) => `${slug}: 記事がありません`))

const generated = posts.filter((post) => post.data.generated === true && (only.length === 0 || only.includes(post.slug)))
for (const post of generated) {
	const socialFile = path.join(p.social, `${post.slug}.json`)
	const noteFile = path.join(p.note, `${post.slug}.md`)
	let social
	if (fs.existsSync(socialFile)) {
		const sidecar = JSON.parse(fs.readFileSync(socialFile, 'utf8'))
		social = { text: sidecar.x?.text, hashtags: sidecar.x?.hashtags ?? [] }
	}
	const note = fs.existsSync(noteFile) ? parseNoteFile(fs.readFileSync(noteFile, 'utf8')) : undefined
	const bundle = { slug: post.slug, frontmatter: post.data, body: post.body, social, note }
	errors.push(...validateBundle(bundle, ctx).map((error) => `${post.slug}: ${error}`))
}

if (errors.length) {
	console.error(`検証に失敗しました (${errors.length} 件):`)
	for (const error of errors) console.error(`  - ${error}`)
	process.exit(1)
}
console.log(`検証 OK: 全 ${posts.length} 記事 (うち自動生成 ${generated.length} 記事を詳細に検証)`)
