import './globals.css';
import Script from 'next/script';
import { UnlockSystemProvider } from '@/context/UnlockSystemContext';
import NotificationContainer from '@/components/NotificationContainer';

const SBA_LOGO = 'https://user24606.cn.imgto.link/public/20260926/1003107782.avif';

export const metadata = {
  metadataBase: new URL('https://shineybrainacademy.vercel.app'),
  title: 'Shiney Brain Academy',
  description: 'Where Champions Are Made – JAMB, Tech Skills, and Career Development for Nigerian students.',
  icons: {
    icon: SBA_LOGO,
    apple: SBA_LOGO,
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#1a73e8" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href={SBA_LOGO} type="image/avif" />
        <link rel="apple-touch-icon" href={SBA_LOGO} />
      </head>
      <body>
        <UnlockSystemProvider>
          {children}
          <NotificationContainer />
        </UnlockSystemProvider>
        {/* Load Paystack before the page becomes interactive */}
        <Script
          src="https://js.paystack.co/v1/inline.js"
          strategy="beforeInteractive"
        />
        {/* Meta Pixel Code */}
        <Script id="meta-pixel" strategy="afterInteractive">
          {`
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '2879100209116929');
            fbq('track', 'PageView');
          `}
        </Script>
        <noscript>
          <img
            height="1"
            width="1"
            style={{ display: 'none' }}
            src="https://www.facebook.com/tr?id=2879100209116929&ev=PageView&noscript=1"
            alt=""
          />
        </noscript>
        {/* End Meta Pixel Code */}
      </body>
    </html>
  );
}
