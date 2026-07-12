import SmoothScroll from "@/components/SmoothScroll";
import ScrollFX from "@/components/ScrollFX";

export default function Home() {
  return (
    <SmoothScroll>
      <ScrollFX />
      <main className="grid min-h-screen place-items-center">
        <p className="eyebrow text-ash">Candela — scaffolding</p>
      </main>
    </SmoothScroll>
  );
}
