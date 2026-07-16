import SmoothScroll from "@/components/SmoothScroll";
import ScrollFX from "@/components/clone/ScrollFX";
import NavPill from "@/components/clone/NavPill";
import HeroC from "@/components/clone/HeroC";
import FeatureBento from "@/components/clone/FeatureBento";
import VerifyStack from "@/components/clone/VerifyStack";
import CtaFinale from "@/components/clone/CtaFinale";
import FooterC from "@/components/clone/FooterC";
import { getChainStats } from "@/lib/chain";
import { verificationQrDataUrl } from "@/lib/share";
import { verificationUrl } from "@/lib/site";
import demo from "../../../../fixtures/probatum-testnet-demo.json";
import deployment from "../../../../deployments/testnet.json";

export const revalidate = 120;

export default async function Home() {
  const stats = await getChainStats();
  const demoHref = `/verify/${demo.certificates[0].routeId}`;
  const demoUrl = verificationUrl(demo.certificates[0].routeId);
  const demoQrDataUrl = await verificationQrDataUrl(demoUrl);

  return (
    <SmoothScroll>
      <ScrollFX />
      <NavPill demoHref={demoHref} />
      <main>
        <HeroC stats={stats} demoHref={demoHref} demoQrDataUrl={demoQrDataUrl} demoTx={deployment.demoTx} />
        <FeatureBento />
        <VerifyStack demoHref={demoHref} />
        <CtaFinale demoHref={demoHref} />
      </main>
      <FooterC stats={stats} />
    </SmoothScroll>
  );
}
