// <Diagram> の items 属性の読み方。表示 (src/components/mdx/Diagram.astro) と
// 検証 (scripts/lib/validate.mjs) が同じ解釈になるよう、ここだけに置く。
//
//   items="ラベル：補足|ラベル：補足|ラベル"
//     |  (半角・全角) で項目を区切る
//     ： (半角・全角) の最初の 1 つでラベルと補足を分ける。補足は省略できる
//     ／ (全角) で補足を複数の点に分ける

export const DIAGRAM_TYPES = ['flow', 'cycle', 'compare', 'pyramid']

/** @returns {{ label: string, detail: string, points: string[] }[]} */
export function parseDiagramItems(items) {
	return String(items ?? '')
		.split(/[|｜]/)
		.map((raw) => raw.trim())
		.filter(Boolean)
		.map((raw) => {
			const at = raw.search(/[:：]/)
			const label = at === -1 ? raw : raw.slice(0, at).trim()
			const detail = at === -1 ? '' : raw.slice(at + 1).trim()
			const points = detail
				.split('／')
				.map((point) => point.trim())
				.filter(Boolean)
			return { label, detail, points }
		})
}
