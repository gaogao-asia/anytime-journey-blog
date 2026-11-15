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
```

## アプリ導線と計測

ストア・LP・ジムページへのリンクは必ず `src/utils/storeLinks.ts` で生成します。

- App Store: `?ct=blog_{placement}_{slug}` (40 文字以内)
- Google Play: `&referrer=utm_source%3Dblog%26utm_medium%3D{placement}%26utm_campaign%3D{slug}`
- placement: `top` / `inline` / `end` / `sticky` / `dialogue` / `gym` / `header` / `list` / `footer`
- クリック時に GA4 へ `app_cta_click` (`placement`, `slug`, `store`) を送ります

アフィリエイトリンク (`src/utils/affiliate.ts` のホスト) には自動で `rel="sponsored nofollow noopener"` と `target="_blank"` が付きます。

## ライセンス

[danielcgilibert/blog-template](https://github.com/danielcgilibert/blog-template) (GPL-3.0) をベースにしています。OGP 画像用フォント Noto Sans JP は SIL Open Font License 1.1 です (`src/assets/fonts/OFL.txt`)。
