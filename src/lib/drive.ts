import { google } from "googleapis";
import { Readable } from "stream";

let driveClient: ReturnType<typeof google.drive> | null = null;

function initializeDriveClient() {
  if (driveClient) {
    return driveClient;
  }

  const serviceAccountKeyB64 = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_B64;

  if (!serviceAccountKeyB64) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY_B64 environment variable is not set");
  }

  const serviceAccountKey = JSON.parse(
    Buffer.from(serviceAccountKeyB64, "base64").toString("utf-8")
  );

  const auth = new google.auth.GoogleAuth({
    credentials: serviceAccountKey,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });

  driveClient = google.drive({ version: "v3", auth });
  return driveClient;
}

export async function uploadFileToDrive(
  fileName: string,
  fileBuffer: Buffer,
  mimeType: string,
  folderId?: string
): Promise<{ fileId: string; webViewLink: string }> {
  const drive = initializeDriveClient();

  // Files must land in a folder/Shared Drive the service account can write to —
  // a service account has no storage quota of its own.
  const targetFolder = folderId || process.env.GOOGLE_DRIVE_FOLDER_ID;

  if (!targetFolder) {
    throw new Error(
      "GOOGLE_DRIVE_FOLDER_ID environment variable is not set (no destination folder for uploads)"
    );
  }

  const fileMetadata: any = {
    name: fileName,
    parents: [targetFolder],
  };

  const media = {
    mimeType,
    body: Readable.from(fileBuffer),
  };

  const response = await drive.files.create({
    requestBody: fileMetadata,
    media,
    fields: "id, webViewLink",
    supportsAllDrives: true,
  });

  return {
    fileId: response.data.id || "",
    webViewLink: response.data.webViewLink || "",
  };
}

export async function deleteFileFromDrive(fileId: string): Promise<void> {
  const drive = initializeDriveClient();
  await drive.files.delete({ fileId, supportsAllDrives: true });
}

/**
 * Download a file's raw bytes with the service account. Used by the app's own
 * authenticated attachment endpoint — Drive view links don't work for team
 * members because the files are private to the service account.
 */
export async function downloadFileFromDrive(fileId: string): Promise<Buffer> {
  const drive = initializeDriveClient();
  const res = await drive.files.get(
    { fileId, alt: "media", supportsAllDrives: true },
    { responseType: "arraybuffer" }
  );
  return Buffer.from(res.data as ArrayBuffer);
}

// ---------------------------------------------------------------------------
// Task archive (v1.10): a browsable "Task Archive/<Project>/<Task>" tree inside
// the shared uploads root, holding a summary Google Doc + the task's files.
// The root folder is shared with the team's Drive, so everything created here
// is visible to humans without extra sharing.

function escapeQueryValue(v: string): string {
  return v.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

export async function findOrCreateFolder(
  name: string,
  parentId: string
): Promise<string> {
  const drive = initializeDriveClient();
  const safeName = name.trim().slice(0, 120) || "Untitled";

  const existing = await drive.files.list({
    q: `name = '${escapeQueryValue(safeName)}' and '${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: "files(id)",
    pageSize: 1,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  const found = existing.data.files?.[0]?.id;
  if (found) return found;

  const created = await drive.files.create({
    requestBody: {
      name: safeName,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    },
    fields: "id",
    supportsAllDrives: true,
  });
  return created.data.id || "";
}

/**
 * Create a real Google Doc from HTML (Drive converts on upload). Returns the
 * doc's id and human link.
 */
export async function createGoogleDocFromHtml(
  name: string,
  html: string,
  folderId: string
): Promise<{ fileId: string; webViewLink: string }> {
  const drive = initializeDriveClient();
  const response = await drive.files.create({
    requestBody: {
      name: name.trim().slice(0, 200) || "Untitled",
      mimeType: "application/vnd.google-apps.document",
      parents: [folderId],
    },
    media: { mimeType: "text/html", body: Readable.from(Buffer.from(html, "utf8")) },
    fields: "id, webViewLink",
    supportsAllDrives: true,
  });
  return {
    fileId: response.data.id || "",
    webViewLink: response.data.webViewLink || "",
  };
}

/**
 * Move a file into a folder (replacing its previous parents). The app's
 * attachment proxy addresses files by id, so moving never breaks in-app viewing.
 */
export async function moveFileToFolder(fileId: string, folderId: string): Promise<void> {
  const drive = initializeDriveClient();
  const current = await drive.files.get({
    fileId,
    fields: "parents",
    supportsAllDrives: true,
  });
  const oldParents = (current.data.parents || []).join(",");
  await drive.files.update({
    fileId,
    addParents: folderId,
    removeParents: oldParents || undefined,
    fields: "id",
    supportsAllDrives: true,
  });
}

export async function getFolderLink(folderId: string): Promise<string> {
  const drive = initializeDriveClient();
  const res = await drive.files.get({
    fileId: folderId,
    fields: "webViewLink",
    supportsAllDrives: true,
  });
  return res.data.webViewLink || `https://drive.google.com/drive/folders/${folderId}`;
}
