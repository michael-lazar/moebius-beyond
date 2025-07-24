const js = require('@eslint/js');

module.exports = [
    js.configs.recommended,
    {
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'script',
            globals: {
                // Node.js globals
                console: 'readonly',
                process: 'readonly',
                Buffer: 'readonly',
                __dirname: 'readonly',
                __filename: 'readonly',
                require: 'readonly',
                module: 'readonly',
                exports: 'readonly',
                global: 'readonly',
                
                // Electron globals
                electron: 'readonly',
                
                // Browser globals for renderer process
                window: 'readonly',
                document: 'readonly',
                navigator: 'readonly',
                localStorage: 'readonly',
                sessionStorage: 'readonly',
                
                // jQuery
                $: 'readonly',
                jQuery: 'readonly'
            }
        },
        rules: {
            // Disable some rules that may be too strict for legacy code
            'no-unused-vars': 'warn',
            'no-undef': 'error',
            'no-console': 'off',
            'semi': ['error', 'always'],
            'quotes': ['warn', 'double', { allowTemplateLiterals: true }]
        }
    },
    {
        ignores: [
            'node_modules/**',
            'build/**',
            'dist/**',
            'release/**',
            'app/fonts/**',
            'docs/**'
        ]
    }
];