// X (Twitter) API v2 への投稿。OAuth 1.0a ユーザーコンテキストの署名を Node 標準の crypto で行う
import crypto from 'node:crypto'

export const X_TWEETS_URL = 'https://api.x.com/2/tweets'
const TCO_URL_LENGTH = 23

/** RFC 3986 のパーセントエンコード (OAuth 1.0a 用) */
export function percentEncode(value) {
	return encodeURIComponent(String(value)).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
}

/** 署名ベース文字列。params には oauth_* とクエリ・フォームのパラメータを渡す (JSON ボディは含めない) */
export function signatureBaseString(method, url, params) {
	const base = new URL(url)
	const pairs = [...Object.entries(params), ...base.searchParams.entries()]
		.map(([key, value]) => [percentEncode(key), percentEncode(value)])
		.sort(([ak, av], [bk, bv]) => (ak === bk ? (av < bv ? -1 : av > bv ? 1 : 0) : ak < bk ? -1 : 1))
		.map(([key, value]) => `${key}=${value}`)
		.join('&')
	const baseUrl = `${base.protocol}//${base.host}${base.pathname}`
	return [method.toUpperCase(), percentEncode(baseUrl), percentEncode(pairs)].join('&')
}

export function sign(baseString, consumerSecret, tokenSecret) {
	const key = `${percentEncode(consumerSecret)}&${percentEncode(tokenSecret)}`
	return crypto.createHmac('sha1', key).update(baseString).digest('base64')
}

/** Authorization ヘッダーを作る。nonce と timestamp はテスト用に差し替えられる */
export function oauthHeader({ method, url, credentials, extraParams = {}, nonce, timestamp }) {
	const oauth = {
		oauth_consumer_key: credentials.apiKey,
		oauth_nonce: nonce ?? crypto.randomBytes(16).toString('hex'),
		oauth_signature_method: 'HMAC-SHA1',
		oauth_timestamp: String(timestamp ?? Math.floor(Date.now() / 1000)),
		oauth_token: credentials.accessToken,
		oauth_version: '1.0'
	}
	const baseString = signatureBaseString(method, url, { ...oauth, ...extraParams })
	oauth.oauth_signature = sign(baseString, credentials.apiSecret, credentials.accessTokenSecret)
	const header = Object.entries(oauth)
		.sort(([a], [b]) => (a < b ? -1 : 1))
		.map(([key, value]) => `${percentEncode(key)}="${percentEncode(value)}"`)
		.join(', ')
	return `OAuth ${header}`
}

export function normalizeHashtags(hashtags = []) {
	return hashtags
		.map((tag) => String(tag).trim().replace(/^[#＃]+/, '').replace(/\s+/g, ''))
		.filter(Boolean)
		.map((tag) => `#${tag}`)
}

export function trackedPostUrl(postUrl, slug) {
	return `${postUrl}?utm_source=x&utm_medium=social&utm_campaign=${slug}`
}

/** 投稿文を組み立てる: 本文 / ハッシュタグ / 計測パラメータ付き URL */
export function composeTweet({ text, hashtags = [], postUrl, slug }) {
	const tags = normalizeHashtags(hashtags).join(' ')
	return [String(text).trim(), tags, trackedPostUrl(postUrl, slug)].filter(Boolean).join('\n')
}

/** X の文字数カウントの近似: URL は 23、全角などは 2、それ以外は 1 */
export function weightedLength(tweet) {
	let length = 0
	const rest = tweet.replace(/https?:\/\/\S+/g, () => {
		length += TCO_URL_LENGTH
		return ''
	})
	for (const char of rest.normalize('NFC')) {
		const cp = char.codePointAt(0)
		const light =
			cp <= 0x10ff || (cp >= 0x2000 && cp <= 0x200d) || (cp >= 0x2010 && cp <= 0x201f) || (cp >= 0x2032 && cp <= 0x2037)
		length += light ? 1 : 2
	}
	return length
}

export function xCredentials(env = process.env) {
	const credentials = {
		apiKey: env.X_API_KEY,
		apiSecret: env.X_API_SECRET,
		accessToken: env.X_ACCESS_TOKEN,
		accessTokenSecret: env.X_ACCESS_TOKEN_SECRET
	}
	return Object.values(credentials).every(Boolean) ? credentials : null
}

/**
 * POST /2/tweets。成功なら { id }、同じ文面が投稿済みなら { duplicate: true } を返す。
 * それ以外の失敗は例外にする。
 */
export async function postTweet(text, credentials, fetchImpl = fetch) {
	const response = await fetchImpl(X_TWEETS_URL, {
		method: 'POST',
		headers: {
			Authorization: oauthHeader({ method: 'POST', url: X_TWEETS_URL, credentials }),
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({ text })
	})
	const raw = await response.text()
	let payload = {}
	try {
		payload = JSON.parse(raw)
	} catch {
		// JSON でない応答はそのままエラーメッセージに使う
	}
	if (response.ok && payload.data?.id) return { id: payload.data.id }
	if (response.status === 403 && /duplicate/i.test(raw)) return { duplicate: true }
	throw new Error(`X への投稿に失敗しました (HTTP ${response.status}): ${raw.slice(0, 500)}`)
}
