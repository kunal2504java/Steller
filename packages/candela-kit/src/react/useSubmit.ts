"use client";
import { useState } from "react";
import { useCandela } from "./context";
import { signAndSubmit } from "../core/wallet";

export type SubmitState =
  | { phase: "idle" }
  | { phase: "signing" }
  | { phase: "submitting" }
  | { phase: "confirmed"; hash: string }
  | { phase: "failed"; error: string };

export function useSubmit() {
  const { config, wallet } = useCandela();
  const [state, setState] = useState<SubmitState>({ phase: "idle" });

  async function submit(assembled: any) {
    if (!wallet) throw new Error("no wallet connected");
    setState({ phase: "signing" });
    try {
      setState({ phase: "submitting" });
      const res = await signAndSubmit(config, wallet, assembled);
      setState({ phase: "confirmed", hash: res.hash });
      return res;
    } catch (e) {
      setState({ phase: "failed", error: String(e) });
      throw e;
    }
  }

  return { submit, state };
}
