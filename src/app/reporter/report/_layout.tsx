import { Stack } from "expo-router";

import { ReportFlow } from "../../../reporter/report/ReportFlow";

export default function ReportLayout() {
  return (
    <ReportFlow>
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      />
    </ReportFlow>
  );
}
