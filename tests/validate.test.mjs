import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
	findBannedPhrases,
	validateBody,
	validateBundle,
	validateCollection,
	validateNote,
	validateSocial,
	visibleLength
} from '../scripts/lib/validate.mjs'
import { ctx, rules, validBundle } from './helpers.mjs'

const has = (errors, pattern) => errors.some((error) => pattern.test(error))
const banned = (text) => findBannedPhrases(text, rules.banned).map((hit) => hit.id)

/** 本文の一部を差し替え・追記して検証する */
const bodyErrors = (edit, extra = {}) => {
	const bundle = validBundle()
	const { frontmatter: fm, ...rest } = extra
	const frontmatter = { ...bundle.frontmatter, ...(fm ?? {}) }
	return validateBody(edit(bundle.body), { ...ctx(), frontmatter, ...rest })
}
const append = (text) => (body) => `${body}\n\n${text}\n`

test('フィクスチャの記事は検証に通る', () => {
	assert.deepEqual(validateBundle(validBundle(), ctx()), [])
})

test('本文の長さ', () => {
	assert.ok(has(bodyErrors((body) => body.slice(0, 600)), /短すぎます/))
	assert.ok(has(bodyErrors((body) => body + 'あ'.repeat(4000)), /長すぎます/))
	// タグ・URL・Markdown 記号は数えない
	assert.equal(visibleLength('## 見出し\n\n<AppCta text="x" />\n\n- **太字** [リンク](https://example.com)'), 8)
})

test('title は 80 字以内', () => {
	assert.deepEqual(validateBundle(validBundle({ frontmatter: { title: 'あ'.repeat(80) } }), ctx()), [])
	assert.ok(has(validateBundle(validBundle({ frontmatter: { title: 'あ'.repeat(81) } }), ctx()), /title: 81 字/))
})

test('category / cta / format は定義済みの値だけ', () => {
	const errors = validateBundle(validBundle({ frontmatter: { category: '雑談', cta: 'sale', format: 'podcast' } }), ctx())
	assert.ok(has(errors, /category: "雑談"/))
	assert.ok(has(errors, /cta: "sale"/))
	assert.ok(has(errors, /format: "podcast"/))
})

test('slug は YYYYMMDDNN で、pubDate と日付が一致する', () => {
	assert.ok(has(validateBundle(validBundle({ slug: 'gym-twice-a-week' }), ctx()), /YYYYMMDDNN/))
	assert.ok(has(validateBundle(validBundle({ slug: '週2回' }), ctx()), /ASCII/))
	assert.ok(has(validateBundle(validBundle({ frontmatter: { pubDate: '2026-11-17' } }), ctx()), /日付と違います/))
	assert.ok(has(validateBundle(validBundle({ frontmatter: { pubDate: 'Nov 16 2026' } }), ctx()), /YYYY-MM-DD/))
})

test('同じ日の自動生成記事・同じタイトルの記事があれば失敗', () => {
	const bundle = validBundle()
	const sameDay = [{ slug: '2026111602', data: { title: '別の記事', generated: true } }]
	assert.ok(has(validateBundle(bundle, ctx({ otherPosts: sameDay })), /同じ日の自動生成記事 2026111602/))
	// 手書きの記事が同じ日にあるのは構わない
	const manual = [{ slug: '2026111602', data: { title: '別の記事' } }]
	assert.deepEqual(validateBundle(bundle, ctx({ otherPosts: manual })), [])
	// 自分自身とは比較しない
	assert.deepEqual(validateBundle(bundle, ctx({ otherPosts: [{ slug: bundle.slug, data: bundle.frontmatter }] })), [])

	const sameTitle = [{ slug: '2024010101', data: { title: ` ${bundle.frontmatter.title.replace('？', '?')} ` } }]
	assert.ok(has(validateBundle(bundle, ctx({ otherPosts: sameTitle })), /タイトルが既存記事 2024010101 と同じ/))
})

