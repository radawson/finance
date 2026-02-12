import nextConfig from 'eslint-config-next'

const eslintConfig = [
  // Global ignores
  {
    ignores: [
      '.next/',
      'node_modules/',
      'public/',
      'src/generated/',
      'prisma/migrations/',
    ],
  },
  // eslint-config-next provides React, jsx-a11y, Next.js plugin, and TypeScript support
  ...nextConfig,
  // Project-specific rule overrides
  {
    rules: {
      // Disable overly strict rule that flags common patterns like
      // initializing state from props and fetching data in effects
      'react-hooks/set-state-in-effect': 'off',
    },
  },
]

export default eslintConfig
