import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { parseNoteFile, renderPostFile } from '../scripts/lib/assemble.mjs'
import { MAX_ATTEMPTS, ValidationFailure, generate } from '../scripts/lib/generate.mjs'
import { createFixtureCaller } from '../scripts/lib/llm.mjs'
import { ROOT } from '../scripts/lib/paths.mjs'
import { loadUsedTopics } from '../scripts/lib/plan.mjs'
import { extractStringArray, loadPosts, nextSlug, splitFrontmatter } from '../scripts/lib/posts.mjs'
import { OUTPUT_SCHEMA } from '../scripts/lib/prompt.mjs'
import { loadSidecars, pendingSidecars, waitForUrl } from '../scripts/lib/social.mjs'
import { jstDate } from '../scripts/lib/dates.mjs'
import { enums, fixture, makeTempRoot } from './helpers.mjs'

const valid = fixture('draft-habit.json')
const invalid = fixture('draft-habit-invalid.json')
const env = { SITE_URL: 'https://blog.example.com/' }

/** 渡した応答を順に返し、受け取ったリクエストを記録する */
function recordingCaller(drafts) {
	const calls = []
	const callModel = async (request) => {
		calls.push(structuredClone(request))
		const data = drafts[Math.min(calls.length - 1, drafts.length - 1)]
		return { data, assistantContent: JSON.stringify(data), usage: { input_tokens: 1, output_tokens: 1 } }
	}
	return { calls, callModel }
}

test('サイトの定義 (カテゴリ・形式・CTA・アフィリエイトのホスト) を TS から読める', () => {
	assert.ok(enums.categories.includes('独学トレーニング'))
	assert.deepEqual(enums.formats, ['article', 'dialogue', 'visual', 'video'])
	assert.deepEqual(enums.ctas, ['habit', 'crowd', 'menu', 'ai', 'gym', 'data', 'beginner', 'default'])
	assert.ok(enums.affiliateHosts.includes('amzn.to'))
	assert.deepEqual(extractStringArray(`export const A = [\n\t'x', // c\n\t"y"\n] as const`, 'A'), ['x', 'y'])
	assert.throws(() => extractStringArray('export const A = []', 'B'))
})

test('slug は YYYYMMDDNN の連番', () => {
	assert.equal(nextSlug('20261116', ['2024070601', '2024070602']), '2026111601')
	assert.equal(nextSlug('20240706', ['2024070601', '2024070602']), '2024070603')
})

test('出力スキーマは全項目が必須で、追加の項目を許さない', () => {
	assert.deepEqual([...OUTPUT_SCHEMA.required].sort(), Object.keys(OUTPUT_SCHEMA.properties).sort())
	assert.equal(OUTPUT_SCHEMA.additionalProperties, false)
	assert.deepEqual(Object.keys(valid).sort(), Object.keys(OUTPUT_SCHEMA.properties).sort())
})

test('frontmatter はスクリプトが組み立て、引用符や改行を含む値でも壊れない', () => {
	const frontmatter = { title: `"週2回"って: 'どう'? # コメントではない`, tags: ['a: b', '#c'], generated: true, pubDate: '2026-11-16' }
	const { data, body } = splitFrontmatter(renderPostFile({ frontmatter, body: '本文\n\n---\n\n続き' }))
	assert.deepEqual(data, frontmatter)
	assert.equal(body.trim(), '本文\n\n---\n\n続き')
})

