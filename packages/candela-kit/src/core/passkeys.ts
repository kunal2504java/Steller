/** WebAuthn platform-credential support — the gate for every kit flow. */
export function canUsePasskeys(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.PublicKeyCredential !== "undefined"
  );
}
