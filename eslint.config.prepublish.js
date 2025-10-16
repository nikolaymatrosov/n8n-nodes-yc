const { defineConfig } = require('eslint/config');

const base = require('./eslint.config');

const n8nNodesBase = require('eslint-plugin-n8n-nodes-base');
const js = require('@eslint/js');

const { FlatCompat } = require('@eslint/eslintrc');

const compat = new FlatCompat({
	baseDirectory: __dirname,
	recommendedConfig: js.configs.recommended,
	allConfig: js.configs.all,
});

module.exports = defineConfig([
	base,
	{
		files: ['**/package.json'],

		plugins: {
			'n8n-nodes-base': n8nNodesBase,
		},

		rules: {
			'n8n-nodes-base/community-package-json-name-still-default': 'error',
		},
	},
]);
