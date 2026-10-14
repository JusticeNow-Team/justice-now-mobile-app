import { fireEvent, render, screen } from "@testing-library/react-native";

import LoginScreen from "../../src/reporter/login/LoginScreen";
import { loginReporter } from "../../src/reporter/login/loginReporter";

const mockRouter = { replace: jest.fn(), push: jest.fn(), back: jest.fn() };

jest.mock("expo-router", () => ({
  useRouter: () => mockRouter,
}));

jest.mock("../../src/reporter/login/loginReporter", () => ({
  loginReporter: jest.fn(),
}));

const mockedLogin = loginReporter as jest.MockedFunction<typeof loginReporter>;

async function fillAndSubmit(email: string, password: string) {
  await fireEvent.changeText(screen.getByLabelText("Email or username"), email);
  await fireEvent.changeText(screen.getByLabelText("Password"), password);
  await fireEvent.press(screen.getByRole("button", { name: "Sign in" }));
}

describe("JN-39 Reporter login - <LoginScreen />", () => {
  it("shows validation errors and does not call the backend for an empty form", async () => {
    await render(<LoginScreen />);

    await fireEvent.press(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Enter your email address.")).toBeTruthy();
    expect(screen.getByText("Enter your password.")).toBeTruthy();
    expect(mockedLogin).not.toHaveBeenCalled();
  });

  it("opens the reporter dashboard after a successful sign in", async () => {
    mockedLogin.mockResolvedValue({ ok: true });
    await render(<LoginScreen />);

    await fillAndSubmit("reporter@example.com", "Secret123");

    expect(mockedLogin).toHaveBeenCalledWith("reporter@example.com", "Secret123");
    expect(mockRouter.replace).toHaveBeenCalledWith("/reporter");
  });

  it("shows the error message when the credentials are wrong", async () => {
    mockedLogin.mockResolvedValue({
      ok: false,
      reason: "invalid_credentials",
      message: "Invalid email or password. Check your details and try again.",
    });
    await render(<LoginScreen />);

    await fillAndSubmit("reporter@example.com", "wrong");

    expect(await screen.findByText("Unable to sign in")).toBeTruthy();
    expect(
      screen.getByText("Invalid email or password. Check your details and try again."),
    ).toBeTruthy();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it("offers staff access when a staff account tries the reporter login", async () => {
    mockedLogin.mockResolvedValue({
      ok: false,
      reason: "staff",
      message: "Please use Staff access to sign in with your JusticeNow staff account.",
    });
    await render(<LoginScreen />);

    await fillAndSubmit("officer@example.com", "Secret123");

    expect(await screen.findByText("Staff account detected")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Staff access" }));
    expect(mockRouter.push).toHaveBeenCalledWith("/secure-role");
  });

  it("shows a connection message when sign in throws", async () => {
    mockedLogin.mockRejectedValue(new Error("offline"));
    await render(<LoginScreen />);

    await fillAndSubmit("reporter@example.com", "Secret123");

    expect(
      await screen.findByText(
        "Unable to sign in. Please check your internet connection and try again.",
      ),
    ).toBeTruthy();
  });

  it("navigates to registration and forgot password", async () => {
    await render(<LoginScreen />);

    await fireEvent.press(screen.getByRole("button", { name: "Create an account" }));
    await fireEvent.press(screen.getByRole("button", { name: "Forgot password?" }));

    expect(mockRouter.push).toHaveBeenCalledWith("/register");
    expect(mockRouter.push).toHaveBeenCalledWith("/forgot-password");
  });

  it("starts an anonymous report without signing in", async () => {
    await render(<LoginScreen />);

    await fireEvent.press(
      screen.getByRole("button", { name: "Continue as anonymous reporter" }),
    );

    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: "/reporter/report/preference",
      params: { mode: "anonymous" },
    });
  });
});
