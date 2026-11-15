import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
	composeTweet,
	normalizeHashtags,
	oauthHeader,
	percentEncode,
	postTweet,
	sign,
	signatureBaseString,
	weightedLength,
	xCredentials
} from '../scripts/lib/x.mjs'

// X 公式ドキュメント "Creating a signature" のテストベクタ
const DOC = {
	url: 'https://api.twitter.com/1.1/statuses/update.json',
	params: {
		status: 'Hello Ladies + Gentlemen, a signed OAuth request!',
		include_entities: 'true',
		oauth_consumer_key: 'xvz1evFS4wEEPTGEFPHBog',
		oauth_nonce: 'kYjzVBB8Y0ZFabxSWbWovY3uYSQ2pTgmZeNu2VS4cg',
		oauth_signature_method: 'HMAC-SHA1',
		oauth_timestamp: '1318622958',
		oauth_token: '370773112-GmHxMAgYyLbNEtIKZeRNFsMKPR9EyMZeS9weJAEb',
		oauth_version: '1.0'
	},
	consumerSecret: 'kAcSOqF21Fu85e7zjz7ZN2U4ZRhfV3WpwPAoE3Z7kBw',
	tokenSecret: 'LswwdoUaIvS8ltyTt5jkRh4J50vUPVVHtR2YPi5kE',
	baseString:
		'POST&https%3A%2F%2Fapi.twitter.com%2F1.1%2Fstatuses%2Fupdate.json&include_entities%3Dtrue%26oauth_consumer_key%3Dxvz1evFS4wEEPTGEFPHBog%26oauth_nonce%3DkYjzVBB8Y0ZFabxSWbWovY3uYSQ2pTgmZeNu2VS4cg%26oauth_signature_method%3DHMAC-SHA1%26oauth_timestamp%3D1318622958%26oauth_token%3D370773112-GmHxMAgYyLbNEtIKZeRNFsMKPR9EyMZeS9weJAEb%26oauth_version%3D1.0%26status%3DHello%2520Ladies%2520%252B%2520Gentlemen%252C%2520a%2520signed%2520OAuth%2520request%2521',
	signature: 'hCtSmYh+iHYCEqBWrE7C7hYmtUk='
}

test('percentEncode は RFC 3986 に従う', () => {
	assert.equal(percentEncode('Ladies + Gentlemen'), 'Ladies%20%2B%20Gentlemen')
	assert.equal(percentEncode('An encoded string!'), 'An%20encoded%20string%21')
	assert.equal(percentEncode("Dogs, Cats & Mice (*')"), 'Dogs%2C%20Cats%20%26%20Mice%20%28%2A%27%29')
	assert.equal(percentEncode('☃'), '%E2%98%83')
	assert.equal(percentEncode('a-b_c.d~e'), 'a-b_c.d~e')
})

test('署名ベース文字列と署名が X 公式ドキュメントの例と一致する', () => {
	const base = signatureBaseString('post', DOC.url, DOC.params)
	assert.equal(base, DOC.baseString)
	assert.equal(sign(base, DOC.consumerSecret, DOC.tokenSecret), DOC.signature)
})

test('URL のクエリも署名対象に含める', () => {
	const { include_entities: _omit, ...rest } = DOC.params
	const base = signatureBaseString('POST', `${DOC.url}?include_entities=true`, rest)
	assert.equal(base, DOC.baseString)
})

test('Authorization ヘッダーの形式 (JSON ボディは署名に含めない)', () => {
	const credentials = { apiKey: 'ck', apiSecret: 'cs', accessToken: 'at', accessTokenSecret: 'ts' }
	const header = oauthHeader({ method: 'POST', url: 'https://api.x.com/2/tweets', credentials, nonce: 'abc', timestamp: 1700000000 })
	const expected = sign(
		signatureBaseString('POST', 'https://api.x.com/2/tweets', {
			oauth_consumer_key: 'ck',
			oauth_nonce: 'abc',
			oauth_signature_method: 'HMAC-SHA1',
			oauth_timestamp: '1700000000',
			oauth_token: 'at',
			oauth_version: '1.0'
		}),
		'cs',
		'ts'
	)
	assert.equal(
		header,
		`OAuth oauth_consumer_key="ck", oauth_nonce="abc", oauth_signature="${percentEncode(expected)}", oauth_signature_method="HMAC-SHA1", oauth_timestamp="1700000000", oauth_token="at", oauth_version="1.0"`
	)
})

test('投稿文の組み立て: 本文 / ハッシュタグ / 計測パラメータ付き URL', () => {
	const tweet = composeTweet({
		text: ' 週2回でも続ければ変わる。 ',
		hashtags: ['筋トレ初心者', '#ジム通い'],
		postUrl: 'https://anytimejourney.netlify.app/post/2026111601/',
		slug: '2026111601'
	})
	assert.equal(
		tweet,
		'週2回でも続ければ変わる。\n#筋トレ初心者 #ジム通い\nhttps://anytimejourney.netlify.app/post/2026111601/?utm_source=x&utm_medium=social&utm_campaign=2026111601'
	)
	assert.equal(
		composeTweet({ text: 'a', postUrl: 'https://e.com/post/1/', slug: '1' }),
		'a\nhttps://e.com/post/1/?utm_source=x&utm_medium=social&utm_campaign=1'
	)
	assert.deepEqual(normalizeHashtags(['＃筋トレ', ' ジム 通い ', '', '#']), ['#筋トレ', '#ジム通い'])
})

test('文字数カウント: 全角 2、半角 1、URL 23', () => {
	assert.equal(weightedLength('abc'), 3)
	assert.equal(weightedLength('ジム'), 4)
	assert.equal(weightedLength('a https://example.com/very/long/path?x=1'), 2 + 23)
})

test('シークレットが 1 つでも欠けていれば null', () => {
	const env = { X_API_KEY: 'a', X_API_SECRET: 'b', X_ACCESS_TOKEN: 'c', X_ACCESS_TOKEN_SECRET: 'd' }
	assert.deepEqual(xCredentials(env), { apiKey: 'a', apiSecret: 'b', accessToken: 'c', accessTokenSecret: 'd' })
	assert.equal(xCredentials({ ...env, X_ACCESS_TOKEN_SECRET: '' }), null)
	assert.equal(xCredentials({}), null)
})

test('postTweet: 成功・重複・失敗', async () => {
	const credentials = { apiKey: 'ck', apiSecret: 'cs', accessToken: 'at', accessTokenSecret: 'ts' }
	const calls = []
	const respond = (status, body) => async (url, init) => {
		calls.push({ url, init })
		return { ok: status >= 200 && status < 300, status, text: async () => body }
	}
	assert.deepEqual(await postTweet('こんにちは', credentials, respond(201, '{"data":{"id":"123","text":"x"}}')), { id: '123' })
	assert.equal(calls[0].url, 'https://api.x.com/2/tweets')
	assert.equal(calls[0].init.method, 'POST')
	assert.equal(calls[0].init.body, '{"text":"こんにちは"}')
	assert.match(calls[0].init.headers.Authorization, /^OAuth oauth_consumer_key="ck", .*oauth_signature="[^"]+"/)

	const duplicate = '{"detail":"You are not allowed to create a Tweet with duplicate content.","status":403}'
	assert.deepEqual(await postTweet('x', credentials, respond(403, duplicate)), { duplicate: true })
	await assert.rejects(postTweet('x', credentials, respond(403, '{"detail":"Forbidden"}')), /HTTP 403/)
	await assert.rejects(postTweet('x', credentials, respond(429, 'Too Many Requests')), /HTTP 429/)
})
