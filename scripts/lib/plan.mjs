import fs from 'node:fs'
import YAML from 'yaml'
import { paths } from './paths.mjs'

export function loadCalendar(root) {
	return YAML.parse(fs.readFileSync(paths(root).calendar, 'utf8'))
}

/** 曜日 (または手動指定のテーマ ID / 曜日キー) からテーマを決める */
export function resolveTheme(calendar, weekday, override) {
	const key = override ? calendar.weekdays[override] ?? override : calendar.weekdays[weekday]
	const theme = calendar.themes[key]
	if (!theme) {
		const known = [...Object.keys(calendar.themes), ...Object.keys(calendar.weekdays)].join(', ')
		throw new Error(`テーマ "${override ?? weekday}" がありません (指定できる値: ${known})`)
	}
	return { id: key, ...theme }
}

export function loadUsedTopics(root) {
	const file = paths(root).used
	if (!fs.existsSync(file)) return []
	return JSON.parse(fs.readFileSync(file, 'utf8'))
}

const normalizeTopic = (topic) => String(topic).normalize('NFKC').toLowerCase().replace(/\s+/g, '')

/**
 * 未使用のネタを上から 1 本選ぶ。尽きていれば null (モデルに新しい切り口を考えさせる)。
 * 使用済みかどうかはテーマをまたいで判定する。
 */
export function pickTopic(theme, used) {
	const usedSet = new Set(used.map((entry) => normalizeTopic(entry.topic)))
	return (theme.topics ?? []).find((topic) => !usedSet.has(normalizeTopic(topic))) ?? null
}

export function recordUsedTopic(root, entry) {
	const used = loadUsedTopics(root)
	used.push(entry)
	fs.writeFileSync(paths(root).used, `${JSON.stringify(used, null, '\t')}\n`)
}

/** プロンプトに渡す種目一覧 */
export function formatExercises(calendar) {
	return Object.entries(calendar.exercises ?? {})
		.map(([category, names]) => `- ${category}: ${names.join('、')}`)
		.join('\n')
}
