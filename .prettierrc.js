module.exports = {
  // Basic formatting
  semi: true,
  trailingComma: 'es5',
  singleQuote: true,
  doubleQuote: false,
  quoteProps: 'as-needed',
  
  // Indentation
  tabWidth: 2,
  useTabs: false,
  
  // Line length
  printWidth: 100,
  
  // Whitespace
  bracketSpacing: true,
  bracketSameLine: false,
  
  // Arrow functions
  arrowParens: 'avoid',
  
  // End of line
  endOfLine: 'lf',
  
  // Embedded languages
  embeddedLanguageFormatting: 'auto',
  
  // HTML whitespace sensitivity
  htmlWhitespaceSensitivity: 'css',
  
  // Prose wrap
  proseWrap: 'preserve',
  
  // Vue files
  vueIndentScriptAndStyle: false,
  
  // JSX
  jsxSingleQuote: true,
  jsxBracketSameLine: false,
  
  // Plugin overrides
  overrides: [
    // JSON files
    {
      files: '*.json',
      options: {
        printWidth: 80,
        tabWidth: 2,
      },
    },
    // Markdown files
    {
      files: '*.md',
      options: {
        printWidth: 80,
        proseWrap: 'always',
        tabWidth: 2,
      },
    },
    // YAML files
    {
      files: ['*.yml', '*.yaml'],
      options: {
        printWidth: 80,
        tabWidth: 2,
        singleQuote: false,
      },
    },
    // Solidity files
    {
      files: '*.sol',
      options: {
        printWidth: 120,
        tabWidth: 4,
        useTabs: false,
        singleQuote: false,
      },
    },
    // Package.json files
    {
      files: 'package.json',
      options: {
        printWidth: 80,
        tabWidth: 2,
      },
    },
    // Config files
    {
      files: [
        '*.config.js',
        '*.config.ts',
        '.eslintrc.js',
        'tailwind.config.js',
        'next.config.js',
      ],
      options: {
        printWidth: 100,
        singleQuote: true,
      },
    },
  ],
};