test('全記事チェック: タイトル重複とアフィリエイト表記', () => {
	const posts = [
		{ slug: 'a', data: { title: '同じ', description: 'd', category: '習慣化', tags: [] }, body: '' },
		{ slug: 'b', data: { title: '同じ', description: 'd', category: '習慣化', tags: [] }, body: '' },
		{ slug: 'c', data: { title: '商品', description: 'd', category: 'おすすめ商品', tags: [] }, body: '[x](https://amzn.to/abc)' },
		{ slug: 'd', data: { title: '商品2', description: 'd', category: 'おすすめ商品', tags: [], affiliate: true }, body: '[x](https://amzn.to/abc)' }
	]
	const errors = validateCollection(posts, ctx())
	assert.equal(errors.length, 2)
	assert.ok(has(errors, /^b: タイトルが a と重複/))
	assert.ok(has(errors, /^c: アフィリエイトリンク/))
})

test('禁止表現: 落ちる例', () => {
	assert.deepEqual(banned('このメニューなら必ず痩せる。'), ['guarantee-weight-loss'])
	assert.deepEqual(banned('誰でも簡単にやせられます'), ['guarantee-weight-loss'])
	assert.deepEqual(banned('飲むだけで痩せると話題'), ['only-by'])
	assert.deepEqual(banned('30日で5kg落とす方法'), ['numeric-promise'])
	assert.deepEqual(banned('2週間で−3キロを目指す'), ['numeric-promise'])
	assert.deepEqual(banned('絶対に効果が出ます'), ['absolutely'])
	assert.deepEqual(banned('ストレッチで腰痛が治る'), ['cure'])
	assert.deepEqual(banned('肩こりを治すトレーニング'), ['cure'])
	assert.deepEqual(banned('運動は糖尿病の予防になります'), ['disease-claim'])
	assert.deepEqual(banned('効果を保証します'), ['guarantee'])
	assert.deepEqual(banned('医師が推奨するメニュー'), ['authority'])
	assert.deepEqual(banned('科学的に証明された方法'), ['proven'])
	assert.deepEqual(banned('BCAA は筋肉痛に効く'), ['supplement-efficacy'])
	assert.deepEqual(banned('日本一わかりやすい解説'), ['superlative'])
	assert.deepEqual(banned('人気No.1のジム'), ['superlative'])
	assert.deepEqual(banned('満足度 No1 のアプリ'), ['superlative'])
	assert.deepEqual(banned('ある研究では週2回で筋力が30%向上しました'), ['fabricated-source'])
	assert.deepEqual(banned('私も去年、体重が8kg減りました'), ['fake-experience'])
})

test('禁止表現: 文脈で誤検出しない例', () => {
	// 種目が筋肉に「効く」はサプリの文脈ではない
	assert.deepEqual(banned('ラットプルダウンは背中に効く種目です'), [])
	// サプリの話でも、別の文なら対象外。否定は許可
	assert.deepEqual(banned('プロテインは食事の補助です。レッグプレスは太ももに効く種目です'), [])
	assert.deepEqual(banned('プロテインが疲労に効くとは言えません'), [])
	// 注意喚起・否定
	assert.deepEqual(banned('痛みがあるときは絶対に無理をしないでください'), [])
	assert.deepEqual(banned('これが絶対ではありません'), [])
	assert.deepEqual(banned('効果を保証するものではありません'), [])
	assert.deepEqual(banned('痛みが治らない場合は医師に相談しましょう'), [])
	assert.deepEqual(banned('持病がある方は、運動を始める前に医師に相談してください'), [])
	// 読者への注意喚起として強い宣伝文句を引用している文 (2026-11-22 の生成が落ちた実例)
	assert.deepEqual(banned('- 「これだけで」「絶対」など、効果を言い切りすぎていないか'), [])
	assert.deepEqual(banned('- 効果を保証するような強い言い切りばかりになっていないか（体の変化には個人差があるのが前提）'), [])
	assert.deepEqual(banned('「飲むだけで痩せる」とうたう商品には注意しましょう'), [])
	assert.deepEqual(banned('「必ず痩せる」という宣伝文句は疑ってかかりましょう'), [])
	// 注意喚起の形をしていない断定は、引き続き違反
	assert.deepEqual(banned('このやり方なら絶対に結果が出るので安心です'), ['absolutely'])
	assert.deepEqual(banned('続ければ効果は保証されます'), ['guarantee'])
	// 回数やセット数の数字、種目番号
	assert.deepEqual(banned('10〜15回を3セット。No.10 のマシンを使います'), [])
	assert.deepEqual(banned('2〜3か月続けて、重さを5kg上げてみましょう'), [])
	assert.deepEqual(banned('3か月で扱える重さが5kgほど変わる人もいます'), [])
})

