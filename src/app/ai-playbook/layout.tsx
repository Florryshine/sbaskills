import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "100/100 AI Playbook for Students | Shiney Brain Academy",
  description:
    "The complete AI system to study smarter, retain what you read, and finish assignments in half the time.",
};

export default function PlaybookLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#070E1F] text-slate-100 selection:bg-[#FFC42B] selection:text-black font-sans antialiased">
      {children}
    </div>
  );
}
