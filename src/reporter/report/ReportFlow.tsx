import { ReactNode, useEffect } from "react";
import { useRouter } from "expo-router";

import { logoutReporter } from "../login";
import { getReporterProfile } from "../profile/getReporterProfile";
import { ReportProvider } from "./ReportContext";

export function ReportFlow({ children }: { children: ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    const guard = async () => {
      const result = await getReporterProfile();

      if (
        !result.ok &&
        (result.reason === "unauthenticated" || result.reason === "forbidden")
      ) {
        await logoutReporter().catch(() => undefined);
        router.replace("/login");
      }
    };

    void guard();
  }, [router]);

  return <ReportProvider>{children}</ReportProvider>;
}