test('生成: ネタ選択 → 組み立て → 検証 → 書き出し → 使用済みの記録', async () => {
	const root = makeTempRoot()
	const { calls, callModel } = recordingCaller([valid])
	const result = await generate({ root, date: '2026-11-16', env, callModel })

	assert.equal(result.created, true)
	assert.equal(result.slug, '2026111601')
	assert.equal(result.attempts, 1)
	assert.equal(result.topic, 'ジム 週2回 効果')
	assert.equal(calls.length, 1)
	assert.match(calls[0].messages[0].content, /ネタ \(想定している検索語\): ジム 週2回 効果/)
	// システムプロンプトには日付などの変わる値を入れない (キャッシュのため)
	assert.doesNotMatch(calls[0].system[0].text, /2026-11-16/)

	const [post] = loadPosts(root)
	assert.deepEqual(post.data, {
		title: valid.title,
		description: valid.description,
		pubDate: '2026-11-16',
		category: '習慣化',
		tags: valid.tags,
		format: 'article',
		affiliate: false,
		cta: 'habit',
		generated: true,
		draft: false
	})
	assert.equal(post.body.trim(), valid.body_mdx.trim())

	const [sidecar] = loadSidecars(root)
	assert.equal(sidecar.data.url, 'https://blog.example.com/post/2026111601/')
	assert.equal(
		sidecar.data.x.tweet,
		`${valid.x_text}\n#筋トレ初心者 #ジム通い\nhttps://blog.example.com/post/2026111601/?utm_source=x&utm_medium=social&utm_campaign=2026111601`
	)
	assert.equal(sidecar.data.x.postedAt, null)

	const noteSource = fs.readFileSync(path.join(root, 'editorial/note/2026111601.md'), 'utf8')
	assert.deepEqual(parseNoteFile(noteSource), { title: valid.note_title, body: valid.note_body })
	assert.match(noteSource, /\(https:\/\/blog\.example\.com\/post\/2026111601\/\?utm_source=note&utm_medium=social&utm_campaign=2026111601\)/)
	assert.match(noteSource, /\[Fitness Journey\]\(https:\/\/anytimejourney\.net\/lp\/\?utm_source=note/)

	assert.deepEqual(loadUsedTopics(root), [
		{ date: '2026-11-16', slug: '2026111601', theme: 'habit', topic: 'ジム 週2回 効果', title: valid.title }
	])
})

test('同じ日の記事が既にあれば何もしない。翌週は次のネタを使う', async () => {
	const root = makeTempRoot()
	const { calls, callModel } = recordingCaller([valid, { ...valid, title: '別のタイトルの記事' }])
	await generate({ root, date: '2026-11-16', env, callModel })

	const again = await generate({ root, date: '2026-11-16', env, callModel })
	assert.equal(again.created, false)
	assert.match(again.reason, /2026111601/)
	assert.equal(calls.length, 1)

	const nextWeek = await generate({ root, date: '2026-11-23', env, callModel })
	assert.equal(nextWeek.topic, 'ジム 続かない 理由 と対策')
	assert.match(calls[1].messages[0].content, new RegExp(`- ${valid.title}`))
	assert.equal(loadUsedTopics(root).length, 2)
})

test('検証に落ちたら、失敗理由を渡して再生成する', async () => {
	const root = makeTempRoot()
	const { calls, callModel } = recordingCaller([invalid, valid])
	const result = await generate({ root, date: '2026-11-16', env, callModel })

	assert.equal(result.attempts, 2)
	assert.equal(calls.length, 2)
	const retry = calls[1].messages
	assert.deepEqual(retry.map((m) => m.role), ['user', 'assistant', 'user'])
	assert.deepEqual(retry[0], calls[0].messages[0])
	assert.match(retry[2].content, /禁止表現「必ず痩せる」/)
	assert.match(retry[2].content, /<Video> は許可されていない/)
	assert.equal(loadPosts(root)[0].body.trim(), valid.body_mdx.trim())
})

test('2 回続けて落ちても、3 回目が通れば公開する', async () => {
	const root = makeTempRoot()
	const { calls, callModel } = recordingCaller([invalid, invalid, valid])
	const result = await generate({ root, date: '2026-11-16', env, callModel })

	assert.equal(result.attempts, 3)
	assert.equal(calls.length, 3)
	assert.deepEqual(calls[2].messages.map((m) => m.role), ['user', 'assistant', 'user', 'assistant', 'user'])
	assert.equal(loadPosts(root).length, 1)
})

test('再生成しても落ちたら例外にして、何も書き出さない', async () => {
	const root = makeTempRoot()
	const { calls, callModel } = recordingCaller([invalid])
	await assert.rejects(generate({ root, date: '2026-11-16', env, callModel }), (error) => {
		assert.ok(error instanceof ValidationFailure)
		assert.ok(error.errors.length > 0)
		return true
	})
	assert.equal(calls.length, MAX_ATTEMPTS)
	assert.equal(loadPosts(root).length, 0)
	assert.equal(loadSidecars(root).length, 0)
	assert.deepEqual(loadUsedTopics(root), [])
})

test('ネタが尽きたテーマでは、モデルに切り口を考えさせて記録する', async () => {
	const root = makeTempRoot()
	const calendarFile = path.join(root, 'editorial/calendar.yaml')
	const calendar = fs.readFileSync(calendarFile, 'utf8')
	const used = [...calendar.matchAll(/^      - (.+)$/gm)].map(([, topic]) => ({ topic }))
	fs.writeFileSync(path.join(root, 'editorial/used-topics.json'), JSON.stringify(used))

	const { calls, callModel } = recordingCaller([{ ...valid, topic: 'ジム 月曜 行きたくない' }])
	const result = await generate({ root, date: '2026-11-16', env, callModel })
	assert.match(calls[0].messages[0].content, /ネタ帳が尽きています/)
	assert.equal(result.topic, 'ジム 月曜 行きたくない')
	assert.equal(loadUsedTopics(root).at(-1).topic, 'ジム 月曜 行きたくない')
})

test('テーマとネタの手動指定、種目一覧と GymCta の指示', async () => {
	const root = makeTempRoot()
	const { calls, callModel } = recordingCaller([valid])
	await generate({ root, date: '2026-11-16', theme: 'machine', topic: 'レッグプレス 膝 痛い', dryRun: true, env, callModel }).catch(() => {})
	assert.match(calls[0].messages[0].content, /テーマ: マシンの使い方/)
	assert.match(calls[0].messages[0].content, /ネタ \(想定している検索語\): レッグプレス 膝 痛い/)
	assert.match(calls[0].messages[0].content, /- Legs: レッグプレス、/)

	const gym = recordingCaller([valid])
	await assert.rejects(generate({ root, date: '2026-11-20', dryRun: true, env, callModel: gym.callModel }), /<GymCta> を 1 つ/)
	assert.match(gym.calls[0].messages[0].content, /<GymCta> を 1 つ入れてください/)
	assert.equal(loadPosts(root).length, 0)
})

test('フィクスチャ用の呼び出しは実 API を使わず、ファイルを順に返す', async () => {
	const file = (name) => path.join(ROOT, 'tests/fixtures', name)
	const callModel = createFixtureCaller([file('draft-habit-invalid.json'), file('draft-habit.json')])
	assert.equal((await callModel()).data.title, invalid.title)
	assert.equal((await callModel()).data.x_text, valid.x_text)
	assert.equal((await callModel()).data.x_text, valid.x_text)
})

test('X の投稿対象: 未投稿で、公開済みの自動生成記事で、公開日が 3 日以内', () => {
	const post = (slug, data = {}) => ({ slug, data: { generated: true, ...data } })
	const sidecar = (slug, x = {}) => ({ data: { slug, x: { tweet: 't', postedAt: null, ...x } } })
	const posts = [post('2026111601'), post('2026111501', { draft: true }), post('2026111401', { generated: false }), post('2026111001'), post('2026111701')]
	const sidecars = [
		sidecar('2026111601'),
		sidecar('2026111501'),
		sidecar('2026111401'),
		sidecar('2026111001'),
		sidecar('2026111701'),
		sidecar('2026111301'),
		sidecar('2026111602', { postedAt: '2026-11-16T00:00:00Z' })
	]
	const today = jstDate('2026-11-16')
	assert.deepEqual(pendingSidecars(sidecars, posts, today).map((s) => s.data.slug), ['2026111601'])
	// 投稿済みを記録すれば、次の実行では対象外になる (二重投稿防止)
	sidecars[0].data.x.postedAt = '2026-11-16T01:00:00Z'
	assert.deepEqual(pendingSidecars(sidecars, posts, today), [])
})

test('公開待ち: 200 になるまで待ち、時間切れなら投稿しない', async () => {
	const statuses = [404, 404, 200]
	const fetchImpl = async () => ({ status: statuses.shift() ?? 404 })
	const sleeps = []
	const sleep = async (ms) => sleeps.push(ms)
	assert.equal(await waitForUrl('https://e.com/', { timeoutMs: 60000, intervalMs: 10, fetchImpl, sleep }), true)
	assert.equal(sleeps.length, 2)
	assert.equal(await waitForUrl('https://e.com/', { timeoutMs: 5, intervalMs: 10, fetchImpl, sleep }), false)
	const failing = async () => {
		throw new Error('network')
	}
	assert.equal(await waitForUrl('https://e.com/', { timeoutMs: 5, intervalMs: 10, fetchImpl: failing, sleep }), false)
})

test('プロンプトと検証ルールの図解の決まりが食い違っていない', async () => {
	const { DIAGRAM_TYPES } = await import('../src/utils/diagram.mjs')
	const { SYSTEM_PROMPT } = await import('../scripts/lib/prompt.mjs')
	const { rules } = await import('./helpers.mjs')
	assert.deepEqual(Object.keys(rules.diagram.types).sort(), [...DIAGRAM_TYPES].sort())
	for (const type of DIAGRAM_TYPES) assert.ok(SYSTEM_PROMPT.includes(`- ${type}:`), `${type} の説明がプロンプトにありません`)
	assert.ok(rules.mdx.allowed_components.includes('Diagram'))
})
