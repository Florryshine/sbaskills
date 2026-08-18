import type { Metadata } from "next";
import "../globals.css";

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
    <html lang="en" className="dark scroll-smooth">
      <body
        className="bg-[#070E1F] text-slate-100 selection:bg-[#FFC42B] selection:text-black antialiased m-0 p-0"
        style={{ backgroundColor: "#070E1F", color: "#F1F5F9" }}
      >
        <div className="min-h-screen bg-[#070E1F] text-slate-100">
          {children}
        </div>
      </body>
    </html>
  );
}
