import type { Metadata } from "next";
import Workspace from "@/components/workspace/Workspace";
import "./workspace.css";

export const metadata: Metadata = {
  title: "Your room — Overlap",
  description: "A shared signal desk for your team's editing activity.",
};

export default function AppPage() {
  return <Workspace />;
}
