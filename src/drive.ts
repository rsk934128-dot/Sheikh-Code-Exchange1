export interface DriveFile {
  id: string;
  name: string;
  createdTime: string;
  size?: string;
}

export const listBackups = async (accessToken: string): Promise<DriveFile[]> => {
  const query = encodeURIComponent("name contains 'sheikh_ledger_backup' and trashed = false");
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,createdTime,size)&orderBy=createdTime desc`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to list Google Drive files: ${errText}`);
  }

  const data = await response.json();
  return data.files || [];
};

export const createBackup = async (
  accessToken: string,
  backupName: string,
  content: any
): Promise<DriveFile> => {
  // 1. Create file metadata
  const metadataUrl = 'https://www.googleapis.com/drive/v3/files';
  const metadataResponse = await fetch(metadataUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: backupName,
      mimeType: 'application/json',
    }),
  });

  if (!metadataResponse.ok) {
    const errText = await metadataResponse.text();
    throw new Error(`Failed to create metadata in Google Drive: ${errText}`);
  }

  const metadata = await metadataResponse.json();
  const fileId = metadata.id;

  // 2. Upload actual content
  const uploadUrl = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`;
  const uploadResponse = await fetch(uploadUrl, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(content, null, 2),
  });

  if (!uploadResponse.ok) {
    const errText = await uploadResponse.text();
    throw new Error(`Failed to upload file content to Google Drive: ${errText}`);
  }

  return {
    id: fileId,
    name: backupName,
    createdTime: new Date().toISOString(),
  };
};

export const getBackupContent = async (accessToken: string, fileId: string): Promise<any> => {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to download Google Drive backup: ${errText}`);
  }

  return response.json();
};

export const deleteBackup = async (accessToken: string, fileId: string): Promise<void> => {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}`;
  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to delete backup from Google Drive: ${errText}`);
  }
};

export const uploadInvoice = async (
  accessToken: string,
  fileName: string,
  pdfBlob: Blob
): Promise<DriveFile> => {
  // 1. Create file metadata
  const metadataUrl = 'https://www.googleapis.com/drive/v3/files';
  const metadataResponse = await fetch(metadataUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: fileName,
      mimeType: 'application/pdf',
    }),
  });

  if (!metadataResponse.ok) {
    const errText = await metadataResponse.text();
    throw new Error(`Failed to create metadata in Google Drive: ${errText}`);
  }

  const metadata = await metadataResponse.json();
  const fileId = metadata.id;

  // 2. Upload actual binary content
  const uploadUrl = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`;
  const uploadResponse = await fetch(uploadUrl, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/pdf',
    },
    body: pdfBlob,
  });

  if (!uploadResponse.ok) {
    const errText = await uploadResponse.text();
    throw new Error(`Failed to upload PDF content to Google Drive: ${errText}`);
  }

  return {
    id: fileId,
    name: fileName,
    createdTime: new Date().toISOString(),
  };
};
