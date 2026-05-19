import StudentLoginForm from '@/components/StudentLoginForm';

export default function LoginPage({ searchParams }) {
  return <StudentLoginForm nextUrl={searchParams?.next || '/dashboard'} />;
}
