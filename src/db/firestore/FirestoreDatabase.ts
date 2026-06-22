import { randomUUID } from 'node:crypto';
import { Firestore, type DocumentReference } from '@google-cloud/firestore';
import {
  API_TOKENS_COLLECTION,
  COLLECTIONS_COLLECTION,
  ENVIRONMENTS_COLLECTION,
  FOLDERS_COLLECTION,
  REQUESTS_COLLECTION,
  WRITE_BATCH_LIMIT
} from '#/db/firestore/const.js';
import { firestoreConfigSchema } from '#/db/firestore/schemas.js';
import type {
  FirestoreApiTokenDocument,
  FirestoreCollectionDocument,
  FirestoreDatabaseConfig,
  FirestoreEnvironmentDocument,
  FirestoreFolderDocument,
  FirestoreRequestDocument
} from '#/db/firestore/types.js';
import {
  mapFirestoreApiToken,
  mapFirestoreCollection,
  mapFirestoreEnvironment,
  mapFirestoreFolder,
  mapFirestoreRequest
} from '#/db/firestore/utils.js';
import type { IDatabase } from '#/db/IDatabase.js';
import { trimRequiredName } from '#/db/trimRequiredName.js';
import type {
  ApiTokenRecord,
  AuthConfig,
  CollectionRecord,
  EnvironmentRecord,
  FolderRecord,
  KeyValue,
  SaveRequestInput,
  SavedRequestRecord,
  Variable
} from '#/db/types.js';
import { defaultAuth } from '#/db/types.js';
import { formatZodError } from '#/db/validation.js';

/**
 * Firestore-backed database implementation.
 */
export class FirestoreDatabase implements IDatabase {
  /**
   * Active Firestore client, or null when disconnected.
   */
  private client: Firestore | null = null;

  /**
   * Creates a Firestore database instance from validated config.
   *
   * @param config - Parsed Firestore connection settings.
   */
  constructor(private readonly config: FirestoreDatabaseConfig) {}

  /**
   * Validates raw config and constructs a {@link FirestoreDatabase}.
   *
   * @param config - Raw `db` section from server.yaml.
   * @returns Configured Firestore database instance.
   * @throws {Error} When config fails Firestore-specific validation.
   */
  static fromConfig(config: unknown): FirestoreDatabase {
    const parsed = firestoreConfigSchema.safeParse(config);
    if (!parsed.success) {
      throw new Error(formatZodError(parsed.error));
    }

    return new FirestoreDatabase({
      projectId: parsed.data.projectId,
      keyFilename: parsed.data.keyFilename
    });
  }

  /**
   * Opens a Firestore client and verifies connectivity by listing collections.
   */
  async connect(): Promise<void> {
    if (this.client) {
      return;
    }

    const client = new Firestore({
      projectId: this.config.projectId,
      keyFilename: this.config.keyFilename
    });

    await client.listCollections();

    this.client = client;
  }

  /**
   * Terminates the Firestore client and releases resources.
   */
  async disconnect(): Promise<void> {
    if (!this.client) {
      return;
    }

    await this.client.terminate();
    this.client = null;
  }

  /**
   * Firestore uses schemaless documents; no migration work is required.
   */
  async migrate(): Promise<void> {
    return;
  }

  /**
   * Inserts a new API token document.
   *
   * @param record - Token metadata to persist.
   */
  async createApiToken(record: ApiTokenRecord): Promise<void> {
    await this.requireClient().collection(API_TOKENS_COLLECTION).doc(record.id).set({
      name: record.name,
      tokenHash: record.tokenHash,
      tokenPrefix: record.tokenPrefix,
      createdAt: record.createdAt,
      lastUsedAt: record.lastUsedAt,
      revokedAt: record.revokedAt
    });
  }

  /**
   * Finds an active token by its stored hash.
   *
   * @param tokenHash - sha256 hex digest of the bearer token secret.
   */
  async findActiveApiTokenByHash(tokenHash: string): Promise<ApiTokenRecord | null> {
    const snapshot = await this.requireClient()
      .collection(API_TOKENS_COLLECTION)
      .where('tokenHash', '==', tokenHash)
      .limit(1)
      .get();

    const doc = snapshot.docs[0];
    if (!doc) {
      return null;
    }

    const data = doc.data() as FirestoreApiTokenDocument;
    if (data.revokedAt !== null) {
      return null;
    }

    return mapFirestoreApiToken(doc.id, data);
  }

