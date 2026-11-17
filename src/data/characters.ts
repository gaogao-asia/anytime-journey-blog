// 対話形式記事の登場人物。<Talk who="..."> で指定する
export const TALK_CHARACTERS = {
	kenta: {
		name: '健太',
		initial: '健',
		side: 'left',
		avatarClass: 'bg-sky-600',
		bubbleClass: 'bg-gray-100 dark:bg-gray-800'
	},
	misaki: {
		name: '美咲',
		initial: '美',
		side: 'right',
		avatarClass: 'bg-accent',
		bubbleClass: 'bg-accent/10 dark:bg-accent/20'
	}
} as const

export type TalkWho = keyof typeof TALK_CHARACTERS