test('禁止表現は本文・タイトル・説明文・X 投稿文・note 原稿のすべてで検出する', () => {
	assert.ok(has(bodyErrors(append('これで必ず痩せる。')), /本文: 禁止表現「必ず痩せる」/))
	assert.ok(has(validateBundle(validBundle({ frontmatter: { title: '絶対に続くジム通いのコツ' } }), ctx()), /title: 禁止表現/))
	const description = `${validBundle().frontmatter.description}腰痛も治る。`
	assert.ok(has(validateBundle(validBundle({ frontmatter: { description } }), ctx()), /description: 禁止表現/))
	assert.ok(has(validateSocial({ text: '日本一続くジム通いの方法', hashtags: [] }, ctx()), /X 投稿文: 禁止表現/))
	assert.ok(has(validateNote({ title: 't', body: `${validBundle().note.body}\n医師が推奨しています。` }, ctx()), /note 原稿: 禁止表現/))
})

test('MDX: 許可していないコンポーネントと生の HTML', () => {
	assert.ok(has(bodyErrors(append('<Video src="a.mp4" />')), /<Video> は許可されていない/))
	assert.ok(has(bodyErrors(append('<script>alert(1)</script>')), /<script> は使えません/))
	assert.ok(has(bodyErrors(append('<IFRAME src="https://example.com"></IFRAME>')), /<IFRAME> は許可されていない/))
	assert.ok(has(bodyErrors(append('<iframe src="https://example.com"></iframe>')), /<iframe> は使えません/))
	assert.ok(has(bodyErrors(append('<div class="box">x</div>')), /生の HTML タグ <div>/))
	assert.ok(has(bodyErrors(append('<!-- memo -->')), /HTML コメント/))
	assert.ok(has(bodyErrors(append('![図](../../assets/images/a.png)')), /画像は使えません/))
	// 許可したコンポーネントと、タグではない不等号は通る
	assert.deepEqual(bodyErrors(append('<GymCta brand="chocoZAP" />\n\n10回 < 15回、5 > 3')), [])
})

test('MDX: import / export 文と波括弧', () => {
	assert.ok(has(bodyErrors(append("import Foo from '@/components/Foo'")), /import \/ export/))
	assert.ok(has(bodyErrors(append('export const x = 1')), /import \/ export/))
	assert.ok(has(bodyErrors(append('合計は {1 + 1} です')), /波括弧/))
	assert.ok(has(bodyErrors(append('<AppCta text={process.env.SECRET} />')), /波括弧/))
	// 文中の単語としての import は対象外
	assert.deepEqual(bodyErrors(append('データを import する機能はありません。')), [])
})

test('MDX: Talk の書き方と形式ごとの決まり', () => {
	const talk = (who, text) => `<Talk who="${who}">\n\n${text}\n\n</Talk>`
	const dialogue = (body) => `${body}\n\n${['kenta', 'misaki', 'kenta', 'misaki', 'kenta', 'misaki'].map((w) => talk(w, 'なるほど。')).join('\n\n')}\n`
	assert.deepEqual(bodyErrors(dialogue, { frontmatter: { format: 'dialogue' } }), [])
	assert.ok(has(bodyErrors((b) => b, { frontmatter: { format: 'dialogue' } }), /dialogue 形式は <Talk>/))
	assert.ok(has(bodyErrors(dialogue), /article 形式では <Talk> を使いません/))
	assert.ok(has(bodyErrors((b) => `${dialogue(b)}\n${talk('taro', 'やあ')}`, { frontmatter: { format: 'dialogue' } }), /who="taro"/))
	assert.ok(has(bodyErrors((b) => `${dialogue(b)}\n<Talk who="kenta">\n\n閉じ忘れ\n`, { frontmatter: { format: 'dialogue' } }), /数が合いません/))
})

