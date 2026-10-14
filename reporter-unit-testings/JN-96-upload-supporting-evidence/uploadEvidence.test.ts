import { EVIDENCE_BUCKET } from "../../src/reporter/evidence/constants";
import {
  uploadEvidenceToCase,
  uploadPendingEvidence,
} from "../../src/reporter/evidence/uploadEvidence";
import { makeEvidenceFile } from "../helpers/fixtures";
import {
  callsOf,
  mockProfileRole,
  mockSignedInUser,
  queriesFor,
  queueTable,
  storageBucket,
  supabase,
} from "../mocks/supabaseClient";

const originalFetch = global.fetch;

function fileBodyOfSize(size: number) {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, blob: async () => ({ size }) }) as never;
}

function signInReporterOwningCase() {
  mockSignedInUser({ id: "reporter-1" });
  mockProfileRole("reporter");
  queueTable("cases", { data: { id: "case-1" } });
}

beforeEach(() => {
  fileBodyOfSize(2048);
});

afterEach(() => {
  global.fetch = originalFetch;
});

describe("JN-96 Evidence upload - uploadEvidenceToCase() access checks", () => {
  it("rejects an invalid file before contacting the backend", async () => {
    const result = await uploadEvidenceToCase(
      "case-1",
      makeEvidenceFile({ fileName: "virus.exe", mimeType: "application/x-msdownload" }),
    );

    expect(result).toEqual({
      ok: false,
      reason: "invalid",
      message: "That file type is not allowed. Use JPG, PNG, MP4, M4A or PDF.",
    });
    expect(supabase.auth.getUser).not.toHaveBeenCalled();
  });

  it("asks an unauthenticated visitor to sign in", async () => {
    await expect(uploadEvidenceToCase("case-1", makeEvidenceFile())).resolves.toEqual({
      ok: false,
      reason: "unauthenticated",
      message: "Please sign in to upload evidence.",
    });
  });

  it("blocks non-reporter accounts", async () => {
    mockSignedInUser({ id: "officer-1" });
    mockProfileRole("case_officer");

    await expect(uploadEvidenceToCase("case-1", makeEvidenceFile())).resolves.toEqual({
      ok: false,
      reason: "unauthenticated",
      message: "Only a signed-in reporter can upload evidence.",
    });
  });

  it("blocks uploads to a case owned by someone else", async () => {
    mockSignedInUser({ id: "reporter-1" });
    mockProfileRole("reporter");
    queueTable("cases", { data: null });

    await expect(uploadEvidenceToCase("case-9", makeEvidenceFile())).resolves.toEqual({
      ok: false,
      reason: "forbidden",
      message: "This case does not belong to your account.",
    });
    expect(callsOf(queriesFor("cases")[0], "eq")).toEqual([
      ["id", "case-9"],
      ["reporter_id", "reporter-1"],
    ]);
    expect(storageBucket.upload).not.toHaveBeenCalled();
  });
});

