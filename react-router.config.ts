import type { Config } from '@react-router/dev/config';

export default {
	appDirectory: './src/app',
	ssr: false,
	prerender: [],
	dev: {
		proxy: {
			"/api": "http://localhost:3000",
		},
	},
} satisfies Config;
