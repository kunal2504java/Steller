import SmoothScroll from "@/components/SmoothScroll";
import CandelaScrollFX from "../../../candela/src/components/ScrollFX";
import CandelaNav from "../../../candela/src/components/NavPill";
import CandelaHero from "../../../candela/src/components/Hero";
import CandelaTerminal from "../../../candela/src/components/Terminal";
import CandelaHowItWorks from "../../../candela/src/components/HowItWorks";
import CandelaUseCase from "../../../candela/src/components/UseCase";
import CandelaWhyItMatters from "../../../candela/src/components/WhyItMatters";
import CandelaFinale from "../../../candela/src/components/Finale";
import { getChainStats } from "@/lib/chain";

export const revalidate = 120;

export default async function Home() {
  const stats = await getChainStats();
  return (
    <SmoothScroll>
      <CandelaScrollFX />
      <CandelaNav />
      <main>
        <CandelaHero />
        <CandelaTerminal />
        <CandelaHowItWorks />
        <CandelaUseCase stats={stats} />
        <CandelaWhyItMatters />
        <CandelaFinale />
      </main>
    </SmoothScroll>
  );
}
