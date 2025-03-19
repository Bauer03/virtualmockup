import { SimulationRun } from '../types/types';

export class DatabaseService {
  private static readonly DB_NAME = 'virtualSubstanceDB';
  private static readonly STORE_NAME = 'outputs';
  private static readonly VERSION = 4;
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DatabaseService.DB_NAME, DatabaseService.VERSION);

      request.onerror = () => reject(request.error);
      
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // If the old store exists, delete it
        if (db.objectStoreNames.contains(DatabaseService.STORE_NAME)) {
          db.deleteObjectStore(DatabaseService.STORE_NAME);
        }
        
        // Create new store using string uid as keyPath
        db.createObjectStore(DatabaseService.STORE_NAME, { 
          keyPath: 'uid_str'
        });
      };
    });
  }

  async addOutput(data: SimulationRun): Promise<string> {
    if (!this.db) throw new Error('Database not initialized');

    // Validate data
    if(!data.uid || !data.runNumber || !data.timestamp || !data.outputData || !data.inputData) {
      console.error('Invalid data:', data);
      throw new Error('Invalid data: Cannot save to db.');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([DatabaseService.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(DatabaseService.STORE_NAME);
      
      // Convert the numeric UID to string and add it as a separate key
      const dataWithStringUID = {
        ...data,
        uid_str: data.uid.toString()
      };
      
      const request = store.add(dataWithStringUID);

      request.onsuccess = () => resolve(dataWithStringUID.uid_str);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllOutputs(): Promise<SimulationRun[]> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([DatabaseService.STORE_NAME], 'readonly');
      const store = transaction.objectStore(DatabaseService.STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        // Convert back to the expected format
        const results = request.result.map(item => {
          const { uid_str, ...rest } = item;
          return {
            ...rest,
            uid: Number(uid_str)
          } as SimulationRun;
        });
        resolve(results);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async deleteOutput(uid: number): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([DatabaseService.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(DatabaseService.STORE_NAME);
      
      // Convert the numeric UID to string for lookup
      const uid_str = uid.toString();
      
      const deleteRequest = store.delete(uid_str);
      
      deleteRequest.onsuccess = () => resolve();
      deleteRequest.onerror = (error) => {
        console.error('Delete request error:', error);
        reject(new Error('Failed to delete record'));
      };
    });
  }

  async clearAllOutputs(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([DatabaseService.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(DatabaseService.STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}