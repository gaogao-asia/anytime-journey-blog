// 記事・X 投稿文・note 原稿の検証。エラーメッセージの配列を返す (空なら合格)
import { SLUG_PATTERN, normalizeTitle } from './posts.mjs'
import { normalizeHashtags, weightedLength, composeTweet } from './x.mjs'

const URL_PATTERN = /https?:\/\/[^\s)"'<>\]]+/g

const charCount = (text) => [...text].length

/** コードブロックとインラインコードを取り除く (中身は MDX として評価されない) */
export function stripCode(body) {
	return body.replace(/^(```|~~~)[\s\S]*?^\1[^\n]*$/gm, '').replace(/`[^`\n]*`/g, '')
}

/** 読者に見える文字数。タグ・URL・Markdown 記号・空白を除く */
export function visibleLength(body) {
	const text = stripCode(body)
		.replace(/<[^>]*>/g, '')
		.replace(/\]\([^)]*\)/g, ']')
		.replace(URL_PATTERN, '')
		.replace(/[#*_>|\-[\]\s]/g, '')
	return charCount(text)
}

const hostOf = (url) => {
	try {
		return new URL(url).hostname.toLowerCase()
	} catch {
		return null
	}
}
const hostMatches = (host, list) => list.some((h) => host === h || host.endsWith(`.${h}`))

/** 禁止表現を 1 文ごとに探す */
export function findBannedPhrases(text, banned = []) {
	const hits = []
	const sentences = text.split(/[。！？!?\n]+/).filter((s) => s.trim())
	for (const rule of banned) {
		const pattern = new RegExp(rule.pattern, 'i')
		const near = rule.near ? new RegExp(rule.near, 'i') : null
		const allow = (rule.allow ?? []).map((p) => new RegExp(p, 'i'))
		for (const sentence of sentences) {
			const match = pattern.exec(sentence)
			if (!match) continue
			if (near && !near.test(sentence)) continue
			if (allow.some((p) => p.test(sentence))) continue
			hits.push({ id: rule.id, phrase: match[0], reason: rule.reason, sentence: sentence.trim().slice(0, 60) })
		}
	}
	return hits
}

const bannedErrors = (label, text, rules) =>
	findBannedPhrases(text, rules.banned).map(
		(hit) => `${label}: 禁止表現「${hit.phrase}」(${hit.reason}) — 「${hit.sentence}」`
	)

export function validateFrontmatter(slug, data, { rules, enums }) {
	const errors = []
	const { limits } = rules
	if (typeof data.title !== 'string' || !data.title.trim()) errors.push('title: 空です')
	else if (charCount(data.title) > limits.title_max) {
		errors.push(`title: ${charCount(data.title)} 字 (上限 ${limits.title_max} 字)`)
	}
	if (typeof data.description !== 'string' || !data.description.trim()) errors.push('description: 空です')
	if (!enums.categories.includes(data.category)) errors.push(`category: "${data.category}" は定義されていません`)
	if (data.format !== undefined && !enums.formats.includes(data.format)) {
		errors.push(`format: "${data.format}" は定義されていません`)
	}
	if (data.cta !== undefined && !enums.ctas.includes(data.cta)) errors.push(`cta: "${data.cta}" は定義されていません`)
	if (!Array.isArray(data.tags) || data.tags.some((tag) => typeof tag !== 'string' || !tag.trim())) {
		errors.push('tags: 文字列の配列にしてください')
	}
	if (!/^[\x21-\x7e]+$/.test(slug)) errors.push(`slug: "${slug}" は ASCII にしてください`)
	return errors
}

export function validateBody(body, { frontmatter, rules, enums, requireComponents = [] }) {
	const errors = []
	const { limits, mdx, links } = rules
	const source = stripCode(body)

	const length = visibleLength(body)
	if (length < limits.body_min) errors.push(`本文: ${length} 字で短すぎます (下限 ${limits.body_min} 字)`)
	if (length > limits.body_max) errors.push(`本文: ${length} 字で長すぎます (上限 ${limits.body_max} 字)`)

	const h2 = (source.match(/^## +\S/gm) ?? []).length
	if (h2 < limits.min_h2) errors.push(`本文: h2 見出し (##) が ${h2} 個です (${limits.min_h2} 個以上)`)
	if (/^# +\S/m.test(source)) errors.push('本文: h1 見出し (#) は使えません (タイトルはレイアウトが表示します)')

	if (/^\s*(import|export)\s/m.test(source)) errors.push('本文: import / export 文は書けません')
	if (/[{}]/.test(source)) errors.push('本文: 波括弧 { } は使えません (MDX の式として評価されます)')
	if (source.includes('<!--')) errors.push('本文: HTML コメントは使えません')
	if (/!\[[^\]]*\]\(/.test(source)) errors.push('本文: 画像は使えません')

	const counts = {}
	for (const [, closing, name] of source.matchAll(/<(\/?)([A-Za-z][A-Za-z0-9.-]*)/g)) {
		if (/^[A-Z]/.test(name)) {
			if (!mdx.allowed_components.includes(name)) errors.push(`本文: <${name}> は許可されていないコンポーネントです`)
			else if (!closing) counts[name] = (counts[name] ?? 0) + 1
		} else if (mdx.forbidden_html.includes(name.toLowerCase())) {
			errors.push(`本文: <${name.toLowerCase()}> は使えません`)
		} else {
			errors.push(`本文: 生の HTML タグ <${name}> は使えません (Markdown で書いてください)`)
		}
	}
	const talkOpen = counts.Talk ?? 0
	const talkClose = (source.match(/<\/Talk>/g) ?? []).length
	if (talkOpen !== talkClose) errors.push(`本文: <Talk> の開始 (${talkOpen}) と終了 (${talkClose}) の数が合いません`)
	for (const [, who] of source.matchAll(/<Talk(?:Cta)?\b[^>]*?\bwho=["']([^"']*)["']/g)) {
		if (!mdx.talk_who.includes(who)) errors.push(`本文: who="${who}" は使えません (${mdx.talk_who.join(' / ')})`)
	}
	const appCtas = (counts.AppCta ?? 0) + (counts.TalkCta ?? 0)
	if (appCtas > mdx.max_app_cta) errors.push(`本文: アプリ導線 (AppCta / TalkCta) は ${mdx.max_app_cta} 回までです`)
	if (frontmatter.format === 'dialogue' && talkOpen < 6) {
		errors.push('本文: dialogue 形式は <Talk> の会話で書いてください (6 発言以上)')
	}
	if (frontmatter.format !== 'dialogue' && talkOpen > 0) {
		errors.push(`本文: ${frontmatter.format ?? 'article'} 形式では <Talk> を使いません`)
	}
	for (const name of requireComponents) {
		if (!counts[name]) errors.push(`本文: <${name}> を 1 つ入れてください`)
	}

	for (const [, target] of source.matchAll(/\]\(\s*<?([^)\s>]+)/g)) {
		if (!/^(https?:\/\/|\/(?!\/)|#)/.test(target)) errors.push(`本文: リンク先 "${target}" は使えません`)
	}
	let hasAffiliateLink = false
	for (const url of new Set(source.match(URL_PATTERN) ?? [])) {
		const host = hostOf(url)
		if (host && hostMatches(host, enums.affiliateHosts)) hasAffiliateLink = true
		else if (!host || !hostMatches(host, links.allowed_hosts)) errors.push(`本文: 外部リンク ${url} は許可されていません`)
	}
	if (hasAffiliateLink && frontmatter.affiliate !== true) {
		errors.push('本文: アフィリエイトリンクがあるのに affiliate: true になっていません')
	}

	errors.push(...bannedErrors('本文', body, rules))
	return errors
}

export function validateSocial(social, { rules, postUrl = 'https://example.com/post/0000000000/', slug = '0000000000' }) {
	const errors = []
	const { limits } = rules
	const text = String(social?.text ?? '').trim()
	if (!text) return ['X 投稿文: 空です']
	if (charCount(text) > limits.x_text_max) errors.push(`X 投稿文: ${charCount(text)} 字 (上限 ${limits.x_text_max} 字)`)
	if (/https?:\/\//.test(text)) errors.push('X 投稿文: URL は書かないでください (スクリプトが付けます)')
	if (/[#＃]\S/.test(text)) errors.push('X 投稿文: ハッシュタグは x_hashtags に分けてください')
	const hashtags = normalizeHashtags(social.hashtags)
	if (hashtags.length > limits.x_hashtags_max) {
		errors.push(`X 投稿文: ハッシュタグは ${limits.x_hashtags_max} 個までです (${hashtags.length} 個)`)
	}
	const weighted = weightedLength(composeTweet({ text, hashtags, postUrl, slug }))
	if (weighted > limits.x_weighted_max) {
		errors.push(`X 投稿文: URL とハッシュタグ込みで ${weighted} (上限 ${limits.x_weighted_max}) を超えます`)
	}
	errors.push(...bannedErrors('X 投稿文', `${text}\n${hashtags.join(' ')}`, rules))
	return errors
}

export function validateNote(note, { rules }) {
	const errors = []
	const { limits } = rules
	const title = String(note?.title ?? '').trim()
	const body = String(note?.body ?? '').trim()
	if (!title) errors.push('note 原稿: タイトルが空です')
	const length = charCount(body.replace(/\s/g, ''))
	if (length < limits.note_min) errors.push(`note 原稿: ${length} 字で短すぎます (下限 ${limits.note_min} 字)`)
	if (length > limits.note_max) errors.push(`note 原稿: ${length} 字で長すぎます (上限 ${limits.note_max} 字)`)
	if (/<[A-Za-z/]/.test(body)) errors.push('note 原稿: タグは使えません (プレーンな Markdown で書いてください)')
	if (/https?:\/\//.test(body)) errors.push('note 原稿: URL は書かないでください (スクリプトが付けます)')
	errors.push(...bannedErrors('note 原稿', `${title}\n${body}`, rules))
	return errors
}

/**
 * 自動生成記事 1 本ぶんの検証。
 * bundle: { slug, frontmatter, body, social?, note? }
 * ctx: { rules, enums, otherPosts: [{ slug, data }], requireComponents?, postUrl? }
 */
export function validateBundle(bundle, ctx) {
	const { slug, frontmatter, body, social, note } = bundle
	const { rules, otherPosts = [] } = ctx
	const { limits } = rules
	const errors = validateFrontmatter(slug, frontmatter, ctx)

	if (!SLUG_PATTERN.test(slug)) errors.push(`slug: "${slug}" は YYYYMMDDNN 形式にしてください`)
	else {
		const pubDate = String(frontmatter.pubDate ?? '')
		if (!/^\d{4}-\d{2}-\d{2}$/.test(pubDate)) errors.push(`pubDate: "${pubDate}" は YYYY-MM-DD にしてください`)
		else if (pubDate.replaceAll('-', '') !== slug.slice(0, 8)) errors.push(`pubDate: ${pubDate} が slug ${slug} の日付と違います`)
		const sameDay = otherPosts.find((p) => p.slug !== slug && p.data.generated === true && p.slug.startsWith(slug.slice(0, 8)))
		if (sameDay) errors.push(`重複: 同じ日の自動生成記事 ${sameDay.slug} が既にあります`)
	}

	const title = normalizeTitle(frontmatter.title)
	const sameTitle = otherPosts.find((p) => p.slug !== slug && normalizeTitle(p.data.title) === title)
	if (title && sameTitle) errors.push(`重複: タイトルが既存記事 ${sameTitle.slug} と同じです`)

	const description = String(frontmatter.description ?? '')
	if (charCount(description) < limits.description_min || charCount(description) > limits.description_max) {
		errors.push(`description: ${charCount(description)} 字 (${limits.description_min}〜${limits.description_max} 字)`)
	}
	const tags = Array.isArray(frontmatter.tags) ? frontmatter.tags : []
	if (tags.length < limits.tags_min || tags.length > limits.tags_max) {
		errors.push(`tags: ${tags.length} 個 (${limits.tags_min}〜${limits.tags_max} 個)`)
	}
	if (frontmatter.generated !== true) errors.push('generated: true にしてください')
	errors.push(...bannedErrors('title', String(frontmatter.title ?? ''), rules))
	errors.push(...bannedErrors('description', description, rules))

	errors.push(...validateBody(body, { ...ctx, frontmatter }))
	if (social) errors.push(...validateSocial(social, { ...ctx, slug }))
	if (note) errors.push(...validateNote(note, ctx))
	return errors
}

/** 既存記事を含む全記事の検証: スキーマの基本チェックとタイトルの重複 */
export function validateCollection(posts, ctx) {
	const errors = []
	const seen = new Map()
	for (const post of posts) {
		for (const error of validateFrontmatter(post.slug, post.data, ctx)) errors.push(`${post.slug}: ${error}`)
		const title = normalizeTitle(post.data.title)
		if (seen.has(title)) errors.push(`${post.slug}: タイトルが ${seen.get(title)} と重複しています`)
		else seen.set(title, post.slug)
		if (post.data.generated !== true && ctx.enums.affiliateHosts) {
			const hosts = (stripCode(post.body).match(URL_PATTERN) ?? []).map(hostOf)
			if (hosts.some((h) => h && hostMatches(h, ctx.enums.affiliateHosts)) && post.data.affiliate !== true) {
				errors.push(`${post.slug}: アフィリエイトリンクがあるのに affiliate: true になっていません`)
			}
		}
	}
	return errors
}
