import * as DocumentPicker from "expo-document-picker";

import { pickEvidenceFile } from "../../src/reporter/evidence/pickEvidence";

jest.mock("expo-document-picker", () => ({
  getDocumentAsync: jest.fn(),
}));

const getDocumentAsync = DocumentPicker.getDocumentAsync as jest.Mock;
const originalFetch = global.fetch;

function pickerReturns(asset: Record<string, unknown>) {
  getDocumentAsync.mockResolvedValue({ canceled: false, assets: [asset] });
}

afterEach(() => {
  global.fetch = originalFetch;
});

describe("JN-96 Evidence upload - pickEvidenceFile()", () => {
  it("opens the picker restricted to the category's MIME types", async () => {
    getDocumentAsync.mockResolvedValue({ canceled: true, assets: null });

    await pickEvidenceFile("document");

    expect(getDocumentAsync).toHaveBeenCalledWith({
      type: ["application/pdf"],
      copyToCacheDirectory: true,
      multiple: false,
    });
  });

  it("reports a cancelled pick", async () => {
    getDocumentAsync.mockResolvedValue({ canceled: true, assets: null });

    await expect(pickEvidenceFile("photo")).resolves.toEqual({ ok: false, reason: "cancelled" });
  });

  it("treats an empty asset list as cancelled", async () => {
    getDocumentAsync.mockResolvedValue({ canceled: false, assets: [] });

    await expect(pickEvidenceFile("photo")).resolves.toEqual({ ok: false, reason: "cancelled" });
  });

  it("returns a pending evidence file for a valid pick", async () => {
    pickerReturns({ uri: "file:///cache/injury.jpg", name: "injury.jpg", mimeType: "image/jpeg", size: 4096 });

    const result = await pickEvidenceFile("photo");

    expect(result).toEqual({
      ok: true,
      file: {
        localId: expect.any(String),
        uri: "file:///cache/injury.jpg",
        fileName: "injury.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 4096,
        category: "photo",
        description: "",
      },
    });
  });

  it("gives each picked file a unique local id", async () => {
    pickerReturns({ uri: "file:///a.jpg", name: "a.jpg", mimeType: "image/jpeg", size: 10 });

    const first = await pickEvidenceFile("photo");
    const second = await pickEvidenceFile("photo");

    expect(first.ok && second.ok && first.file.localId !== second.file.localId).toBe(true);
  });

  it("fills in a default name and MIME type when the picker omits them", async () => {
    pickerReturns({ uri: "file:///cache/x", name: "", mimeType: undefined, size: 100 });

    const result = await pickEvidenceFile("document");

    expect(result).toMatchObject({
      ok: true,
      file: { fileName: "evidence.pdf", mimeType: "application/pdf" },
    });
  });

  it("measures the file when the picker reports no size", async () => {
    global.fetch = jest.fn().mockResolvedValue({ blob: async () => ({ size: 777 }) }) as never;
    pickerReturns({ uri: "file:///cache/clip.mp4", name: "clip.mp4", mimeType: "video/mp4", size: 0 });

    const result = await pickEvidenceFile("video");

    expect(global.fetch).toHaveBeenCalledWith("file:///cache/clip.mp4");
    expect(result).toMatchObject({ ok: true, file: { sizeBytes: 777 } });
  });

  it("rejects a file that cannot be read", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("EACCES")) as never;
    pickerReturns({ uri: "file:///cache/clip.mp4", name: "clip.mp4", mimeType: "video/mp4" });

    await expect(pickEvidenceFile("video")).resolves.toEqual({
      ok: false,
      reason: "invalid",
      message: "JusticeNow could not read this file. Please try another file.",
    });
  });

  it("rejects an invalid file with the validation message", async () => {
    pickerReturns({ uri: "file:///cache/a.exe", name: "a.exe", mimeType: "application/x-msdownload", size: 10 });

    await expect(pickEvidenceFile("document")).resolves.toEqual({
      ok: false,
      reason: "invalid",
      message: "That file type is not allowed. Use JPG, PNG, MP4, M4A or PDF.",
    });
  });
});
