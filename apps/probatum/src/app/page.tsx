import SmoothScroll from "@/components/SmoothScroll";
import Hero from "@/components/Hero";
import Problem from "@/components/Problem";
import CertificateAct from "@/components/CertificateAct";
import HowItWorks from "@/components/HowItWorks";
import Vault from "@/components/Vault";
import { getChainStats } from "@/lib/chain";

export const revalidate = 120;

export default async function Home() {
  const stats = await getChainStats();

  return (
    <SmoothScroll>
      <main>
        <Hero stats={stats} />
        <Problem />
        <CertificateAct />
        <HowItWorks />
        <Vault contractUrl={stats.contractUrl} network={stats.network} />
      </main>
    </SmoothScroll>
  );
}
