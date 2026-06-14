import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        serif: ['var(--font-cormorant)', 'Georgia', 'serif'],
        sans: ['var(--font-manrope)', 'system-ui', 'sans-serif'],
      },
      colors: {
        cream: '#faf6ee',
        'warm-beige': '#f2e7d7',
        'dark-green': '#39402c',
        forest: '#20241a',
        ink: '#1a1d17',
        muted: '#6b6f63',
        soft: '#3a3f33',
        sage: '#5e6a48',
        gold: '#c9a76a',
        'trust-green': '#a9c08f',
        rust: '#b06a4a',
        border: '#e7e2d4',
        'border-warm': '#ddd2bb',
      },
      maxWidth: {
        container: '1240px',
      },
      borderRadius: {
        pill: '999px',
        card: '22px',
        'card-lg': '28px',
      },
      boxShadow: {
        card: '0 2px 6px rgba(42,36,24,.05)',
        'card-hover': '0 18px 40px -16px rgba(42,36,24,.16)',
        product: '0 18px 44px -20px rgba(42,36,24,.24)',
        video: '0 24px 56px -20px rgba(42,36,24,.3)',
        header: '0 1px 0 rgba(42,36,24,.07)',
        sticky: '0 -8px 24px -12px rgba(42,36,24,.18)',
      },
    },
  },
  plugins: [],
}

export default config
