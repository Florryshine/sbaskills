import type { Metadata } from "next";
import AssetLibrary from "@/assets/ui/AssetLibrary";

export const metadata: Metadata = { title: "Shared Visual Asset Library — Shiney Brain Academy" };

export default function AssetsPage() {
  return <AssetLibrary />;
}
