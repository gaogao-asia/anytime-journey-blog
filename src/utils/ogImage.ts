// 記事ごとの OGP 画像 (1200x630 PNG) をビルド時に生成する。フォントは repo に同梱したものだけを使う
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import satori from 'satori'
import { Resvg } from '@resvg/resvg-js'
import { siteConfig } from '../data/site.config'

export const OG_WIDTH = 1200
export const OG_HEIGHT = 630

const FONT_DIR = join(process.cwd(), 'src', 'assets', 'fonts')
// 日本語サブセットは英数字のグリフも含むので 1 ファイルで足りる
const FONT_FILES = ['noto-sans-jp-japanese-700-normal.woff']

let assets: Promise<{ fonts: any[]; logo: string }> | undefined

const loadAssets = () =>
	(assets ??= (async () => {
		const fonts = await Promise.all(
			FONT_FILES.map(async (file) => ({
				name: 'Noto Sans JP',
				data: await readFile(join(FONT_DIR, file)),
				weight: 700 as const,
				style: 'normal' as const
			}))
		)
		const logo = await readFile(join(process.cwd(), 'public', siteConfig.logo))
		return { fonts, logo: `data:image/png;base64,${logo.toString('base64')}` }
	})())

const h = (type: string, style: Record<string, unknown>, children?: unknown, props = {}) => ({
	type,
	props: { style, children, ...props }
})

const titleFontSize = (title: string) => (title.length <= 28 ? 68 : title.length <= 48 ? 56 : 46)

export async function renderOgImage({
	title,
	category,
	subtitle
}: {
	title: string
	category?: string
	subtitle?: string
}): Promise<Buffer> {
	const { fonts, logo } = await loadAssets()
	const accent = siteConfig.accentColor

	const BAR = 20
	const PADDING_X = 72
	// satori は padding を幅に加算するため、内側の幅と高さを明示する
	const tree = h(
		'div',
		{
			width: OG_WIDTH,
			height: OG_HEIGHT,
			display: 'flex',
			flexDirection: 'column',
			backgroundColor: '#ffffff',
			fontFamily: 'Noto Sans JP',
			color: '#1c1917'
		},
		[
			h('div', { width: OG_WIDTH, height: BAR, backgroundColor: accent }),
			h(
				'div',
				{
					width: OG_WIDTH - PADDING_X * 2,
					height: OG_HEIGHT - BAR - 96,
					marginLeft: PADDING_X,
					marginTop: 44,
					display: 'flex',
					flexDirection: 'column',
					justifyContent: 'space-between'
				},
				content(title, category, subtitle, logo, accent)
			)
		]
	)

	const svg = await satori(tree as any, { width: OG_WIDTH, height: OG_HEIGHT, fonts })
	return new Resvg(svg, { fitTo: { mode: 'width', value: OG_WIDTH } }).render().asPng()
}

const content = (
	title: string,
	category: string | undefined,
	subtitle: string | undefined,
	logo: string,
	accent: string
) => [
	h('div', { display: 'flex', alignItems: 'center', justifyContent: 'space-between' }, [
		h('div', { display: 'flex', alignItems: 'center' }, [
			h('img', { width: 72, height: 72 }, undefined, { src: logo, width: 72, height: 72 }),
			h('div', { fontSize: 30, marginLeft: 12 }, siteConfig.title)
		]),
		category
			? h(
					'div',
					{
						display: 'flex',
						fontSize: 26,
						color: '#ffffff',
						backgroundColor: accent,
						borderRadius: 999,
						padding: '8px 28px'
					},
					category
			  )
			: h('div', { display: 'flex' })
	]),
	h(
		'div',
		{
			display: 'flex',
			fontSize: titleFontSize(title),
			lineHeight: 1.35,
			letterSpacing: '-0.01em'
		},
		title
	),
	h('div', { display: 'flex', alignItems: 'center', fontSize: 26, color: '#57534e' }, [
		h('div', { width: 48, height: 6, backgroundColor: accent, marginRight: 16 }),
		subtitle ?? 'ジム通いが続く習慣化アプリ Fitness Journey'
	])
]
