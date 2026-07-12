import SmoothScroll from "@/components/SmoothScroll";
import ScrollFX from "@/components/ScrollFX";
import NavPill from "@/components/NavPill";
import Hero from "@/components/Hero";
import Terminal from "@/components/Terminal";
import HowItWorks from "@/components/HowItWorks";
import UseCase from "@/components/UseCase";
import WhyItMatters from "@/components/WhyItMatters";
import Finale from "@/components/Finale";
import { getChainStats } from "@/lib/chain";

export const revalidate = 120;

export default async function Home() {
  const stats = await getChainStats();
  return (
    <SmoothScroll>
      <ScrollFX />
      <NavPill />
      <main>
        <Hero />
        <Terminal />
        <HowItWorks />
        <UseCase stats={stats} />
        <WhyItMatters />
        <Finale />
      </main>
    </SmoothScroll>
  );
}
