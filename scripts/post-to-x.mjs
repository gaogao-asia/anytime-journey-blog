#!/usr/bin/env node
// 公開された自動生成記事を X に投稿する。
//   node scripts/post-to-x.mjs [--dry-run] [--slug <slug>]
// 環境変数: X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET (無ければ何もせず成功)
//           X_WAIT_TIMEOUT_SEC (公開待ちの上限。既定 900 秒)
// 投稿したらサイドカーに postedAt / tweetId を書く。これが二重投稿防止の記録になる。
import fs from 'node:fs'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { jstDate } from './lib/dates.mjs'
import { ROOT } from './lib/paths.mjs'
import { loadPosts, loadRules } from './lib/posts.mjs'
import { loadSidecars, pendingSidecars, saveSidecar, waitForUrl } from './lib/social.mjs'
import { validateSocial } from './lib/validate.mjs'
import { postTweet, xCredentials } from './lib/x.mjs'

const { values } = parseArgs({
	options: { 'dry-run': { type: 'boolean', default: false }, slug: { type: 'string' } }
})
const env = process.env
const dryRun = values['dry-run']

const posts = loadPosts(ROOT)
let targets = pendingSidecars(loadSidecars(ROOT), posts, jstDate(), values.slug ? Infinity : 3)
if (values.slug) targets = targets.filter(({ data }) => data.slug === values.slug)

if (targets.length === 0) {
	console.log('投稿待ちの記事はありません')
	process.exit(0)
}
const credentials = xCredentials(env)
if (!credentials && !dryRun) {
	console.log(`X のシークレットが未設定のため投稿をスキップします (対象: ${targets.map((t) => t.data.slug).join(', ')})`)
	process.exit(0)
}

const rules = loadRules(ROOT)
const timeoutMs = Number(env.X_WAIT_TIMEOUT_SEC || 900) * 1000
const posted = []
let failed = false

for (const sidecar of targets) {
	const { data } = sidecar
	console.log(`${data.slug}「${data.title}」`)
	const errors = validateSocial({ text: data.x.text, hashtags: data.x.hashtags }, { rules, postUrl: data.url, slug: data.slug })
	if (errors.length) {
		console.error(errors.map((e) => `  - ${e}`).join('\n'))
		failed = true
		continue
	}
	if (dryRun) {
		console.log(`--- dry-run ---\n${data.x.tweet}\n---------------`)
		continue
	}
	const live = await waitForUrl(data.url, { timeoutMs, intervalMs: 20000, log: (m) => console.log(m) })
	if (!live) {
		console.error(`  ${data.url} が ${timeoutMs / 1000} 秒以内に公開されなかったため投稿しません`)
		failed = true
		continue
	}
	try {
		const result = await postTweet(data.x.tweet, credentials)
		data.x.postedAt = new Date().toISOString()
		data.x.tweetId = result.id ?? null
		if (result.duplicate) data.x.duplicate = true
		saveSidecar(sidecar)
		posted.push(data.slug)
		console.log(result.duplicate ? '  同じ文面が投稿済みでした (投稿済みとして記録)' : `  投稿しました: ${result.id}`)
	} catch (error) {
		console.error(`  ${error.message}`)
		failed = true
	}
}

if (env.GITHUB_OUTPUT) fs.appendFileSync(env.GITHUB_OUTPUT, `posted=${posted.join(' ')}\n`)
if (env.GITHUB_STEP_SUMMARY && posted.length) {
	const lines = posted.map((slug) => `- \`${path.posix.join('editorial/social', `${slug}.json`)}\``)
	fs.appendFileSync(env.GITHUB_STEP_SUMMARY, `### X に投稿しました\n${lines.join('\n')}\n`)
}
process.exit(failed ? 1 : 0)
