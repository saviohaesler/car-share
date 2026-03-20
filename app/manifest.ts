import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'CarShare App',
    short_name: 'CarShare',
    description: 'Fahrtenbuch und Kalender für geteilte Autos',
    start_url: '/',
    display: 'standalone',
    background_color: '#f9fafb', // Entspricht gray-50 aus deinem Style
    theme_color: '#3b82f6',      // Dein Blau-Ton
    icons: [
      {
        src: '/icon.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}