import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "twopoint5d handbook",
  description: "Documentation for the twopoint5d library",
  base: '/docs/',
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Lookbook', link: '/lookbook' }
    ],

    sidebar: [
      {
        text: 'Manual',
        items: [
          { text: 'Installation', link: '/installation' },
          { text: 'Sprites', link: '/sprites' },
          { text: 'Textures and Atlases', link: '/textures' },
          { text: 'Map2D', link: '/map-2d' },
          { text: 'Vertex Objects', link: '/vertex-objects' }
        ]
      },
      {
        text: 'API',
        items: [
          { text: 'Overview', link: '/overview' },
          { text: 'Display', link: '/display' },
          { text: 'Textures', link: '/cheat-sheet-textures' }
        ]
      },
      {
        text: 'Vitepress Examples',
        items: [
          { text: 'Markdown Examples', link: '/markdown-examples' },
          { text: 'Runtime API Examples', link: '/api-examples' }
        ]
      }
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/spearwolf/twopoint5d' }
    ]
  }
})
