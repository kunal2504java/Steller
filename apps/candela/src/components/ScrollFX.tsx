"use client";

import { useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/**
 * One reveal system for the whole page: anything with [data-reveal]
 * blurs+rises in when it enters the viewport. Siblings stagger.
 */
export default function ScrollFX() {
  useEffect(() => {
    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (prefersReduced) return;

    const els = gsap.utils.toArray<HTMLElement>("[data-reveal]");
    els.forEach((el) => {
      gsap.fromTo(
        el,
        { opacity: 0, y: 26, filter: "blur(10px)" },
        {
          opacity: 1,
          y: 0,
          filter: "blur(0px)",
          duration: 0.9,
          ease: "power3.out",
          delay: Number(el.dataset.revealDelay || 0),
          scrollTrigger: { trigger: el, start: "top 82%" },
        },
      );
    });

    return () => ScrollTrigger.getAll().forEach((t) => t.kill());
  }, []);

  return null;
}
