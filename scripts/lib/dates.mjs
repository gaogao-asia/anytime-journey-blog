// 曜日と日付はすべて JST (UTC+9、夏時間なし) で判定する
const JST_OFFSET_MS = 9 * 60 * 60 * 1000
const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

/** Date または 'YYYY-MM-DD' (JST の日付) から JST の日付情報を返す */
export function jstDate(input = new Date()) {
	let shifted
	if (typeof input === 'string') {
		if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) throw new Error(`日付は YYYY-MM-DD で指定してください: ${input}`)
		shifted = new Date(`${input}T00:00:00Z`)
		if (Number.isNaN(shifted.getTime()) || shifted.toISOString().slice(0, 10) !== input) {
			throw new Error(`存在しない日付です: ${input}`)
		}
	} else {
		shifted = new Date(input.getTime() + JST_OFFSET_MS)
	}
	const ymd = shifted.toISOString().slice(0, 10)
	return { ymd, compact: ymd.replaceAll('-', ''), weekday: WEEKDAYS[shifted.getUTCDay()] }
}
