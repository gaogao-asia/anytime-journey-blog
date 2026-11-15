interface SiteConfig {
	author: string
	title: string
	description: string
	lang: string
	ogLocale: string
	shareMessage: string
	paginationSize: number
	accentColor: string
	logo: string
}

export const siteConfig: SiteConfig = {
	author: 'Fitness Journey', // Site author
	title: 'Fitness Journey ブログ', // Site title.
	description:
		'パーソナルトレーナーに通わなくても、自分で学べて続けられる。筋トレの基礎知識やメニューの組み方、ジム通いを習慣にするコツを届ける Fitness Journey 公式ブログです。', // Description to display in the meta tags
	lang: 'ja',
	ogLocale: 'ja_JP',
	shareMessage: '記事をシェアする', // Message to share a post on social media
	paginationSize: 6, // Number of posts per page
	accentColor: '#FC5304',
	logo: '/app/logo-square.png'
}
