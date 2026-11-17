// モデル呼び出し。generate() はこの関数だけを通して API を使うので、テストではフィクスチャに差し替えられる。
//   callModel({ system, messages }) -> { data, assistantContent, usage, model }
import fs from 'node:fs'
import Anthropic from '@anthropic-ai/sdk'
import { OUTPUT_SCHEMA } from './prompt.mjs'

export const DEFAULT_MODEL = 'claude-opus-5-5'
const DEFAULT_EFFORT = 'high'
const MAX_TOKENS = 32000
const FALLBACK_BETA = 'server-side-fallback-2026-07-01'

export function createAnthropicCaller(env = process.env) {
	const client = new Anthropic()
	const model = env.ANTHROPIC_MODEL || DEFAULT_MODEL
	const effort = env.ANTHROPIC_EFFORT || DEFAULT_EFFORT

	return async function callModel({ system, messages }) {
		// 長い出力になるのでストリーミングで受け、完成したメッセージだけを使う
		const stream = client.beta.messages.stream({
			model,
			max_tokens: MAX_TOKENS,
			betas: [FALLBACK_BETA],
			// モデルが安全上の理由で応答を断ったとき、サーバー側で代替モデルに切り替える
			fallbacks: 'default',
			// システムプロンプトは毎回同じなのでキャッシュする (再生成時は最初の依頼文まで読み出せる)
			cache_control: { type: 'ephemeral' },
			system,
			messages,
			output_config: { effort, format: { type: 'json_schema', schema: OUTPUT_SCHEMA } }
		})
		const message = await stream.finalMessage()

		if (message.stop_reason === 'refusal') {
			throw new Error(`モデルが応答を断りました (${message.stop_details?.category ?? 'unknown'})`)
		}
		if (message.stop_reason === 'max_tokens') {
			throw new Error(`出力が max_tokens (${MAX_TOKENS}) で打ち切られました`)
		}
		const text = message.content
			.filter((block) => block.type === 'text')
			.map((block) => block.text)
			.join('')
		let data
		try {
			data = JSON.parse(text)
		} catch (error) {
			throw new Error(`モデルの出力を JSON として読めません: ${error.message}`)
		}
		return { data, assistantContent: message.content, usage: message.usage, model: message.model }
	}
}

/** フィクスチャ応答を順番に返す (最後の 1 件は繰り返す)。実 API を呼ばずにパイプラインを通すためのもの */
export function createFixtureCaller(files) {
	let index = 0
	return async function callModel() {
		const file = files[Math.min(index, files.length - 1)]
		index += 1
		const data = JSON.parse(fs.readFileSync(file, 'utf8'))
		return { data, assistantContent: JSON.stringify(data), usage: null, model: `fixture:${file}` }
	}
}

/** POST_FIXTURE (カンマ区切りの JSON ファイル) があればフィクスチャ、無ければ実 API */
export function createModelCaller(env = process.env) {
	if (env.POST_FIXTURE) return createFixtureCaller(env.POST_FIXTURE.split(',').map((f) => f.trim()))
	return createAnthropicCaller(env)
}

export function describeApiError(error) {
	if (error instanceof Anthropic.AuthenticationError) return 'API キーが無効です (ANTHROPIC_API_KEY を確認してください)'
	if (error instanceof Anthropic.RateLimitError) return 'レート制限に達しました。時間をおいて再実行してください'
	if (error instanceof Anthropic.BadRequestError) return `リクエストが不正です: ${error.message}`
	if (error instanceof Anthropic.APIConnectionError) return `API に接続できません: ${error.message}`
	if (error instanceof Anthropic.APIError) return `API エラー (HTTP ${error.status}): ${error.message}`
	return error.message
}
