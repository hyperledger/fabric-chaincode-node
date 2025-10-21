const js = require('@eslint/js');
const tseslint = require('typescript-eslint');
const globals = require('globals');

module.exports = tseslint.config(
    {
        files: ['**/*.ts'],
        extends: [tseslint.configs.recommended, js.configs.recommended],
        languageOptions: {
            globals: {
                ...globals.node,
            },
        },
        rules: {
            'no-unused-vars': 'off',
            '@typescript-eslint/explicit-function-return-type': [
                'error',
                {
                    allowExpressions: true,
                },
            ],
            '@typescript-eslint/no-explicit-any': 'warn',
            '@typescript-eslint/no-unsafe-function-type': 'warn',
            '@typescript-eslint/no-unused-vars': 'off',
            '@typescript-eslint/no-floating-promises': 'off',
        },
    },
    {
        files: ['**/*.js'],
        ignores: ['bundle.js'],
        extends: [js.configs.recommended],
        languageOptions: {
            globals: {
                ...globals.node,
            },
            sourceType: 'commonjs',
        },
        rules: {
            'no-unused-vars': 'off',
        },
    }
);
