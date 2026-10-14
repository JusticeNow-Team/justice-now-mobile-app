import { fireEvent, render, screen } from "@testing-library/react-native";

import { formatCaseDate } from "../../src/reporter/cases/filterReporterCases";
import ReporterCaseCard, {
  PressableReporterCaseCard,
} from "../../src/reporter/cases/ReporterCaseCard";
import ReporterStatusBadge from "../../src/reporter/cases/ReporterStatusBadge";
import { STATUS_FILTERS } from "../../src/reporter/cases/types";
import { makeCase } from "../helpers/fixtures";

describe("JN-78 My cases - <ReporterStatusBadge />", () => {
  it.each(STATUS_FILTERS.filter((filter) => filter.value !== "all"))(
    "shows the label for $value",
    async ({ value, label }) => {
      await render(<ReporterStatusBadge status={value as never} />);

      expect(screen.getByText(label)).toBeTruthy();
    },
  );

  it("falls back to Submitted for an unknown status", async () => {
    await render(<ReporterStatusBadge status={"archived" as never} />);

    expect(screen.getByText("Submitted")).toBeTruthy();
  });
});

describe("JN-78 My cases - <ReporterCaseCard />", () => {
  it("shows the case reference, title, category and status", async () => {
    await render(<ReporterCaseCard record={makeCase({ status: "investigating" })} />);

    expect(screen.getByText("JN-2026-0001")).toBeTruthy();
    expect(screen.getByText("Denied entry to a public office")).toBeTruthy();
    expect(screen.getByText("Discrimination")).toBeTruthy();
    expect(screen.getByText("Investigating")).toBeTruthy();
    expect(screen.getByText(/Last update:/)).toBeTruthy();
  });

  it("shows Uncategorised when the category is empty", async () => {
    await render(<ReporterCaseCard record={makeCase({ category: "" })} />);

    expect(screen.getByText("Uncategorised")).toBeTruthy();
  });

  it("uses the submission date when no incident date was given", async () => {
    const record = makeCase({ incidentDate: null });
    await render(<ReporterCaseCard record={record} />);

    expect(screen.getByText(formatCaseDate(record.createdAt))).toBeTruthy();
  });

  it("opens the case when the pressable card is tapped", async () => {
    const onPress = jest.fn();
    await render(<PressableReporterCaseCard record={makeCase()} onPress={onPress} />);

    await fireEvent.press(screen.getByRole("button"));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("renders a plain card when no press handler is given", async () => {
    await render(<PressableReporterCaseCard record={makeCase()} />);

    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("JN-2026-0001")).toBeTruthy();
  });
});