  /**
   * Lists all API tokens ordered by creation time descending.
   */
  async listApiTokens(): Promise<ApiTokenRecord[]> {
    const snapshot = await this.requireClient()
      .collection(API_TOKENS_COLLECTION)
      .orderBy('createdAt', 'desc')
      .get();

    return snapshot.docs.map((doc) =>
      mapFirestoreApiToken(doc.id, doc.data() as FirestoreApiTokenDocument)
    );
  }

  /**
   * Soft-revokes an active token by id.
   *
   * @param id - Token identifier to revoke.
   */
  async revokeApiToken(id: string): Promise<boolean> {
    const docRef = this.requireClient().collection(API_TOKENS_COLLECTION).doc(id);
    const snapshot = await docRef.get();
    if (!snapshot.exists) {
      return false;
    }

    const data = snapshot.data() as FirestoreApiTokenDocument;
    if (data.revokedAt !== null) {
      return false;
    }

    await docRef.update({ revokedAt: new Date() });
    return true;
  }

  /**
   * Updates the last-used timestamp for a token.
   *
   * @param id - Token identifier that authenticated a request.
   * @param when - Timestamp of the authenticated request.
   */
  async touchApiTokenLastUsed(id: string, when: Date): Promise<void> {
    await this.requireClient()
      .collection(API_TOKENS_COLLECTION)
      .doc(id)
      .update({ lastUsedAt: when });
  }

  /**
   * Lists all collections ordered by name.
   */
  async listCollections(): Promise<CollectionRecord[]> {
    const snapshot = await this.requireClient()
      .collection(COLLECTIONS_COLLECTION)
      .orderBy('name')
      .get();

    return snapshot.docs.map((doc) =>
      mapFirestoreCollection(doc.id, doc.data() as FirestoreCollectionDocument)
    );
  }

  /**
   * Creates a new collection with the given name.
   *
   * @param name - Display name for the collection.
   */
  async createCollection(name: string): Promise<CollectionRecord> {
    const trimmedName = trimRequiredName(name, 'Collection name');
    const id = randomUUID();
    const createdAt = new Date();
    const data: FirestoreCollectionDocument = {
      name: trimmedName,
      variables: [],
      headers: [],
      auth: defaultAuth(),
      preRequestScript: '',
      postRequestScript: '',
      createdAt
    };

    await this.requireClient().collection(COLLECTIONS_COLLECTION).doc(id).set(data);
    return mapFirestoreCollection(id, data);
  }

  /**
   * Updates a collection's name, variables, headers, and scripts.
   */
  async updateCollection(
    id: string,
    name: string,
    variables: Variable[],
    headers: KeyValue[],
    preRequestScript: string,
    postRequestScript: string,
    auth: AuthConfig
  ): Promise<CollectionRecord> {
    const trimmedName = trimRequiredName(name, 'Collection name');
    const docRef = this.requireClient().collection(COLLECTIONS_COLLECTION).doc(id);
    const snapshot = await docRef.get();
    if (!snapshot.exists) {
      throw new Error('Collection not found');
    }

    const existing = snapshot.data() as FirestoreCollectionDocument;
    const updated: FirestoreCollectionDocument = {
      ...existing,
      name: trimmedName,
      variables,
      headers,
      auth,
      preRequestScript,
      postRequestScript
    };

    await docRef.update({
      name: trimmedName,
      variables,
      headers,
      auth,
      preRequestScript,
      postRequestScript
    });

    return mapFirestoreCollection(id, updated);
  }

  /**
   * Deletes a collection and all of its requests and folders.
   *
   * @param id - Collection ID to delete.
   */
  async deleteCollection(id: string): Promise<void> {
    const client = this.requireClient();
    const requestsSnap = await client
      .collection(REQUESTS_COLLECTION)
      .where('collectionId', '==', id)
      .get();
    const foldersSnap = await client
      .collection(FOLDERS_COLLECTION)
      .where('collectionId', '==', id)
      .get();

    const refs = [
      ...requestsSnap.docs.map((requestDoc) => requestDoc.ref),
      ...foldersSnap.docs.map((folderDoc) => folderDoc.ref),
      client.collection(COLLECTIONS_COLLECTION).doc(id)
    ];

    await this.commitBatchedDeletes(refs);
  }