describe("JN-96 Evidence upload - uploadEvidenceToCase() storage and linking", () => {
  it("stores the file and links it to the case as pending evidence", async () => {
    signInReporterOwningCase();
    queueTable("case_evidence", { data: { id: "ev-1" } });
    const onProgress = jest.fn();

    const result = await uploadEvidenceToCase(
      "case-1",
      makeEvidenceFile({ description: "  Bruise on arm  " }),
      onProgress,
    );

    expect(result).toEqual({ ok: true, evidenceId: "ev-1" });
    expect(supabase.storage.from).toHaveBeenCalledWith(EVIDENCE_BUCKET);

    const [storagePath, body, options] = storageBucket.upload.mock.calls[0];
    expect(storagePath).toMatch(/^reporter-1\/case-1\/\d+-photo\.jpg$/);
    expect(body).toEqual({ size: 2048 });
    expect(options).toEqual({ contentType: "image/jpeg", upsert: false });

    expect(callsOf(queriesFor("case_evidence")[0], "insert")).toEqual([
      [
        {
          case_id: "case-1",
          evidence_type: "image",
          title: "Bruise on arm",
          description: "Bruise on arm",
          file_name: "photo.jpg",
          storage_bucket: EVIDENCE_BUCKET,
          storage_path: storagePath,
          mime_type: "image/jpeg",
          file_size_bytes: 2048,
          validation_status: "pending",
        },
      ],
    ]);
    expect(onProgress.mock.calls.map(([value]) => value)).toEqual([15, 35, 80, 100]);
  });

  it("uses the file name as the title when there is no description", async () => {
    signInReporterOwningCase();
    queueTable("case_evidence", { data: { id: "ev-1" } });

    await uploadEvidenceToCase("case-1", makeEvidenceFile({ description: "   " }));

    expect(callsOf(queriesFor("case_evidence")[0], "insert")[0][0]).toMatchObject({
      title: "photo.jpg",
      description: null,
    });
  });

  it("sanitises unsafe file names in the storage path", async () => {
    signInReporterOwningCase();
    queueTable("case_evidence", { data: { id: "ev-1" } });

    await uploadEvidenceToCase(
      "case-1",
      makeEvidenceFile({ fileName: "../../my photo (1).jpg" }),
    );

    const [storagePath] = storageBucket.upload.mock.calls[0];
    expect(storagePath).toMatch(/^reporter-1\/case-1\/\d+-\.\._\.\._my_photo__1_\.jpg$/);
  });

  it("re-validates when the real file is bigger than reported", async () => {
    signInReporterOwningCase();
    fileBodyOfSize(101 * 1024 * 1024);

    await expect(uploadEvidenceToCase("case-1", makeEvidenceFile())).resolves.toEqual({
      ok: false,
      reason: "invalid",
      message: "This file is larger than 100 MB. Choose a smaller file.",
    });
    expect(storageBucket.upload).not.toHaveBeenCalled();
  });

  it("reports a file that cannot be read from the device", async () => {
    signInReporterOwningCase();
    global.fetch = jest.fn().mockResolvedValue({ ok: false }) as never;

    await expect(uploadEvidenceToCase("case-1", makeEvidenceFile())).resolves.toEqual({
      ok: false,
      reason: "generic",
      message: "JusticeNow could not read this file. Please try another file.",
    });
  });

  it.each([
    ["Bucket not found", "Evidence storage is not available yet. Please try again later."],
    ["Payload too large", "This file is larger than 100 MB. Choose a smaller file."],
    ["mime type image/gif is not supported", "That file type is not allowed. Use JPG, PNG, MP4, M4A or PDF."],
    ["Quota exceeded", "Quota exceeded"],
  ])("maps the storage error %p", async (storageMessage, expected) => {
    signInReporterOwningCase();
    storageBucket.upload.mockResolvedValue({ data: null, error: { message: storageMessage } });

    await expect(uploadEvidenceToCase("case-1", makeEvidenceFile())).resolves.toEqual({
      ok: false,
      reason: "generic",
      message: expected,
    });
    expect(queriesFor("case_evidence")).toHaveLength(0);
  });

  it("removes the stored file if it cannot be linked to the case", async () => {
    signInReporterOwningCase();
    queueTable("case_evidence", { error: { message: "insert denied" } });

    const result = await uploadEvidenceToCase("case-1", makeEvidenceFile());

    expect(result).toEqual({ ok: false, reason: "generic", message: "insert denied" });
    const [storagePath] = storageBucket.upload.mock.calls[0];
    expect(storageBucket.remove).toHaveBeenCalledWith([storagePath]);
  });
});

describe("JN-96 Evidence upload - uploadPendingEvidence()", () => {
  it("uploads every file and reports progress per file", async () => {
    mockSignedInUser({ id: "reporter-1" });
    queueTable("profiles", { data: { role: "reporter" } }, { data: { role: "reporter" } });
    queueTable("cases", { data: { id: "case-1" } }, { data: { id: "case-1" } });
    queueTable("case_evidence", { data: { id: "ev-1" } }, { data: { id: "ev-2" } });
    const onFileProgress = jest.fn();

    const summary = await uploadPendingEvidence(
      "case-1",
      [makeEvidenceFile({ localId: "a" }), makeEvidenceFile({ localId: "b" })],
      onFileProgress,
    );

    expect(summary).toEqual({ uploaded: 2, failed: 0, lastError: "" });
    expect(onFileProgress).toHaveBeenCalledWith("a", 100);
    expect(onFileProgress).toHaveBeenCalledWith("b", 100);
  });

  it("counts failures and keeps the last error", async () => {
    mockSignedInUser({ id: "reporter-1" });
    queueTable("profiles", { data: { role: "reporter" } });
    queueTable("cases", { data: { id: "case-1" } });
    queueTable("case_evidence", { data: { id: "ev-1" } });

    const summary = await uploadPendingEvidence("case-1", [
      makeEvidenceFile({ localId: "good" }),
      makeEvidenceFile({ localId: "bad", fileName: "virus.exe" }),
    ]);

    expect(summary).toEqual({
      uploaded: 1,
      failed: 1,
      lastError: "That file type is not allowed. Use JPG, PNG, MP4, M4A or PDF.",
    });
  });

  it("does nothing for an empty list", async () => {
    await expect(uploadPendingEvidence("case-1", [])).resolves.toEqual({
      uploaded: 0,
      failed: 0,
      lastError: "",
    });
  });
});
