import './globals.css';

export const metadata = {
  title: 'Shiney Brain Academy',
  description: 'Where Champions Are Made – JAMB, Tech Skills, and Career Development for Nigerian students.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#1a73e8" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/logo.png" type="image/png" />
        <link rel="apple-touch-icon" href="/logo.png" />
        {/* Paystack Inline Script – required for payment popup */}
        <script src="https://js.paystack.co/v1/inline.js"></script>
      </head>
      <body>{children}</body>
    </html>
  );
}