import { isAffiliateUrl } from './affiliate.ts'

/**
 * アフィリエイトリンクに rel="sponsored nofollow noopener" と target="_blank" を付ける rehype プラグイン
 */
export function rehypeAffiliateLinks() {
	const walk = (node: any) => {
		if (
			node.type === 'element' &&
			node.tagName === 'a' &&
			typeof node.properties?.href === 'string' &&
			isAffiliateUrl(node.properties.href)
		) {
			node.properties.rel = ['sponsored', 'nofollow', 'noopener']
			node.properties.target = '_blank'
		}
		if (Array.isArray(node.children)) node.children.forEach(walk)
	}
	return (tree: any) => walk(tree)
}
