import { View } from "react-native";

/**
 * Stand-in for `lucide-react-native`. Transforming the full icon library makes
 * a cold Jest run take over a minute, and icon artwork is not under test.
 */
function StubIcon() {
  return <View testID="lucide-icon" />;
}

module.exports = new Proxy(
  {},
  {
    get: (_target, name) => (name === "__esModule" ? true : StubIcon),
  },
);