  /**
   * Lists all environments ordered by name.
   */
  async listEnvironments(): Promise<EnvironmentRecord[]> {
    const snapshot = await this.requireClient()
      .collection(ENVIRONMENTS_COLLECTION)
      .orderBy('name')
      .get();

    return snapshot.docs.map((doc) =>
      mapFirestoreEnvironment(doc.id, doc.data() as FirestoreEnvironmentDocument)
    );
  }

  /**
   * Creates a new environment with the given name.
   *
   * @param name - Display name for the environment.
   */
  async createEnvironment(name: string): Promise<EnvironmentRecord> {
    const trimmedName = trimRequiredName(name, 'Environment name');
    const id = randomUUID();
    const createdAt = new Date();
    const data: FirestoreEnvironmentDocument = {
      name: trimmedName,
      variables: [],
      createdAt
    };

    await this.requireClient().collection(ENVIRONMENTS_COLLECTION).doc(id).set(data);
    return mapFirestoreEnvironment(id, data);
  }

  /**
   * Updates an environment's name and variables.
   */
  async updateEnvironment(
    id: string,
    name: string,
    variables: Variable[]
  ): Promise<EnvironmentRecord> {
    const trimmedName = trimRequiredName(name, 'Environment name');
    const docRef = this.requireClient().collection(ENVIRONMENTS_COLLECTION).doc(id);
    const snapshot = await docRef.get();
    if (!snapshot.exists) {
      throw new Error('Environment not found');
    }

    const existing = snapshot.data() as FirestoreEnvironmentDocument;
    const updated: FirestoreEnvironmentDocument = {
      ...existing,
      name: trimmedName,
      variables
    };

    await docRef.update({ name: trimmedName, variables });
    return mapFirestoreEnvironment(id, updated);
  }

  /**
   * Deletes an environment.
   *
   * @param id - Environment ID to delete.
   */
  async deleteEnvironment(id: string): Promise<void> {
    await this.requireClient().collection(ENVIRONMENTS_COLLECTION).doc(id).delete();
  }

  /**
   * Lists all saved requests in a collection.
   *
   * @param collectionId - Collection to query.
   */
  async listRequests(collectionId: string): Promise<SavedRequestRecord[]> {
    const snapshot = await this.requireClient()
      .collection(REQUESTS_COLLECTION)
      .where('collectionId', '==', collectionId)
      .get();

    return snapshot.docs
      .map((doc) => mapFirestoreRequest(doc.id, doc.data() as FirestoreRequestDocument))
      .sort((left, right) => {
        if (left.sortOrder !== right.sortOrder) {
          return left.sortOrder - right.sortOrder;
        }

        return left.name.localeCompare(right.name);
      });
  }

  /**
   * Inserts a new request or updates an existing one.
   *
   * @param input - Request fields to persist.
   */
  async saveRequest(input: SaveRequestInput): Promise<SavedRequestRecord> {
    const trimmedName = trimRequiredName(input.name, 'Request name');
    const folderId = input.folderId ?? null;
    const now = new Date();
    const client = this.requireClient();

    if (folderId != null) {
      const folderSnap = await client.collection(FOLDERS_COLLECTION).doc(folderId).get();
      if (!folderSnap.exists) {
        throw new Error('Folder not found');
      }

      const folder = folderSnap.data() as FirestoreFolderDocument;
      if (folder.collectionId !== input.collectionId) {
        throw new Error('Folder not found');
      }
    }

    if (input.id) {
      const docRef = client.collection(REQUESTS_COLLECTION).doc(input.id);
      const snapshot = await docRef.get();
      if (snapshot.exists) {
        const existing = snapshot.data() as FirestoreRequestDocument;
        const updated: FirestoreRequestDocument = {
          ...existing,
          collectionId: input.collectionId,
          folderId,
          name: trimmedName,
          method: input.method,
          url: input.url,
          headers: input.headers,
          params: input.params,
          auth: input.auth,
          body: input.body,
          bodyType: input.bodyType,
          preRequestScript: input.preRequestScript,
          postRequestScript: input.postRequestScript,
          comment: input.comment,
          updatedAt: now
        };

        await docRef.update({
          collectionId: input.collectionId,
          folderId,
          name: trimmedName,
          method: input.method,
          url: input.url,
          headers: input.headers,
          params: input.params,
          auth: input.auth,
          body: input.body,
          bodyType: input.bodyType,
          preRequestScript: input.preRequestScript,
          postRequestScript: input.postRequestScript,
          comment: input.comment,
          updatedAt: now
        });

        return mapFirestoreRequest(input.id, updated);
      }
    }

    const existingRequests = await this.listRequests(input.collectionId);
    const maxOrder = existingRequests
      .filter((request) => request.folderId === folderId)
      .reduce((max, request) => Math.max(max, request.sortOrder), -1);
    const id = randomUUID();
    const data: FirestoreRequestDocument = {
      collectionId: input.collectionId,
      folderId,
      name: trimmedName,
      method: input.method,
      url: input.url,
      headers: input.headers,
      params: input.params,
      auth: input.auth,
      body: input.body,
      bodyType: input.bodyType,
      preRequestScript: input.preRequestScript,
      postRequestScript: input.postRequestScript,
      comment: input.comment,
      sortOrder: maxOrder + 1,
      createdAt: now,
      updatedAt: now
    };

    await client.collection(REQUESTS_COLLECTION).doc(id).set(data);
    return mapFirestoreRequest(id, data);
  }

