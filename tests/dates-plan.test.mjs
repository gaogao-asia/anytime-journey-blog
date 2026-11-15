import assert from 'node:assert/strict'
import { test } from 'node:test'
import { jstDate } from '../scripts/lib/dates.mjs'
import { ROOT } from '../scripts/lib/paths.mjs'
import { formatExercises, loadCalendar, pickTopic, resolveTheme } from '../scripts/lib/plan.mjs'
import { enums } from './helpers.mjs'

const calendar = loadCalendar(ROOT)

test('JST の日付境界: UTC 14:59 は当日、15:00 は翌日', () => {
	assert.deepEqual(jstDate(new Date('2026-11-15T14:59:59Z')), { ymd: '2026-11-15', compact: '20261115', weekday: 'sun' })
	assert.deepEqual(jstDate(new Date('2026-11-15T15:00:00Z')), { ymd: '2026-11-16', compact: '20261116', weekday: 'mon' })
})

test('JST の日付境界: 月・年をまたぐ', () => {
	assert.equal(jstDate(new Date('2026-12-31T15:00:00Z')).ymd, '2027-01-01')
	assert.equal(jstDate(new Date('2027-02-28T14:59:00Z')).ymd, '2027-02-28')
	// 朝の定期実行 (UTC 21:17) は JST では翌日の 6:17
	assert.deepEqual(jstDate(new Date('2026-11-15T21:17:00Z')), { ymd: '2026-11-16', compact: '20261116', weekday: 'mon' })
})

test('日付文字列は JST の日付として扱い、不正な値は拒否する', () => {
	assert.equal(jstDate('2026-11-20').weekday, 'fri')
	assert.throws(() => jstDate('2026-02-30'))
	assert.throws(() => jstDate('20261120'))
})

test('曜日ごとのテーマ・形式・CTA・カテゴリ', () => {
	const expected = {
		'2026-11-16': ['mon', '習慣化', 'article', 'habit', '習慣化'],
		'2026-11-17': ['tue', '筋トレメニュー', 'visual', 'menu', '筋トレメニュー'],
		'2026-11-18': ['wed', 'マシンの使い方', 'visual', 'beginner', 'マシンの使い方'],
		'2026-11-19': ['thu', '食事', 'dialogue', 'ai', '食事知識'],
		'2026-11-20': ['fri', 'ジム選び', 'article', 'gym', 'ジム選び'],
		'2026-11-21': ['sat', '宅トレ', 'article', 'default', '宅トレ'],
		'2026-11-22': ['sun', '独学トレーニング', 'dialogue', 'ai', '独学トレーニング']
	}
	for (const [ymd, [weekday, label, format, cta, category]] of Object.entries(expected)) {
		const date = jstDate(ymd)
		const theme = resolveTheme(calendar, date.weekday)
		assert.equal(date.weekday, weekday)
		assert.deepEqual([theme.label, theme.format, theme.cta, theme.category], [label, format, cta, category])
	}
	assert.deepEqual(resolveTheme(calendar, 'fri').require_components, ['GymCta'])
})

test('テーマは ID でも曜日でも手動指定できる', () => {
	assert.equal(resolveTheme(calendar, 'mon', 'food').id, 'food')
	assert.equal(resolveTheme(calendar, 'mon', 'fri').id, 'gym')
	assert.throws(() => resolveTheme(calendar, 'mon', 'unknown'), /テーマ/)
})

test('カレンダーの定義はサイトのスキーマと合っている', () => {
	const all = []
	for (const [id, theme] of Object.entries(calendar.themes)) {
		assert.ok(enums.categories.includes(theme.category), `${id}: category`)
		assert.ok(enums.formats.includes(theme.format), `${id}: format`)
		assert.ok(enums.ctas.includes(theme.cta), `${id}: cta`)
		assert.ok(theme.topics.length >= 10, `${id}: ネタは 10 本以上`)
		all.push(...theme.topics)
	}
	assert.equal(new Set(all).size, all.length, 'ネタの重複')
	assert.deepEqual(Object.keys(calendar.exercises), ['Chest', 'Shoulder', 'Back', 'Forearm', 'Triceps', 'Biceps', 'Legs', 'Abs', 'Cardio'])
	assert.match(formatExercises(calendar), /- Back: ラットプルダウン、/)
})

test('ネタは未使用のものを上から選び、使用済みは飛ばす', () => {
	const theme = { topics: ['ジム 週2回 効果', 'ジム 続かない', 'ジム 朝と夜'] }
	assert.equal(pickTopic(theme, []), 'ジム 週2回 効果')
	assert.equal(pickTopic(theme, [{ topic: 'ジム 週2回 効果' }]), 'ジム 続かない')
	// 空白や全角・半角の違いは同じネタとして扱う
	assert.equal(pickTopic(theme, [{ topic: 'ジム　週２回 効果' }, { topic: 'ジム続かない' }]), 'ジム 朝と夜')
})

test('ネタが尽きたら null (モデルに切り口を考えさせる)', () => {
	const theme = { topics: ['a', 'b'] }
	assert.equal(pickTopic(theme, [{ topic: 'a' }, { topic: 'b' }]), null)
	assert.equal(pickTopic({}, []), null)
})
