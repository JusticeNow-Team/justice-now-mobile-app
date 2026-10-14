import {
  ALLOWED_EXTENSIONS,
  CATEGORY_ACCEPT,
  CATEGORY_TO_TYPE,
  MAX_EVIDENCE_BYTES,
} from "../../src/reporter/evidence/constants";
import {
  fileExtension,
  formatEvidenceBytes,
  validateEvidenceFile,
} from "../../src/reporter/evidence/validation";

const NOT_ALLOWED = "That file type is not allowed. Use JPG, PNG, MP4, M4A or PDF.";

describe("JN-96 Evidence upload - helpers", () => {
  it.each([
    ["photo.JPG", "jpg"],
    ["archive.tar.gz", "gz"],
    ["no-extension", ""],
    [".hidden", "hidden"],
  ])("reads the extension of %p as %p", (name, extension) => {
    expect(fileExtension(name)).toBe(extension);
  });

  it.each([
    [0, "0 B"],
    [1023, "1023 B"],
    [1536, "1.5 KB"],
    [10 * 1024 * 1024, "10.0 MB"],
  ])("formats %p bytes as %p", (bytes, label) => {
    expect(formatEvidenceBytes(bytes)).toBe(label);
  });

  it("limits uploads to 100 MB", () => {
    expect(MAX_EVIDENCE_BYTES).toBe(100 * 1024 * 1024);
  });

  it("maps each picker category to a stored evidence type", () => {
    expect(CATEGORY_TO_TYPE).toEqual({
      photo: "image",
      video: "video",
      audio: "audio",
      document: "document",
    });
  });

  it("only accepts extensions that are on the allowed list", () => {
    const categoryExtensions = Object.values(CATEGORY_ACCEPT).flatMap((c) => c.extensions);

    for (const extension of categoryExtensions) {
      expect(ALLOWED_EXTENSIONS).toContain(extension);
    }
  });
});

describe("JN-96 Evidence upload - validateEvidenceFile()", () => {
  it.each([
    ["photo", "photo.jpg", "image/jpeg"],
    ["photo", "photo.jpeg", "image/jpg"],
    ["photo", "scan.PNG", "image/png"],
    ["video", "clip.mp4", "video/mp4"],
    ["audio", "voice.m4a", "audio/x-m4a"],
    ["audio", "voice.m4a", "audio/mp4"],
    ["document", "report.pdf", "application/pdf"],
  ] as const)("accepts a %s file %p (%s)", (category, fileName, mimeType) => {
    expect(validateEvidenceFile({ category, fileName, mimeType, sizeBytes: 1024 })).toBeNull();
  });

  it.each(["virus.exe", "notes.docx", "image.gif", "noextension"])(
    "rejects the disallowed file %p",
    (fileName) => {
      expect(
        validateEvidenceFile({ category: "document", fileName, mimeType: "", sizeBytes: 1024 }),
      ).toBe(NOT_ALLOWED);
    },
  );

  it("rejects an allowed file chosen under the wrong category", () => {
    expect(
      validateEvidenceFile({
        category: "photo",
        fileName: "report.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1024,
      }),
    ).toBe("Choose a photo file (JPG, JPEG, PNG).");
  });

  it("rejects a file whose MIME type does not match its category", () => {
    expect(
      validateEvidenceFile({
        category: "photo",
        fileName: "photo.jpg",
        mimeType: "application/pdf",
        sizeBytes: 1024,
      }),
    ).toBe("Choose a photo file (JPG, JPEG, PNG).");
  });

  it.each(["", "application/octet-stream", "application/binary", "audio/*", "image/*"])(
    "trusts the extension when the MIME type is generic (%p)",
    (mimeType) => {
      expect(
        validateEvidenceFile({ category: "photo", fileName: "photo.jpg", mimeType, sizeBytes: 1024 }),
      ).toBeNull();
    },
  );

  it("rejects a file whose size could not be read", () => {
    expect(
      validateEvidenceFile({ category: "photo", fileName: "photo.jpg", mimeType: "image/jpeg", sizeBytes: 0 }),
    ).toBe("JusticeNow could not read the size of this file. Please try another file.");
  });

  it("accepts a file of exactly 100 MB and rejects anything larger", () => {
    const base = { category: "video" as const, fileName: "clip.mp4", mimeType: "video/mp4" };

    expect(validateEvidenceFile({ ...base, sizeBytes: MAX_EVIDENCE_BYTES })).toBeNull();
    expect(validateEvidenceFile({ ...base, sizeBytes: MAX_EVIDENCE_BYTES + 1 })).toBe(
      "This file is larger than 100 MB. Choose a smaller file.",
    );
  });
});