  /**
   * Deletes a saved request by ID.
   *
   * @param id - Request ID to delete.
   */
  async deleteRequest(id: string): Promise<void> {
    await this.requireClient().collection(REQUESTS_COLLECTION).doc(id).delete();
  }

  /**
   * Lists all folders in a collection.
   *
   * @param collectionId - Collection to query.
   */
  async listFolders(collectionId: string): Promise<FolderRecord[]> {
    const snapshot = await this.requireClient()
      .collection(FOLDERS_COLLECTION)
      .where('collectionId', '==', collectionId)
      .get();

    return snapshot.docs
      .map((doc) => mapFirestoreFolder(doc.id, doc.data() as FirestoreFolderDocument))
      .sort((left, right) => {
        if (left.sortOrder !== right.sortOrder) {
          return left.sortOrder - right.sortOrder;
        }

        return left.name.localeCompare(right.name);
      });
  }

  /**
   * Creates a new folder in a collection.
   *
   * @param collectionId - Collection to add the folder to.
   * @param name - Display name for the folder.
   */
  async createFolder(collectionId: string, name: string): Promise<FolderRecord> {
    const trimmedName = trimRequiredName(name, 'Folder name');
    const id = randomUUID();
    const createdAt = new Date();
    const existingFolders = await this.listFolders(collectionId);
    const maxOrder = existingFolders.reduce((max, folder) => Math.max(max, folder.sortOrder), -1);
    const data: FirestoreFolderDocument = {
      collectionId,
      name: trimmedName,
      sortOrder: maxOrder + 1,
      createdAt
    };

    await this.requireClient().collection(FOLDERS_COLLECTION).doc(id).set(data);
    return mapFirestoreFolder(id, data);
  }

  /**
   * Renames a folder.
   *
   * @param id - Folder ID to rename.
   * @param name - New display name.
   */
  async renameFolder(id: string, name: string): Promise<FolderRecord> {
    const trimmedName = trimRequiredName(name, 'Folder name');
    const docRef = this.requireClient().collection(FOLDERS_COLLECTION).doc(id);
    const snapshot = await docRef.get();
    if (!snapshot.exists) {
      throw new Error('Folder not found');
    }

    const existing = snapshot.data() as FirestoreFolderDocument;
    await docRef.update({ name: trimmedName });
    return mapFirestoreFolder(id, { ...existing, name: trimmedName });
  }

  /**
   * Deletes a folder and all requests inside it.
   *
   * @param id - Folder ID to delete.
   */
  async deleteFolder(id: string): Promise<void> {
    const client = this.requireClient();
    const requestsSnap = await client
      .collection(REQUESTS_COLLECTION)
      .where('folderId', '==', id)
      .get();

    const refs = [
      ...requestsSnap.docs.map((requestDoc) => requestDoc.ref),
      client.collection(FOLDERS_COLLECTION).doc(id)
    ];

    await this.commitBatchedDeletes(refs);
  }

  /**
   * Reorders folders within a collection.
   *
   * @param collectionId - Collection containing the folders.
   * @param orderedFolderIds - Folder IDs in desired order.
   */
  async reorderFolders(collectionId: string, orderedFolderIds: string[]): Promise<void> {
    const client = this.requireClient();
    const batch = client.batch();

    for (let index = 0; index < orderedFolderIds.length; index++) {
      const docRef = client.collection(FOLDERS_COLLECTION).doc(orderedFolderIds[index]);
      batch.update(docRef, { sortOrder: index, collectionId });
    }

    await batch.commit();
  }

