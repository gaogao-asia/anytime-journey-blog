// モデルの構造化出力から、記事ファイル・X 用サイドカー・note 原稿を組み立てる
import { composeTweet, normalizeHashtags } from './x.mjs'

const LP_URL = 'https://anytimejourney.net/lp/'
const NOTE_FOOTER_RULE = '\n---\n'

const clean = (value) => String(value ?? '').replace(/\r\n/g, '\n').trim()

/** モデルの出力と編集カレンダーから検証用の bundle を作る。カテゴリ・形式・CTA はカレンダーが決める */
export function buildBundle({ slug, date, theme, draft }) {
	return {
		slug,
		frontmatter: {
			title: clean(draft.title),
			description: clean(draft.description).replace(/\s*\n\s*/g, ' '),
			pubDate: date.ymd,
			category: theme.category,
			tags: (draft.tags ?? []).map(clean).filter(Boolean),
			format: theme.format,
			affiliate: false,
			cta: theme.cta,
			generated: true,
			draft: false
		},
		body: clean(draft.body_mdx),
		social: { text: clean(draft.x_text), hashtags: normalizeHashtags(draft.x_hashtags) },
		note: { title: clean(draft.note_title), body: clean(draft.note_body) },
		topic: clean(draft.topic)
	}
}

/** frontmatter は JSON 形式の値で書く (JSON の文字列・配列・真偽値はそのまま有効な YAML) */
export function renderPostFile({ frontmatter, body }) {
	const yaml = Object.entries(frontmatter)
		.map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
		.join('\n')
	return `---\n${yaml}\n---\n\n${body}\n`
}

export function renderSocialFile({ slug, frontmatter, social }, postUrl) {
	const sidecar = {
		slug,
		title: frontmatter.title,
		url: postUrl,
		x: {
			text: social.text,
			hashtags: social.hashtags,
			tweet: composeTweet({ ...social, postUrl, slug }),
			postedAt: null,
			tweetId: null
		},
		note: `editorial/note/${slug}.md`
	}
	return `${JSON.stringify(sidecar, null, '\t')}\n`
}

export function renderNoteFile({ slug, frontmatter, note }, postUrl) {
	const link = `${postUrl}?utm_source=note&utm_medium=social&utm_campaign=${slug}`
	const app = `${LP_URL}?utm_source=note&utm_medium=social&utm_campaign=${slug}`
	return [
		`# ${note.title}`,
		'',
		note.body,
		'',
		'---',
		'',
		`手順やポイントを詳しくまとめた記事はこちら: [${frontmatter.title}](${link})`,
		'',
		`ジムに行った日を記録して、週間目標で習慣にするアプリ [Fitness Journey](${app}) は無料で使えます。`,
		''
	].join('\n')
}

/** note 原稿ファイルをタイトルと本文 (末尾の区切り線より前) に戻す */
export function parseNoteFile(source) {
	const end = source.lastIndexOf(NOTE_FOOTER_RULE)
	const main = end === -1 ? source : source.slice(0, end)
	const match = /^# +(.*)\n([\s\S]*)$/.exec(main.trim())
	return match ? { title: match[1].trim(), body: match[2].trim() } : { title: '', body: main.trim() }
}
