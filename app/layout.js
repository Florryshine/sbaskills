import './globals.css';

export const metadata = {
  title: 'Shiney Brain Academy',
  description: 'Where Champions Are Made – JAMB, Tech Skills, and Career Development for Nigerian students.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#1a73e8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </head>
      <body>{children}</body>
    </html>
  );
}