  /**
   * Reorders requests within a folder or at collection root.
   */
  async reorderRequests(
    collectionId: string,
    folderId: string | null,
    orderedRequestIds: string[]
  ): Promise<void> {
    const client = this.requireClient();
    const batch = client.batch();

    for (let index = 0; index < orderedRequestIds.length; index++) {
      const docRef = client.collection(REQUESTS_COLLECTION).doc(orderedRequestIds[index]);
      batch.update(docRef, { sortOrder: index, folderId, collectionId });
    }

    await batch.commit();
  }

  /**
   * Moves a request to another folder or collection root at a given index.
   */
  async moveRequest(requestId: string, folderId: string | null, index: number): Promise<void> {
    const client = this.requireClient();
    const requestSnap = await client.collection(REQUESTS_COLLECTION).doc(requestId).get();
    if (!requestSnap.exists) {
      throw new Error('Request not found');
    }

    const request = mapFirestoreRequest(
      requestSnap.id,
      requestSnap.data() as FirestoreRequestDocument
    );
    const collectionId = request.collectionId;
    const oldFolderId = request.folderId;

    if (folderId != null) {
      const folderSnap = await client.collection(FOLDERS_COLLECTION).doc(folderId).get();
      if (!folderSnap.exists) {
        throw new Error('Folder not found');
      }

      const folder = folderSnap.data() as FirestoreFolderDocument;
      if (folder.collectionId !== collectionId) {
        throw new Error('Folder not found');
      }
    }

    /**
     * Lists request ids in a container ordered for reindexing.
     *
     * @param targetFolderId - Folder id or null for collection root.
     */
    const listInContainer = async (targetFolderId: string | null): Promise<string[]> => {
      const requests = await this.listRequests(collectionId);
      return requests
        .filter((item) => item.folderId === targetFolderId)
        .sort((left, right) => {
          if (left.sortOrder !== right.sortOrder) {
            return left.sortOrder - right.sortOrder;
          }

          return left.name.localeCompare(right.name);
        })
        .map((item) => item.id);
    };

    /**
     * Rewrites sort_order and folder_id for a container's request list.
     *
     * @param targetFolderId - Folder id or null for collection root.
     * @param orderedIds - Request ids in desired order.
     */
    const reindexContainer = async (
      targetFolderId: string | null,
      orderedIds: string[]
    ): Promise<void> => {
      const batch = client.batch();
      for (let sortIndex = 0; sortIndex < orderedIds.length; sortIndex++) {
        const docRef = client.collection(REQUESTS_COLLECTION).doc(orderedIds[sortIndex]);
        batch.update(docRef, { sortOrder: sortIndex, folderId: targetFolderId });
      }
      await batch.commit();
    };

    if (oldFolderId === folderId) {
      const siblings = (await listInContainer(folderId)).filter((id) => id !== requestId);
      siblings.splice(index, 0, requestId);
      await reindexContainer(folderId, siblings);
      return;
    }

    const oldIds = (await listInContainer(oldFolderId)).filter((id) => id !== requestId);
    await reindexContainer(oldFolderId, oldIds);

    const newIds = (await listInContainer(folderId)).filter((id) => id !== requestId);
    newIds.splice(index, 0, requestId);
    await reindexContainer(folderId, newIds);
  }

  /**
   * Commits document deletes in Firestore-sized batches.
   *
   * @param refs - Document refs to delete.
   */
  private async commitBatchedDeletes(refs: DocumentReference[]): Promise<void> {
    const client = this.requireClient();

    for (let offset = 0; offset < refs.length; offset += WRITE_BATCH_LIMIT) {
      const batch = client.batch();
      for (const ref of refs.slice(offset, offset + WRITE_BATCH_LIMIT)) {
        batch.delete(ref);
      }
      await batch.commit();
    }
  }

  /**
   * Returns the active Firestore client or throws when connect has not been called.
   *
   * @returns Connected Firestore client.
   * @throws {Error} When the database is not connected.
   */
  private requireClient(): Firestore {
    if (!this.client) {
      throw new Error('Firestore database is not connected.');
    }

    return this.client;
  }
}
