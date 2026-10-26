import { redirect } from 'next/navigation';

// Preserve the old URL discovered by Google and send visitors to the current tool.
export default function LegacyPastQuestionSearchPage() {
  redirect('/tools/past-questions');
}
