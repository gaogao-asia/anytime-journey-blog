import { toString } from 'mdast-util-to-string'

// 日本語の平均的な読書速度 (文字/分)
const CHARS_PER_MINUTE = 600

/**
 * Injects `minutesRead` into frontmatter processed by Remark.
 */
export function remarkReadingTime() {
	return function (tree: unknown, { data }: any) {
		const length = toString(tree).replace(/\s+/g, '').length
		const minutes = Math.max(1, Math.ceil(length / CHARS_PER_MINUTE))
		data.astro.frontmatter.minutesRead = `${minutes}分で読める`
	}
}
