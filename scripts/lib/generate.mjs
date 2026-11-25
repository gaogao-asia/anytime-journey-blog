// ネタ選択 → 生成 → 検証 (失敗時は 1 回だけ再生成) → ファイル書き出し
import fs from 'node:fs'
import path from 'node:path'
import { jstDate } from './dates.mjs'
import { paths, postUrl } from './paths.mjs'
import { loadPosts, loadRules, loadSiteEnums, nextSlug } from './posts.mjs'
import { formatExercises, loadCalendar, loadUsedTopics, pickTopic, recordUsedTopic, resolveTheme } from './plan.mjs'
import { SYSTEM_PROMPT, buildRetryPrompt, buildUserPrompt } from './prompt.mjs'
import { buildBundle, renderNoteFile, renderPostFile, renderSocialFile } from './assemble.mjs'
import { validateBundle } from './validate.mjs'

export class ValidationFailure extends Error {
	constructor(errors) {
		super(`検証に失敗しました:\n${errors.map((e) => `  - ${e}`).join('\n')}`)
		this.errors = errors
	}
}

/**
 * options: { root, date (Date | 'YYYY-MM-DD'), theme, topic, force, dryRun, env, callModel, log }
 * 戻り値: { created, reason?, slug?, title?, theme?, topic?, files?, attempts?, usage? }
 */
/** 生成の試行回数の上限。1 回目で別の禁止表現に当たることがあるので、再生成は 2 回まで許す */
export const MAX_ATTEMPTS = 3

export async function generate(options) {
	const { root, callModel, env = process.env, log = () => {} } = options
	const p = paths(root)
	const date = jstDate(options.date ?? new Date())
	const posts = loadPosts(root)

	const todays = posts.filter((post) => post.slug.startsWith(date.compact))
	if (todays.length && !options.force) {
		return { created: false, reason: `${date.ymd} の記事 (${todays.map((t) => t.slug).join(', ')}) が既にあります` }
	}

	const calendar = loadCalendar(root)
	const theme = resolveTheme(calendar, date.weekday, options.theme)
	const topic = options.topic || pickTopic(theme, loadUsedTopics(root))
	const slug = nextSlug(date.compact, posts.map((post) => post.slug))
	const url = postUrl(slug, env)
	log(`${date.ymd} (${date.weekday}) テーマ: ${theme.label} / ネタ: ${topic ?? '(モデルが決める)'} / slug: ${slug}`)

	const rules = loadRules(root)
	const ctx = {
		rules,
		enums: loadSiteEnums(root),
		otherPosts: posts,
		requireComponents: theme.require_components ?? [],
		minDiagrams: rules.diagram?.min_in_new_posts ?? 0,
		postUrl: url
	}
	const system = [{ type: 'text', text: SYSTEM_PROMPT }]
	const messages = [
		{
			role: 'user',
			content: buildUserPrompt({
				date,
				theme,
				topic,
				existingTitles: posts.map((post) => post.data.title),
				exercises: formatExercises(calendar)
			})
		}
	]

	const usage = []
	let bundle
	let errors = []
	let attempts = 0
	// 最初の生成と、検証に落ちたときの再生成 (MAX_ATTEMPTS - 1 回まで)
	while (attempts < MAX_ATTEMPTS) {
		attempts += 1
		const result = await callModel({ system, messages })
		if (result.usage) usage.push(result.usage)
		bundle = buildBundle({ slug, date, theme, draft: result.data })
		errors = validateBundle(bundle, ctx)
		if (errors.length === 0) break
		log(`検証エラー (${attempts} 回目):\n${errors.map((e) => `  - ${e}`).join('\n')}`)
		messages.push({ role: 'assistant', content: result.assistantContent }, { role: 'user', content: buildRetryPrompt(errors) })
	}
	if (errors.length) throw new ValidationFailure(errors)

	const files = {
		post: path.join(p.blog, `${slug}.mdx`),
		social: path.join(p.social, `${slug}.json`),
		note: path.join(p.note, `${slug}.md`)
	}
	const finalTopic = topic || bundle.topic || theme.label
	if (!options.dryRun) {
		fs.mkdirSync(p.social, { recursive: true })
		fs.mkdirSync(p.note, { recursive: true })
		fs.writeFileSync(files.post, renderPostFile(bundle))
		fs.writeFileSync(files.social, renderSocialFile(bundle, url))
		fs.writeFileSync(files.note, renderNoteFile(bundle, url))
		recordUsedTopic(root, {
			date: date.ymd,
			slug,
			theme: theme.id,
			topic: finalTopic,
			title: bundle.frontmatter.title
		})
	}
	return {
		created: true,
		slug,
		title: bundle.frontmatter.title,
		theme: theme.id,
		topic: finalTopic,
		files: Object.fromEntries(Object.entries(files).map(([k, f]) => [k, path.relative(p.root, f)])),
		attempts,
		usage,
		bundle
	}
}
