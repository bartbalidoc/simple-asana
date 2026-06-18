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
