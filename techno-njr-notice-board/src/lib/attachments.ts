export const ATTACHMENT_BUCKET = "notice-attachments";
/** Uploaded files are stored as `storage:<path>`; anything else is an external link. */
export const STORAGE_PREFIX = "storage:";

export function attachmentLabel(raw: string): string {
  if (raw.startsWith(STORAGE_PREFIX)) {
    const file = raw.slice(STORAGE_PREFIX.length).split("/").pop() ?? "Attachment";
    // Strip the "<timestamp>-" prefix added on upload.
    return decodeURIComponent(file.replace(/^\d+-/, ""));
  }
  try {
    const url = new URL(raw);
    return url.hostname.replace(/^www\./, "");
  } catch {
    return "Attachment";
  }
}

export function safeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(-120);
}
