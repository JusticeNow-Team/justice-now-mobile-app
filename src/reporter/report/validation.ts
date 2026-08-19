import { CaseDraft } from "./types";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function todayIsoDate() {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export function isFutureDate(value: string) {
  if (!datePattern.test(value)) {
    return false;
  }

  return value > todayIsoDate();
}

export function validateReportStep(step: number, draft: CaseDraft): string | null {
  if (step === 1 && !draft.reportingMode) {
    return "Choose how you would like to report this case.";
  }

  if (step === 2 && draft.categories.length === 0) {
    return "Select at least one incident category.";
  }

  if (step === 3) {
    if (!draft.title.trim()) {
      return "Enter a short case title.";
    }

    if (!draft.description.trim()) {
      return "Tell us what happened.";
    }

    if (!draft.incidentDate.trim()) {
      return "Enter the date of the incident.";
    }

    if (!datePattern.test(draft.incidentDate.trim())) {
      return "Use the date format YYYY-MM-DD.";
    }

    if (isFutureDate(draft.incidentDate.trim())) {
      return "The incident date cannot be in the future.";
    }

    if (!draft.ongoing) {
      return "Tell us whether the incident is still ongoing.";
    }
  }

  if (step === 4) {
    if (!draft.province) {
      return "Select a province.";
    }

    if (!draft.district) {
      return "Select a district.";
    }
  }

  if (step === 5 && !draft.victimRelation) {
    return "Tell us whether you are reporting for yourself or another person.";
  }

  return null;
}
