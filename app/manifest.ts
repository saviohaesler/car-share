import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'CarShare App',
    short_name: 'CarShare',
    description: 'Logbook and calendar for shared cars',
    start_url: '/',
    display: 'standalone',
    background_color: '#f9fafb', // Matches gray-50 from your style
    theme_color: '#3b82f6',      // Your blue tone
    icons: [
      {
        src: '/icon.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}