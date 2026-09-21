import test from "node:test";
import assert from "node:assert/strict";
import { validateAttachmentFile } from "../lib/validations/session";
import { AttachmentType } from "../types/attachment";

test("attachment validation allows valid JPEG under 5 MB with matching magic bytes", () => {
  // JPEG magic bytes: FF D8 FF
  const jpegHeader = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
  const result = validateAttachmentFile("test-work.jpg", "image/jpeg", 25000, jpegHeader);
  assert.equal(result.valid, true);
  assert.equal(result.inferredType, AttachmentType.IMAGE);
});

test("attachment validation allows valid PNG under 5 MB with matching magic bytes", () => {
  // PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
  const pngHeader = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const result = validateAttachmentFile("diagram.png", "image/png", 50000, pngHeader);
  assert.equal(result.valid, true);
  assert.equal(result.inferredType, AttachmentType.IMAGE);
});

test("attachment validation allows valid PDF under 5 MB with matching magic bytes", () => {
  // PDF magic bytes: 25 50 44 46 (%PDF)
  const pdfHeader = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);
  const result = validateAttachmentFile("homework.pdf", "application/pdf", 1000000, pdfHeader);
  assert.equal(result.valid, true);
  assert.equal(result.inferredType, AttachmentType.PDF);
});

test("attachment validation rejects files exceeding 5 MB", () => {
  const pdfHeader = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);
  const sixMB = 6 * 1024 * 1024;
  const result = validateAttachmentFile("huge.pdf", "application/pdf", sixMB, pdfHeader);
  assert.equal(result.valid, false);
  assert.match(result.error ?? "", /5 MB/);
});

test("attachment validation rejects disallowed types (HTML, SVG, EXE, ZIP)", () => {
  const dummy = new Uint8Array([0x3c, 0x21, 0x44, 0x4f, 0x43]); // <!DOC

  const htmlResult = validateAttachmentFile("exploit.html", "text/html", 500, dummy);
  assert.equal(htmlResult.valid, false);

  const svgResult = validateAttachmentFile("vector.svg", "image/svg+xml", 500, dummy);
  assert.equal(svgResult.valid, false);

  const exeResult = validateAttachmentFile("malware.exe", "application/x-msdownload", 500, dummy);
  assert.equal(exeResult.valid, false);

  const zipResult = validateAttachmentFile("archive.zip", "application/zip", 500, dummy);
  assert.equal(zipResult.valid, false);
});

test("attachment validation detects spoofed file extension/MIME with wrong magic bytes", () => {
  // Disguised text file claiming to be a PDF
  const textContent = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]); // "Hello"
  const spoofed = validateAttachmentFile("notes.pdf", "application/pdf", 100, textContent);
  assert.equal(spoofed.valid, false);
  assert.match(spoofed.error ?? "", /File content does not match/);
});
