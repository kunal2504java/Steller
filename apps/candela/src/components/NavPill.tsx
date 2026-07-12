import CopyButton from "./CopyButton";

export default function NavPill() {
  return (
    <div className="fixed inset-x-0 top-4 z-50 flex justify-center px-4">
      <nav className="flex w-full max-w-3xl items-center justify-between rounded-full border border-vellum/10 bg-vault/60 py-2 pl-3 pr-2 backdrop-blur-xl">
        <a href="#" className="flex items-center gap-2.5">
          {/* wax-dot mark */}
          <span className="relative grid size-7 place-items-center rounded-full bg-gradient-to-br from-sealwax-hot via-sealwax to-[#4d0e1e]">
            <svg viewBox="0 0 20 20" className="size-3.5">
              <path
                d="M 10 2 L 12 8 L 18 10 L 12 12 L 10 18 L 8 12 L 2 10 L 8 8 Z"
                fill="#f2c56b"
              />
            </svg>
          </span>
          <span className="text-sm font-semibold tracking-tight text-vellum">
            Candela
          </span>
        </a>
        <div className="hidden items-center gap-7 text-[13px] font-medium text-ash md:flex">
          <a href="#how" className="transition-colors hover:text-vellum">How it works</a>
          <a href="#usecase" className="transition-colors hover:text-vellum">Use case</a>
          <a
            href="https://github.com/kunal2504java/Steller"
            className="transition-colors hover:text-vellum"
          >
            GitHub
          </a>
        </div>
        <CopyButton
          text="npm i candela-kit"
          className="pill-metal !px-5 !py-2.5 !text-[13px]"
        />
      </nav>
    </div>
  );
}
