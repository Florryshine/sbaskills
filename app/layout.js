import './globals.css';

export const metadata = {
  title: 'Shiney Brain Academy',
  description: 'Where Champions Are Made'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
