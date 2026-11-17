// アフィリエイトリンクとして扱うホスト(サブドメインを含む)
export const AFFILIATE_HOSTS = [
	'amzn.to',
	'amzn.asia',
	'amazon.co.jp',
	'a8.net',
	'afl.rakuten.co.jp',
	'r10.to',
	'valuecommerce.com',
	'moshimo.com',
	'accesstrade.net',
	'linksynergy.com'
]

export function isAffiliateUrl(href: string): boolean {
	let host: string
	try {
		host = new URL(href).hostname.toLowerCase()
	} catch {
		return false
	}
	return AFFILIATE_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))
}

/** 本文(Markdown/MDX のソース)にアフィリエイトリンクが含まれるか */
export function hasAffiliateLink(body: string): boolean {
	const urls = body.match(/https?:\/\/[^\s)"'<>\]]+/g) ?? []
	return urls.some(isAffiliateUrl)
}
