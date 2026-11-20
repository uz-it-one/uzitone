import typography from '@tailwindcss/typography';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        light: {
          base: '#FAF9F6',
          surface: '#FFFFFF',
          border: '#E5E7EB',
          primary: '#111827',
          secondary: '#4B5563',
          accent: '#2563EB',
        },
        dark: {
          base: '#0D1117',
          surface: '#161B22',
          border: '#21262D',
          primary: '#F0F6FC',
          secondary: '#8B949E',
          accent: '#58A6FF',
        },
      },
      fontFamily: {
        sans: [
          '"Pretendard Variable"',
          'Pretendard',
          '-apple-system',
          'BlinkMacSystemFont',
          'system-ui',
          'Roboto',
          'sans-serif',
        ],
        mono: [
          '"JetBrains Mono"',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Monaco',
          'Consolas',
          'monospace',
        ],
      },
    },
  },
  plugins: [typography],
};
