import { render, screen } from "@testing-library/react-native";

import PasswordRules from "../../src/reporter/password/PasswordRules";
import { getPasswordRules } from "../../src/reporter/password/validation";
import { colors } from "../../src/theme";

describe("JN-59 Change password - <PasswordRules />", () => {
  it("lists every password rule", async () => {
    await render(<PasswordRules rules={getPasswordRules("", "")} />);

    expect(screen.getByText("At least 10 characters")).toBeTruthy();
    expect(screen.getByText("Contains a number")).toBeTruthy();
    expect(screen.getByText("Contains an uppercase letter")).toBeTruthy();
    expect(screen.getByText("Different from your current password")).toBeTruthy();
  });

  it("shows met rules in the success colour and unmet rules in the default colour", async () => {
    await render(
      <PasswordRules rules={getPasswordRules("lowercase2026", "OldSecure2025")} />,
    );

    expect(screen.getByText("At least 10 characters")).toHaveStyle({ color: colors.success });
    expect(screen.getByText("Contains a number")).toHaveStyle({ color: colors.success });
    expect(screen.getByText("Different from your current password")).toHaveStyle({
      color: colors.success,
    });
    expect(screen.getByText("Contains an uppercase letter")).toHaveStyle({
      color: colors.textSecondary,
    });
  });
});
