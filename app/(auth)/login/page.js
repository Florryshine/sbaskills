import StudentLoginForm from '@/components/StudentLoginForm';

export const metadata = {
  title: 'Login | Shiney Brain Academy',
  robots: { index: false, follow: true },
};

export default function LoginPage({ searchParams }) {
  return <StudentLoginForm nextUrl={searchParams?.next || '/dashboard'} />;
}
