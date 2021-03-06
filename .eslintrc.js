module.exports = {
  'env': {
    'es2020': true,
    'node': true,
    'browser': true,
  },
  'extends': 'eslint:recommended',
  'parserOptions': {
    'ecmaVersion': 11,
  },
  'rules': {
    'comma-dangle': ['error', 'always-multiline'],
    'indent': [
      'error',
      2,
    ],
    'linebreak-style': [
      'error',
      'unix',
    ],
    'quotes': [
      'error',
      'single',
    ],
    'semi': [
      'error',
      'never',
    ],
  },
}
