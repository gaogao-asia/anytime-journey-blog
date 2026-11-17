// X 投稿用サイドカー (editorial/social/<slug>.json) の読み書きと、投稿対象の選別
import fs from 'node:fs'
import path from 'node:path'
import { paths } from './paths.mjs'

export function loadSidecars(root) {
	const dir = paths(root).social
	if (!fs.existsSync(dir)) return []
	return fs
		.readdirSync(dir)
		.filter((name) => name.endsWith('.json'))
		.sort()
		.map((name) => {
			const file = path.join(dir, name)
			return { file, data: JSON.parse(fs.readFileSync(file, 'utf8')) }
		})
}

export function saveSidecar({ file, data }) {
	fs.writeFileSync(file, `${JSON.stringify(data, null, '\t')}\n`)
}

const daysBetween = (fromCompact, toCompact) => {
	const utc = (c) => Date.UTC(Number(c.slice(0, 4)), Number(c.slice(4, 6)) - 1, Number(c.slice(6, 8)))
	return Math.round((utc(toCompact) - utc(fromCompact)) / 86400000)
}

/**
 * まだ投稿していないサイドカーを選ぶ。
 * 対象: 公開済みの自動生成記事 (generated: true, draft でない) で、未投稿、公開日が今日から maxAgeDays 日以内。
 * 古い記事や未来日付の記事をまとめて投稿してしまわないための絞り込み。
 */
export function pendingSidecars(sidecars, posts, today, maxAgeDays = 3) {
	const bySlug = new Map(posts.map((post) => [post.slug, post]))
	return sidecars.filter(({ data }) => {
		const post = bySlug.get(data.slug)
		if (!post || post.data.generated !== true || post.data.draft === true) return false
		if (!data.x?.tweet || data.x.postedAt) return false
		const age = daysBetween(data.slug.slice(0, 8), today.compact)
		return age >= 0 && age <= maxAgeDays
	})
}

/** URL が 200 を返すまで待つ。時間切れなら false */
export async function waitForUrl(url, { timeoutMs, intervalMs, fetchImpl = fetch, sleep, log = () => {} }) {
	const wait = sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)))
	const deadline = Date.now() + timeoutMs
	for (let attempt = 1; ; attempt += 1) {
		let status = 0
		try {
			const response = await fetchImpl(url, { redirect: 'follow', headers: { 'cache-control': 'no-cache' } })
			status = response.status
		} catch (error) {
			log(`  ${url} に接続できません: ${error.message}`)
		}
		if (status === 200) return true
		if (Date.now() + intervalMs > deadline) return false
		log(`  公開待ち (${attempt} 回目, HTTP ${status || '-'})`)
		await wait(intervalMs)
	}
}
