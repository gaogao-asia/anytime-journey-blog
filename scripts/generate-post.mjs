#!/usr/bin/env node
// 今日 (JST) の記事を 1 本生成する。
//   node scripts/generate-post.mjs [--date YYYY-MM-DD] [--theme <テーマID|曜日>] [--topic "<ネタ>"] [--force] [--dry-run]
// 環境変数: ANTHROPIC_API_KEY, ANTHROPIC_MODEL, ANTHROPIC_EFFORT, SITE_URL, POST_THEME, POST_TOPIC, POST_DATE,
//           POST_FIXTURE (実 API の代わりに使うフィクスチャ JSON。カンマ区切りで複数)
import fs from 'node:fs'
import { parseArgs } from 'node:util'
import { ROOT } from './lib/paths.mjs'
import { ValidationFailure, generate } from './lib/generate.mjs'
import { createModelCaller, describeApiError } from './lib/llm.mjs'

const { values } = parseArgs({
	options: {
		date: { type: 'string' },
		theme: { type: 'string' },
		topic: { type: 'string' },
		force: { type: 'boolean', default: false },
		'dry-run': { type: 'boolean', default: false }
	}
})
const env = process.env
const trimmed = (value) => (value && value.trim() ? value.trim() : undefined)

function setOutputs(outputs) {
	if (!env.GITHUB_OUTPUT) return
	const lines = Object.entries(outputs).map(([key, value]) => `${key}=${String(value ?? '').replace(/[\r\n]+/g, ' ')}`)
	fs.appendFileSync(env.GITHUB_OUTPUT, `${lines.join('\n')}\n`)
}

try {
	const result = await generate({
		root: ROOT,
		date: trimmed(values.date) ?? trimmed(env.POST_DATE),
		theme: trimmed(values.theme) ?? trimmed(env.POST_THEME),
		topic: trimmed(values.topic) ?? trimmed(env.POST_TOPIC),
		force: values.force,
		dryRun: values['dry-run'],
		env,
		callModel: createModelCaller(env),
		log: (message) => console.log(message)
	})

	if (!result.created) {
		console.log(`何もしません: ${result.reason}`)
		setOutputs({ created: 'false' })
	} else {
		console.log(`生成しました: ${result.slug}「${result.title}」(${result.attempts} 回目で合格)`)
		for (const file of Object.values(result.files)) console.log(`  ${file}`)
		for (const [index, usage] of result.usage.entries()) {
			console.log(
				`  トークン (${index + 1} 回目): 入力 ${usage.input_tokens} / キャッシュ書込 ${usage.cache_creation_input_tokens ?? 0} / キャッシュ読出 ${usage.cache_read_input_tokens ?? 0} / 出力 ${usage.output_tokens}`
			)
		}
		setOutputs({
			created: 'true',
			slug: result.slug,
			title: result.title,
			theme: result.theme,
			topic: result.topic,
			post_file: result.files.post,
			social_file: result.files.social,
			note_file: result.files.note
		})
	}
} catch (error) {
	console.error(error instanceof ValidationFailure ? error.message : `生成に失敗しました: ${describeApiError(error)}`)
	process.exit(1)
}
