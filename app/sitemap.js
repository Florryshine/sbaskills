export default async function sitemap() {
  const baseUrl = 'https://sbaskills.vercel.app';
  
  const routes = [
    { url: baseUrl, lastModified: new Date(), priority: 1.0 },
    { url: `${baseUrl}/courses`, lastModified: new Date(), priority: 0.8 },
    { url: `${baseUrl}/blog`, lastModified: new Date(), priority: 0.8 },
    { url: `${baseUrl}/audio`, lastModified: new Date(), priority: 0.8 },
    { url: `${baseUrl}/leaderboard`, lastModified: new Date(), priority: 0.8 },
    { url: `${baseUrl}/library`, lastModified: new Date(), priority: 0.8 },
    { url: `${baseUrl}/about`, lastModified: new Date(), priority: 0.6 },
    { url: `${baseUrl}/contact`, lastModified: new Date(), priority: 0.6 },
  ];

  return routes;
}
