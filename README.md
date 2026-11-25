# Fitness Journey ブログ

ジム習慣アプリ [Fitness Journey](https://anytimejourney.net/lp/) の公式ブログです。
「パーソナルトレーナーに通わなくても、自分で学べて続けられる」をコンセプトに、記事からアプリのインストールにつなげます。

- Astro 4 / Tailwind CSS / MDX
- 公開 URL: https://anytimejourney.netlify.app/ (Netlify, `pnpm build`)

## コマンド

```bash
pnpm install
pnpm start     # 開発サーバー (TinaCMS 付きは pnpm dev)
pnpm build     # dist/ に出力し、pagefind の検索インデックスを作る
pnpm preview
```

## 環境変数

| 変数                             | 用途                                                                                |
| -------------------------------- | ----------------------------------------------------------------------------------- |
| `SITE_URL`                       | 公開 URL。未設定なら `https://anytimejourney.netlify.app`                           |
| `PUBLIC_GA_MEASUREMENT_ID`       | GA4 の測定 ID (`G-XXXX`)。設定した時だけ GA4 を読み込む                             |
| `PUBLIC_APPSTORE_PROVIDER_TOKEN` | App Store Connect のプロバイダトークン。設定すると App Store リンクに `pt` を付ける |

## 記事の書き方

`src/content/blog/*.mdx` に置きます。ファイル名が URL (`/post/{ファイル名}/`) になります。

```yaml
---
title: 'タイトル (80文字以内)'
description: '説明文'
pubDate: '2026-01-01'
category: '習慣化' # src/data/categories.ts のいずれか
tags: ['習慣化']
heroImage: '../../assets/images/xxx.png' # 省略可。省略時は /og/{slug}.png を自動生成して使う
format: 'article' # article | dialogue | visual | video
affiliate: false # true で冒頭に PR 表記。本文にアフィリエイトリンクがあれば自動でも表示
cta: 'default' # habit | crowd | menu | ai | gym | data | beginner | default (記事末 CTA の訴求)
generated: false # AI 生成記事なら true
draft: false
---
```

本文では次のコンポーネントを import 無しで使えます。

```mdx
<AppCta text='このメニューをアプリで記録する' />

<GymCta brand='chocoZAP' />

<Talk who='kenta'>プロテインっていつ飲むのがいいんですか？</Talk>

<Talk who="misaki">
運動後 30 分以内が目安よ。

- 複数段落やリストも書けます
  </Talk>

<TalkCta who='misaki' text='通った日はアプリで記録しておくと続けやすいわよ' />

<Diagram
	type='flow'
	title='チェストプレスを始めるまでの流れ'
	items='重さを軽くする：15回できる重さから|シートを合わせる|座り方を整える'
/>
```

### 図解 (`<Diagram>`)

本文の途中に置くコンセプト図です。画像ではなく HTML で描くので、文字はそのまま読めて検索にも載ります。自動生成の記事には 1 本につき 1〜3 個入ります (`editorial/rules.yaml` の `diagram`)。

| type      | 用途                                             | 項目数 |
| --------- | ------------------------------------------------ | ------ |
| `flow`    | 順番に進む手順や流れ                             | 3〜6   |
| `cycle`   | 最後から最初に戻る循環                           | 3〜5   |
| `compare` | 並べて比べる                                     | 2〜3   |
| `pyramid` | 優先順位。土台 (いちばん大事なもの) から順に書く | 3〜5   |

`items` は項目を `|` で区切り、各項目を「ラベル：補足」の形で書きます (補足は省略可)。`compare` では補足を全角の `／` で区切ると箇条書きになります。`caption` で図の下に一言添えられます。

## アプリ導線と計測

ストア・LP・ジムページへのリンクは必ず `src/utils/storeLinks.ts` で生成します。

- App Store: `?ct=blog_{placement}_{slug}` (40 文字以内)
- Google Play: `&referrer=utm_source%3Dblog%26utm_medium%3D{placement}%26utm_campaign%3D{slug}`
- placement: `top` / `inline` / `end` / `sticky` / `dialogue` / `gym` / `header` / `list` / `footer`
- クリック時に GA4 へ `app_cta_click` (`placement`, `slug`, `store`) を送ります

アフィリエイトリンク (`src/utils/affiliate.ts` のホスト) には自動で `rel="sponsored nofollow noopener"` と `target="_blank"` が付きます。

## 自動投稿の仕組み

毎日 1 本、記事を生成して公開し、X に投稿し、note 用の原稿を作ります。

```
daily-post.yml (毎日 06:17 JST)
  ネタ選択 → 生成 → 検証 (落ちたら 1 回だけ再生成) → pnpm build → PR 作成 (または main へ直接コミット)
post-to-x.yml (main に記事が入ったら)
  記事 URL が 200 を返すまで待つ (最大 15 分) → X に投稿 → 投稿済みを記録
```

| ファイル                       | 役割                                                                    |
| ------------------------------ | ----------------------------------------------------------------------- |
| `editorial/calendar.yaml`      | 編集カレンダー (曜日ごとのテーマ・形式・CTA) とネタ帳、アプリの種目一覧 |
| `editorial/rules.yaml`         | 検証ルール (文字数、禁止表現、使えるコンポーネント、許可ドメイン)       |
| `editorial/used-topics.json`   | 使用済みのネタの記録 (スクリプトが追記)                                 |
| `editorial/social/{slug}.json` | X の投稿文と投稿済みの記録                                              |
| `editorial/note/{slug}.md`     | note 用の原稿                                                           |
| `scripts/generate-post.mjs`    | 記事の生成                                                              |
| `scripts/validate-posts.mjs`   | 記事の検証 (CI でも実行)                                                |
| `scripts/post-to-x.mjs`        | X への投稿                                                              |

曜日は JST で判定します: 月=習慣化 / 火=筋トレメニュー / 水=マシンの使い方 / 木=食事 / 金=ジム選び / 土=宅トレ / 日=独学トレーニング。

### シークレットと変数

GitHub の Settings → Secrets and variables → Actions に設定します。

| 種類   | 名前                                                                | 用途                                                                           |
| ------ | ------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| secret | `ANTHROPIC_API_KEY`                                                 | 記事の生成 (必須)                                                              |
| secret | `X_API_KEY` `X_API_SECRET` `X_ACCESS_TOKEN` `X_ACCESS_TOKEN_SECRET` | X への投稿 (OAuth 1.0a。アプリの権限は Read and write)。無ければ投稿をスキップ |
| 変数   | `AUTO_PUBLISH`                                                      | `true` で自動公開モード。未設定なら PR 確認モード                              |
| 変数   | `SITE_URL`                                                          | 公開 URL。未設定なら `https://anytimejourney.netlify.app`                      |
| 変数   | `ANTHROPIC_MODEL`                                                   | 生成に使うモデル ID。未設定なら `claude-opus-5-5`                              |

PR 確認モードでは、Settings → Actions → General の「Allow GitHub Actions to create and approve pull requests」を有効にしてください。

### PR 確認モードと自動公開モード

- **PR 確認モード (既定)**: `auto-post/YYYYMMDD` ブランチに PR を作ります。本文に X の投稿文と note 原稿の場所が出ます。内容を確認 (必要なら修正) してマージすると公開され、X に投稿されます。
- **自動公開モード** (`AUTO_PUBLISH` = `true`): main に直接コミットして公開し、続けて X に投稿します。main へ push できないブランチ保護があると使えません。

どちらのモードでも、同じ日の記事 (または PR のブランチ) が既にあれば何もしません。note には公開されている投稿 API が無いので自動投稿しません。`editorial/note/{slug}.md` を note に貼り付けて投稿してください。

### 手動で実行する

- GitHub: Actions → Daily post → Run workflow。テーマ (`habit` / `menu` / `machine` / `food` / `gym` / `home` / `selftaught`、または `mon`〜`sun`) とネタを指定できます。
- ローカル:

```bash
ANTHROPIC_API_KEY=... pnpm post:generate                     # 今日 (JST) の記事
pnpm post:generate --theme gym --topic "ジム 見学 持ち物"     # テーマとネタを指定
pnpm post:generate --date 2026-12-01 --dry-run               # 書き出さずに生成と検証だけ
pnpm post:validate                                           # 記事の検証
pnpm post:x --dry-run                                        # X の投稿文を確認 (投稿しない)
pnpm test                                                    # 単体テスト
```

`POST_FIXTURE=tests/fixtures/draft-habit.json pnpm post:generate --date 2026-11-16` のようにすると、API を呼ばずにフィクスチャの応答でパイプラインを通せます。

### ネタを足す・ルールを変える

- ネタ: `editorial/calendar.yaml` の各テーマの `topics` に 1 行足します。上から順に使われ、使ったネタは `editorial/used-topics.json` に記録されます。ネタが尽きたテーマは、既存記事のタイトルを渡してモデルに新しい切り口を考えさせます。
- 禁止表現や文字数: `editorial/rules.yaml`。変更したら `pnpm test` を実行してください。
- 記事の書き方 (編集方針): `scripts/lib/prompt.mjs` のシステムプロンプト。

### 止める

- 一時的に止める: Actions → Daily post → 「…」→ Disable workflow。X への投稿だけ止めるなら Post to X を Disable。
- 自動公開をやめて確認に戻す: 変数 `AUTO_PUBLISH` を削除 (または `false`)。
- 公開済みの記事を取り下げる: 記事の frontmatter を `draft: true` にするか、ファイルを削除します。

### X の二重投稿防止

投稿すると `editorial/social/{slug}.json` の `x.postedAt` に日時を書いて main にコミットします。`postedAt` がある記事は再投稿しません。対象は公開から 3 日以内の未投稿の記事だけです (それより古い記事は Post to X を slug 指定で手動実行)。同じ文面の再投稿は X 側でも拒否され、その場合は投稿済みとして記録します。

## ライセンス

[danielcgilibert/blog-template](https://github.com/danielcgilibert/blog-template) (GPL-3.0) をベースにしています。OGP 画像用フォント Noto Sans JP は SIL Open Font License 1.1 です (`src/assets/fonts/OFL.txt`)。
