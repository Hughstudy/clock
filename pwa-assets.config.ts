import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// `npm run icons` regenerates the PNG install icons in public/ from the SVG.
export default defineConfig({
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, resizeOptions: { background: '#fffaf0' } },
    apple: { ...minimal2023Preset.apple, resizeOptions: { background: '#fffaf0' } },
  },
  images: ['public/favicon.svg'],
})