test('MDX: アプリ導線は 1 回まで、必須コンポーネントの確認', () => {
	assert.ok(has(bodyErrors(append('<AppCta text="もう一度" />')), /1 回まで/))
	assert.ok(has(bodyErrors((b) => b, { requireComponents: ['GymCta'] }), /<GymCta> を 1 つ/))
	assert.deepEqual(bodyErrors(append('<GymCta />'), { requireComponents: ['GymCta'] }), [])
})

test('見出し: h2 が必要で、h1 は使えない', () => {
	assert.ok(has(bodyErrors((body) => body.replace(/^## /gm, '### ')), /h2 見出し/))
	assert.ok(has(bodyErrors((body) => `# タイトル\n\n${body}`), /h1 見出し/))
})

test('リンク: 許可ドメイン以外の外部リンクは失敗', () => {
	assert.ok(has(bodyErrors(append('[公式](https://example.com/gym)')), /外部リンク https:\/\/example\.com\/gym/))
	assert.ok(has(bodyErrors(append('詳しくは https://evil.example.net/x を参照')), /外部リンク/))
	assert.ok(has(bodyErrors(append('[x](https://anytimejourney.net.evil.com/)')), /外部リンク/))
	assert.ok(has(bodyErrors(append('[x](javascript:alert(1))')), /リンク先 "javascript:alert\(1" は使えません/))
	assert.deepEqual(bodyErrors(append('[ジムを探す](https://anytimejourney.net/gyms) / [LP](https://www.anytimejourney.net/lp/) / [関連記事](/post/2024082701/)')), [])
})

test('アフィリエイトリンクがあるのに affiliate: true でなければ失敗', () => {
	const link = append('[プロテイン](https://amzn.to/3zxzjNA) と [楽天](https://hb.afl.rakuten.co.jp/x)')
	assert.ok(has(bodyErrors(link), /affiliate: true になっていません/))
	assert.deepEqual(bodyErrors(link, { frontmatter: { affiliate: true } }), [])
})

test('X 投稿文: 長さ・URL・ハッシュタグ', () => {
	assert.deepEqual(validateSocial({ text: 'あ'.repeat(110), hashtags: ['筋トレ', 'ジム'] }, ctx()), [])
	assert.ok(has(validateSocial({ text: 'あ'.repeat(111), hashtags: [] }, ctx()), /111 字/))
	assert.ok(has(validateSocial({ text: '', hashtags: [] }, ctx()), /空です/))
	assert.ok(has(validateSocial({ text: '詳しくは https://example.com', hashtags: [] }, ctx()), /URL は書かないで/))
	assert.ok(has(validateSocial({ text: '週2回で十分 #筋トレ', hashtags: [] }, ctx()), /x_hashtags に分けて/))
	assert.ok(has(validateSocial({ text: '週2回で十分', hashtags: ['a', 'b', 'c'] }, ctx()), /2 個まで/))
	// 110 字以内でも、長いハッシュタグと URL を足して X の上限を超えるなら失敗
	const long = { text: 'あ'.repeat(110), hashtags: ['い'.repeat(12), 'う'.repeat(12)] }
	assert.ok(has(validateSocial(long, ctx()), /URL とハッシュタグ込みで/))
})

test('note 原稿: 長さ・タグ・URL', () => {
	const { note } = validBundle()
	assert.deepEqual(validateNote(note, ctx()), [])
	assert.ok(has(validateNote({ ...note, body: note.body.slice(0, 300) }, ctx()), /短すぎます/))
	assert.ok(has(validateNote({ ...note, body: note.body + 'あ'.repeat(1000) }, ctx()), /長すぎます/))
	assert.ok(has(validateNote({ ...note, body: `${note.body}\n<AppCta />` }, ctx()), /タグは使えません/))
	assert.ok(has(validateNote({ ...note, body: `${note.body}\nhttps://example.com` }, ctx()), /URL は書かないで/))
	assert.ok(has(validateNote({ ...note, title: '' }, ctx()), /タイトルが空/))
})

test('generated / description / tags', () => {
	assert.ok(has(validateBundle(validBundle({ frontmatter: { generated: false } }), ctx()), /generated: true/))
	assert.ok(has(validateBundle(validBundle({ frontmatter: { description: '短い' } }), ctx()), /description: 2 字/))
	assert.ok(has(validateBundle(validBundle({ frontmatter: { tags: [] } }), ctx()), /tags: 0 個/))
})

test('図解: <Diagram> の種類・項目数・文字数', () => {
	const diagram = (attrs) => append(`<Diagram ${attrs} />`)
	const items = 'ひとつめ：補足|ふたつめ|みっつめ'
	assert.deepEqual(bodyErrors(diagram(`type="flow" title="流れ" items="${items}"`)), [])
	// prettier が属性を単一引用符と複数行に整形しても読める
	assert.deepEqual(bodyErrors(append(`<Diagram\n\ttype='pyramid'\n\ttitle='優先順位'\n\titems='${items}'\n/>`)), [])
	assert.deepEqual(bodyErrors(diagram('type="compare" title="比較" items="低すぎる：肩がすくむ／肩の前が疲れる|ちょうどよい：まっすぐ押せる"')), [])

	assert.ok(has(bodyErrors(diagram(`type="chart" title="流れ" items="${items}"`)), /type="chart" は使えません/))
	assert.ok(has(bodyErrors(diagram(`title="流れ" items="${items}"`)), /type="" は使えません/))
	assert.ok(has(bodyErrors(diagram(`type="flow" items="${items}"`)), /title を書いてください/))
	assert.ok(has(bodyErrors(diagram('type="flow" title="流れ" items="ひとつめ|ふたつめ"')), /flow の項目は 3〜6 個です \(2 個\)/))
	assert.ok(has(bodyErrors(diagram('type="compare" title="比較" items="A|B|C|D"')), /compare の項目は 2〜3 個/))
	assert.ok(has(bodyErrors(diagram(`type="flow" title="流れ" items="${'あ'.repeat(17)}|B|C"`)), /ラベル「あ+」が 17 字/))
	assert.ok(has(bodyErrors(diagram(`type="cycle" title="循環" items="${'あ'.repeat(11)}|B|C"`)), /上限 10 字/))
	assert.ok(has(bodyErrors(diagram(`type="flow" title="流れ" items="A：${'あ'.repeat(41)}|B|C"`)), /補足が 41 字/))
	assert.ok(has(bodyErrors(diagram('type="compare" title="比較" items="A：1／2／3／4／5|B：1"')), /4 点まで/))
	assert.ok(has(bodyErrors(append(`<Diagram type="flow" title="流れ" items="${items}">中身</Diagram>`)), /1 つのタグ/))
	// 図の中の文言も禁止表現の対象
	assert.ok(has(bodyErrors(diagram('type="flow" title="流れ" items="飲むだけで痩せる|B|C"')), /禁止表現/))
})

test('図解: 個数の上限と、新しく生成する記事の下限', () => {
	const one = '<Diagram type="flow" title="流れ" items="A|B|C" />'
	const without = (body) => body.replace(/<Diagram[^>]*>\n*/g, '')
	// 公開済みの記事 (CI の検証) には図解を求めない
	assert.deepEqual(bodyErrors(without), [])
	assert.ok(has(bodyErrors(without, { minDiagrams: 1 }), /<Diagram> を 1 個以上/))
	assert.deepEqual(bodyErrors((body) => body, { minDiagrams: 1 }), [])
	assert.ok(has(bodyErrors(append([one, one, one].join('\n\n'))), /3 個までです \(4 個\)/))
})
