import SmoothScroll from "@/components/SmoothScroll";
import Hero from "@/components/Hero";
import { getChainStats } from "@/lib/chain";

export const revalidate = 120;

export default async function Home() {
  const stats = await getChainStats();

  return (
    <SmoothScroll>
      <main>
        <Hero stats={stats} />
      </main>
    </SmoothScroll>
  );
}
