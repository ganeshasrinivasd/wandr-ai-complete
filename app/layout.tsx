import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Wandr | Where Will You Wander Next?',
  description: 'AI-powered travel planning that satisfies every constraint. Wheelchair accessible, vegan, budget-friendly - no problem.',
  keywords: ['travel', 'AI', 'itinerary', 'accessible travel', 'travel planner'],
  openGraph: {
    title: 'Wandr | Where Will You Wander Next?',
    description: 'AI-powered travel planning that satisfies every constraint.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
