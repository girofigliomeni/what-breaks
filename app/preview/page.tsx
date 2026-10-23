import type { Metadata } from "next";
import { DependencyMap } from "@/components/dependency-map";
import { preview } from "@/data/preview";

export const metadata: Metadata = {
  title: "Map preview | What Breaks",
};

export default function Preview() {
  return <DependencyMap result={preview} name="Zod" />;
}
