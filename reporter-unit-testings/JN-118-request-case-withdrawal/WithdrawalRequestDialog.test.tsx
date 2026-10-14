import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { ComponentProps } from "react";

import WithdrawalRequestDialog from "../../src/reporter/cases/WithdrawalRequestDialog";

type DialogProps = ComponentProps<typeof WithdrawalRequestDialog>;

async function renderDialog(overrides: Partial<DialogProps> = {}) {
  const props: DialogProps = {
    visible: true,
    caseReference: "JN-2026-0001",
    onConfirm: jest.fn(),
    onClose: jest.fn(),
    ...overrides,
  };

  await render(<WithdrawalRequestDialog {...props} />);
  // The dialog clears its form on a zero-delay timer each time it opens.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  return props;
}

function reasonInput() {
  return screen.getByPlaceholderText("Type your reason…");
}

describe("JN-118 Case withdrawal - <WithdrawalRequestDialog />", () => {
  it("explains the request for the given case", async () => {
    await renderDialog();

    expect(screen.getByText("Request case withdrawal?")).toBeTruthy();
    expect(screen.getByText(/stop work on JN-2026-0001/)).toBeTruthy();
    expect(screen.getByText("0 / 1000 characters")).toBeTruthy();
  });

  it("uses generic wording when no case reference is given", async () => {
    await renderDialog({ caseReference: undefined });

    expect(screen.getByText(/stop work on this case\./)).toBeTruthy();
  });

  it("renders nothing while hidden", async () => {
    await renderDialog({ visible: false });

    expect(screen.queryByText("Request case withdrawal?")).toBeNull();
  });

  it("blocks a reason shorter than 10 characters", async () => {
    const props = await renderDialog();

    await fireEvent.changeText(reasonInput(), "  short  ");
    await fireEvent.press(screen.getByRole("button", { name: "Request withdrawal" }));

    expect(
      screen.getByText("Please explain why you want to withdraw this case (at least 10 characters)."),
    ).toBeTruthy();
    expect(props.onConfirm).not.toHaveBeenCalled();
  });

  it("clears the validation error once the reporter types again", async () => {
    await renderDialog();

    await fireEvent.press(screen.getByRole("button", { name: "Request withdrawal" }));
    await fireEvent.changeText(reasonInput(), "More detail");

    expect(screen.queryByText(/at least 10 characters/)).toBeNull();
  });

  it("confirms with the trimmed reason", async () => {
    const props = await renderDialog();

    await fireEvent.changeText(reasonInput(), "  The matter was settled privately.  ");
    await fireEvent.press(screen.getByRole("button", { name: "Request withdrawal" }));

    expect(props.onConfirm).toHaveBeenCalledWith("The matter was settled privately.");
  });

  it("counts characters and caps the reason at 1000", async () => {
    await renderDialog();

    await fireEvent.changeText(reasonInput(), "a".repeat(1200));

    expect(screen.getByText("1000 / 1000 characters")).toBeTruthy();
    expect(reasonInput().props.value).toHaveLength(1000);
  });

  it("closes from the close icon and the keep-open button", async () => {
    const props = await renderDialog();

    await fireEvent.press(screen.getByRole("button", { name: "Close dialog" }));
    await fireEvent.press(screen.getByRole("button", { name: "Keep case open" }));

    expect(props.onClose).toHaveBeenCalledTimes(2);
  });

  it("shows an error passed in from the server", async () => {
    await renderDialog({ error: "A withdrawal request is already pending for this case." });

    expect(screen.getByText("A withdrawal request is already pending for this case.")).toBeTruthy();
  });

  it("locks the form while the request is being sent", async () => {
    const props = await renderDialog({ loading: true });

    expect(reasonInput().props.editable).toBe(false);
    expect(screen.getByRole("button", { name: "Keep case open" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Close dialog" })).toBeDisabled();

    await fireEvent.press(screen.getByRole("button", { name: "Keep case open" }));
    expect(props.onClose).not.toHaveBeenCalled();
  });
});
