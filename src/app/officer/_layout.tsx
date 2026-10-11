import { Stack } from "expo-router";
import { View } from "react-native";

import RoleBottomNavigation from "../../navigation/RoleBottomNavigation";
import StaffNotificationAlert from "../../notifications/StaffNotificationAlert";

export default function OfficerLayout() {
  return (
    <View style={{ flex: 1 }}>
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      />

      <StaffNotificationAlert />

      <RoleBottomNavigation role="case_officer" />
    </View>
  );
}
