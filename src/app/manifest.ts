import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Smash Champs Dollarama',
    short_name: 'Smash Champs',
    description: 'Doubles round robin, a dollar a game.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#036230',
    icons: [{ src: '/icon.png', sizes: '512x512', type: 'image/png' }],
  };
}
