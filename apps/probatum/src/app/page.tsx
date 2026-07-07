import SmoothScroll from "@/components/SmoothScroll";
import ScrollFX from "@/components/clone/ScrollFX";
import NavPill from "@/components/clone/NavPill";
import HeroC from "@/components/clone/HeroC";
import FeatureBento from "@/components/clone/FeatureBento";
import VerifyStack from "@/components/clone/VerifyStack";
import CtaFinale from "@/components/clone/CtaFinale";
import FooterC from "@/components/clone/FooterC";
import { getChainStats } from "@/lib/chain";

export const revalidate = 120;

export default async function Home() {
  const stats = await getChainStats();

  return (
    <SmoothScroll>
      <ScrollFX />
      <NavPill />
      <main>
        <HeroC stats={stats} />
        <FeatureBento />
        <VerifyStack />
        <CtaFinale />
      </main>
      <FooterC stats={stats} />
    </SmoothScroll>
  );
}
