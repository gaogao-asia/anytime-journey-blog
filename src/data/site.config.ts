interface SiteConfig {
	author: string
	title: string
	description: string
	lang: string
	ogLocale: string
	shareMessage: string
	paginationSize: number
}

export const siteConfig: SiteConfig = {
	author: 'Anytime Journey', // Site author
	title: 'Anytime Journeyブログ', // Site title.
	description: 'フィットネスに必要な知識や商品を紹介します!', // Description to display in the meta tags
	lang: 'ja',
	ogLocale: 'ja',
	shareMessage: '記事をシェアする', // Message to share a post on social media
	paginationSize: 6 // Number of posts per page
}
