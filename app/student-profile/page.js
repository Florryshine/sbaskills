import { redirect } from 'next/navigation';

export default function StudentProfilePage() {
  redirect('/onboarding?edit=1');
}
