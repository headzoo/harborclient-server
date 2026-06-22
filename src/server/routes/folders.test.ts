import { describe, expect, it } from 'vitest';
import { createStubDatabase } from '#/db/stubDatabase.js';
import { authHeader, createProtectedTestApp } from '#/server/routes/test/createTestApp.js';

const sampleFolder = {
  id: 'folder-1',
  collectionId: 'collection-1',
  name: 'Auth',
  sortOrder: 0,
  createdAt: new Date('2026-01-03T00:00:00.000Z')
};

describe('folder routes', () => {
  it('creates a folder in a collection', async () => {
    const db = createStubDatabase();
    db.createFolder.mockResolvedValue(sampleFolder);
    const app = await createProtectedTestApp({ db, withValidAuth: true });

    const response = await app.inject({
      method: 'POST',
      url: '/collections/collection-1/folders',
      headers: authHeader(),
      payload: { name: 'Auth' }
    });

    expect(response.statusCode).toBe(200);
    expect(db.createFolder).toHaveBeenCalledWith('collection-1', 'Auth');
    expect(response.json().name).toBe('Auth');

    await app.close();
  });

  it('reorders folders within a collection', async () => {
    const db = createStubDatabase();
    db.reorderFolders.mockResolvedValue(undefined);
    const app = await createProtectedTestApp({ db, withValidAuth: true });

    const response = await app.inject({
      method: 'PUT',
      url: '/collections/collection-1/folders/reorder',
      headers: authHeader(),
      payload: { orderedFolderIds: ['folder-2', 'folder-1'] }
    });

    expect(response.statusCode).toBe(204);
    expect(db.reorderFolders).toHaveBeenCalledWith('collection-1', ['folder-2', 'folder-1']);

    await app.close();
  });
});
