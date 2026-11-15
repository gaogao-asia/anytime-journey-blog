// アプリ導線のリンクを計測パラメータ付きで生成する。ストア/LP/ジムページへのリンクは必ずここを通すこと。

export const APP_NAME = 'Fitness Journey'
export const LP_URL = 'https://anytimejourney.net/lp/'
export const APP_STORE_URL = 'https://apps.apple.com/jp/app/fitnessjourney/id6451079440'
export const GOOGLE_PLAY_URL =
	'https://play.google.com/store/apps/details?id=net.anytimejourney.app'
export const GYMS_URL = 'https://anytimejourney.net/gyms'

export const PLACEMENTS = [
	'top',
	'inline',
	'end',
	'sticky',
	'dialogue',
	'gym',
	'header',
	'list',
	'footer'
] as const
export type Placement = (typeof PLACEMENTS)[number]

const CT_MAX_LENGTH = 40

/** 計測用に ASCII の安全な文字だけへ正規化する */
const sanitize = (value: string) =>
	value
		.toLowerCase()
		.replace(/[^a-z0-9_-]+/g, '-')
		.replace(/^-+|-+$/g, '')

/** ページのパスから計測用 slug を作る (/post/foo/ -> foo, / -> home, /category/x/1 -> category) */
export function pageSlug(pathname: string): string {
	const parts = pathname.split('/').filter(Boolean)
	if (parts.length === 0) return 'home'
	if (parts[0] === 'post' && parts.length > 1) return sanitize(parts.slice(1).join('-')) || 'post'
	return sanitize(parts[0]) || 'page'
}

/** App Store: ?ct=blog_{placement}_{slug} (40文字以内) */
export function appStoreUrl(placement: Placement, slug: string): string {
	const ct = `blog_${placement}_${sanitize(slug)}`.slice(0, CT_MAX_LENGTH)
	const url = new URL(APP_STORE_URL)
	// App Store Connect のキャンペーン計測にはプロバイダトークン(pt)が必要。設定されていれば付与する
	const pt = import.meta.env.PUBLIC_APPSTORE_PROVIDER_TOKEN
	if (pt) {
		url.searchParams.set('pt', pt)
		url.searchParams.set('mt', '8')
	}
	url.searchParams.set('ct', ct)
	return url.href
}

const utm = (placement: Placement, slug: string) =>
	`utm_source=blog&utm_medium=${placement}&utm_campaign=${sanitize(slug)}`

/** Google Play: &referrer= に utm パラメータを URL エンコードして渡す */
export function googlePlayUrl(placement: Placement, slug: string): string {
	return `${GOOGLE_PLAY_URL}&referrer=${encodeURIComponent(utm(placement, slug))}`
}

/** LP (PC など OS を判定できない場合の遷移先) */
export function lpUrl(placement: Placement, slug: string): string {
	return `${LP_URL}?${utm(placement, slug)}`
}

/** 公開ジムページ。brand を渡すとそのブランドで絞り込む */
export function gymsUrl(placement: Placement, slug: string, brand?: string): string {
	const query = brand ? `brand=${encodeURIComponent(brand)}&` : ''
	return `${GYMS_URL}?${query}${utm(placement, slug)}`
}

export function appLinks(placement: Placement, slug: string) {
	return {
		ios: appStoreUrl(placement, slug),
		android: googlePlayUrl(placement, slug),
		lp: lpUrl(placement, slug)
	}
}
