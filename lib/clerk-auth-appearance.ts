/** Auth sign-in / sign-up — light card on white panel (Clerk on `/login` and `/sign-up`). */
export const courtEliteAuthAppearance = {
  variables: {
    colorPrimary: "#99E600",
    colorDanger: "#dc2626",
    colorSuccess: "#16a34a",
    colorWarning: "#ca8a04",
    colorBackground: "#ffffff",
    colorText: "#0f172a",
    colorTextSecondary: "#64748b",
    colorTextOnPrimaryBackground: "#0f172a",
    colorInputText: "#0f172a",
    colorInputBackground: "#f1f5f9",
    colorShimmer: "rgba(15,23,42,0.06)",
    colorNeutral: "rgba(15,23,42,0.12)",
    /** Default control radius (~10px); primary CTA overrides to pill in `elements`. */
    borderRadius: "0.625rem",
    fontFamily: "var(--font-inter-auth), ui-sans-serif, system-ui, sans-serif",
    fontFamilyButtons: "var(--font-inter-auth), ui-sans-serif, system-ui, sans-serif",
  },
  options: {
    socialButtonsVariant: "blockButton",
    socialButtonsPlacement: "top",
  },
  elements: {
    rootBox: "w-full font-[family-name:var(--font-inter-auth)]",
    card:
      "relative overflow-hidden rounded-[1.25rem] border border-slate-200/80 bg-white shadow-xl shadow-slate-200/60 ring-1 ring-slate-900/[0.04] before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:z-10 before:h-[5px] before:rounded-t-[1.25rem] before:bg-[#99E600] before:content-[''] sm:rounded-[1.35rem] before:sm:rounded-t-[1.35rem]",
    header: "gap-2",
    headerTitle:
      "font-[family-name:var(--font-manrope-auth)] text-xl font-bold tracking-tight text-[#0f172a] sm:text-2xl",
    headerSubtitle: "text-sm text-[#64748b]",
    socialButtonsRoot: "flex flex-col gap-3",
    socialButtonsIconButton:
      "!rounded-[10px] border border-slate-200 bg-white text-[#0f172a] shadow-none hover:bg-slate-50",
    socialButtonsBlockButton:
      "!rounded-[10px] border border-slate-200 bg-white !text-[#0f172a] shadow-none hover:bg-slate-50",
    dividerRow: "gap-4",
    dividerLine: "bg-slate-200",
    dividerText: "text-xs font-medium lowercase text-[#94a3b8]",
    formFieldLabel:
      "text-[0.7rem] font-bold uppercase tracking-wider text-[#0f172a]",
    formFieldInput:
      "!rounded-[10px] border-[1.5px] border-[#E2E8F0] bg-[#f1f5f9] text-[#0f172a] placeholder:text-slate-500 hover:border-slate-300 focus:border-[#001b44]/55 focus:ring-2 focus:ring-[#001b44]/20 focus-visible:outline-none",
    formFieldInputShowPasswordButton: "text-[#00235B]",
    formButtonPrimary:
      "!rounded-full bg-[#99E600] font-semibold !text-[#001b44] shadow-none hover:bg-[#ace61a] active:scale-[0.99]",
    formButtonReset:
      "!rounded-[10px] border border-slate-200 bg-white text-[#0f172a] hover:bg-slate-50",
    footer: "text-sm text-[#64748b]",
    footerActionLink: "font-semibold text-[#001b44] hover:text-[#00235B]",
    identityPreviewText: "text-[#0f172a]",
    identityPreviewEditButton: "text-[#001b44]",
    formFieldSuccessText: "text-[#15803d]",
    formFieldErrorText: "text-red-600",
    alertText: "text-[#0f172a]",
    formResendCodeLink: "text-[#001b44]",
    otpCodeFieldInput:
      "!rounded-[10px] border-[1.5px] border-[#E2E8F0] bg-[#f1f5f9] text-[#0f172a] placeholder:text-slate-500 hover:border-slate-300 focus:border-[#001b44]/55 focus:ring-2 focus:ring-[#001b44]/20 focus-visible:outline-none",
    alternativeMethodsBlockButton:
      "!rounded-[10px] border border-slate-200 bg-white text-[#0f172a] hover:bg-slate-50",
    backLink: "text-[#001b44] hover:text-[#00235B]",
    formHeaderTitle: "font-[family-name:var(--font-manrope-auth)] text-lg font-bold text-[#0f172a]",
    formHeaderSubtitle: "text-sm text-[#64748b]",
    logoBox: "hidden",
    logoImage: "hidden",
  },
} as const;
