import {
  createContext,
  ReactNode,
  useContext,
  useMemo,
  useState,
} from "react";

import { CaseDraft, initialCaseDraft, SubmittedCase } from "./types";

interface ReportContextValue {
  draft: CaseDraft;
  submitted: SubmittedCase | null;
  updateDraft: (patch: Partial<CaseDraft>) => void;
  resetDraft: () => void;
  setSubmitted: (value: SubmittedCase | null) => void;
}

const ReportContext = createContext<ReportContextValue | null>(null);

export function ReportProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<CaseDraft>(initialCaseDraft);
  const [submitted, setSubmitted] = useState<SubmittedCase | null>(null);

  const value = useMemo(
    () => ({
      draft,
      submitted,
      updateDraft: (patch: Partial<CaseDraft>) => {
        setDraft((current) => ({ ...current, ...patch }));
      },
      resetDraft: () => {
        setDraft(initialCaseDraft);
        setSubmitted(null);
      },
      setSubmitted,
    }),
    [draft, submitted]
  );

  return (
    <ReportContext.Provider value={value}>{children}</ReportContext.Provider>
  );
}

export function useReport() {
  const context = useContext(ReportContext);

  if (!context) {
    throw new Error("useReport must be used inside ReportProvider.");
  }

  return context;
}
