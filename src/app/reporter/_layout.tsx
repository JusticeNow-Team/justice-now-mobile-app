import { Stack } from "expo-router";
import { View } from "react-native";

import RoleBottomNavigation from "../../navigation/RoleBottomNavigation";

export default function ReporterLayout() {
  return (
    <View style={{ flex: 1 }}>
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      />

      <RoleBottomNavigation role="reporter" />
    </View>
  );
}