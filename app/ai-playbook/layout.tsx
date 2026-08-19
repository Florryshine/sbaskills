import type { Metadata } from "next";
import "../globals.css";

export const metadata: Metadata = {
  title: "100/100 AI Playbook for University Students | Shiney Brain Academy",
  description:
    "Pass Exams, Save Time, Build Valuable Skills & Graduate Ahead of Your Peers Using AI.",
};

export default function PlaybookLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark scroll-smooth">
      <body
        className="bg-[#08236B] text-white selection:bg-[#FFD000] selection:text-black antialiased m-0 p-0"
        style={{ backgroundColor: "#08236B", color: "#FFFFFF" }}
      >
        <div className="min-h-screen bg-gradient-to-b from-[#0B2F8A] via-[#08236B] to-[#05184B] text-white">
          {children}
        </div>
      </body>
    </html>
  );
}
