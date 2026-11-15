#!/usr/bin/env node
// 生成した記事の確認用サマリー (Markdown) を出力する。PR 本文とジョブサマリーに使う。
//   node scripts/post-summary.mjs <slug>
import fs from 'node:fs'
import path from 'node:path'
import { ROOT, paths } from './lib/paths.mjs'
import { loadPosts } from './lib/posts.mjs'
import { loadUsedTopics } from './lib/plan.mjs'

const slug = process.argv[2]
const post = loadPosts(ROOT).find((p) => p.slug === slug)
if (!post) {
	console.error(`記事 ${slug} がありません`)
	process.exit(1)
}
const sidecar = JSON.parse(fs.readFileSync(path.join(paths(ROOT).social, `${slug}.json`), 'utf8'))
const used = loadUsedTopics(ROOT).find((entry) => entry.slug === slug)
const quote = (text) => text.split('\n').map((line) => `> ${line}`).join('\n')

console.log(`## 自動生成記事: ${post.data.title}

| 項目 | 内容 |
| --- | --- |
| 記事 | \`src/content/blog/${slug}.mdx\` |
| 公開 URL | ${sidecar.url} |
| カテゴリ / 形式 / CTA | ${post.data.category} / ${post.data.format} / ${post.data.cta} |
| ネタ | ${used?.topic ?? '-'} |
| X 投稿文 | \`editorial/social/${slug}.json\` |
| note 原稿 | \`${sidecar.note}\` |

### X 投稿文 (公開後に自動投稿)

${quote(sidecar.x.tweet)}

### note 原稿 (手動で投稿)

note には公開されている投稿 API が無いため、自動投稿しません。\`${sidecar.note}\` の内容を note に貼り付けて投稿してください。

### 確認すること

- [ ] 事実と数値に誤りがない (ジムチェーンの料金・店舗数などの具体的な数字が書かれていない)
- [ ] 効果の保証や、病気の治療・予防をうたう表現がない
- [ ] アプリに無い機能を紹介していない
- [ ] X 投稿文と note 原稿の内容が記事と合っている`)
