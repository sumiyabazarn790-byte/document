const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

const parseJson = async (response, fallback) => {
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error || fallback);
  }
  return payload;
};

export const shareDocument = async ({
  documentId,
  folderId,
  ownerEmail,
  memberEmail,
  title,
  content,
  role = 'edit',
}) => {
  const response = await fetch(`${API_URL}/documents/share`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      documentId,
      folderId,
      ownerEmail,
      memberEmail,
      title,
      content,
      role,
    }),
  });

  const payload = await parseJson(response, 'Share failed');

  return payload;
};

export const fetchSharedDocuments = async (userEmail) => {
  const response = await fetch(
    `${API_URL}/documents?userEmail=${encodeURIComponent(userEmail)}`
  );
  const payload = await parseJson(response, 'Could not load documents');
  return payload.documents || [];
};

export const fetchFolders = async (userEmail) => {
  const response = await fetch(
    `${API_URL}/folders?userEmail=${encodeURIComponent(userEmail)}`
  );
  const payload = await parseJson(response, 'Could not load folders');
  return payload.folders || [];
};

export const createFolder = async ({ userEmail, name }) => {
  const response = await fetch(`${API_URL}/folders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      userEmail,
      name,
    }),
  });

  const payload = await parseJson(response, 'Could not create folder');
  return payload.folder;
};

export const renameFolder = async ({ folderId, userEmail, name }) => {
  const response = await fetch(`${API_URL}/folders/${folderId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      userEmail,
      name,
    }),
  });

  const payload = await parseJson(response, 'Could not rename folder');
  return payload.folder;
};

export const deleteFolder = async ({ folderId, userEmail }) => {
  const response = await fetch(
    `${API_URL}/folders/${folderId}?userEmail=${encodeURIComponent(userEmail)}`,
    {
      method: 'DELETE',
    }
  );

  const payload = await parseJson(response, 'Could not delete folder');
  return payload.deletedFolderId;
};

export const fetchDocument = async (documentId, userEmail) => {
  const response = await fetch(
    `${API_URL}/documents/${documentId}?userEmail=${encodeURIComponent(userEmail)}`
  );
  const payload = await parseJson(response, 'Could not open document');
  return payload.document;
};

export const updateDocument = async ({ documentId, userEmail, title, content }) => {
  const response = await fetch(`${API_URL}/documents/${documentId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      userEmail,
      title,
      content,
    }),
  });
  const payload = await parseJson(response, 'Could not save document');
  return payload.document;
};

export const moveDocumentToFolder = async ({ documentId, userEmail, folderId }) => {
  const response = await fetch(`${API_URL}/documents/${documentId}/folder`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      userEmail,
      folderId,
    }),
  });
  const payload = await parseJson(response, 'Could not move document');
  return payload.document;
};

export const fetchDocumentVersions = async ({ documentId, userEmail }) => {
  const response = await fetch(
    `${API_URL}/documents/${documentId}/versions?userEmail=${encodeURIComponent(userEmail)}`
  );
  const payload = await parseJson(response, 'Could not load version history');
  return payload.versions || [];
};

export const restoreDocumentVersion = async ({ documentId, versionId, userEmail }) => {
  const response = await fetch(`${API_URL}/documents/${documentId}/versions/${versionId}/restore`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      userEmail,
    }),
  });
  const payload = await parseJson(response, 'Could not restore document version');
  return payload.document;
};

export const exportDocumentPdf = async ({ documentId, userEmail }) => {
  const response = await fetch(
    `${API_URL}/documents/${documentId}/export/pdf?userEmail=${encodeURIComponent(userEmail)}`
  );

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || 'Could not export PDF');
  }

  return response.blob();
};

export const fetchInvites = async (userEmail) => {
  const response = await fetch(
    `${API_URL}/invites?userEmail=${encodeURIComponent(userEmail)}`
  );
  const payload = await parseJson(response, 'Could not load invitations');
  return payload.invites || [];
};

export const fetchInvite = async (token) => {
  const response = await fetch(`${API_URL}/invites/${encodeURIComponent(token)}`);
  const payload = await parseJson(response, 'Could not load invitation');
  return payload.invite;
};

export const acceptInvite = async ({ token, userEmail }) => {
  const response = await fetch(`${API_URL}/invites/${encodeURIComponent(token)}/accept`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      userEmail,
    }),
  });

  const payload = await parseJson(response, 'Could not accept invitation');
  return payload.document;
};
