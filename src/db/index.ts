import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';
import path from 'path';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import { neon } from '@neondatabase/serverless';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, getDocs, getDoc, setDoc, updateDoc, deleteDoc, query, where, writeBatch } from 'firebase/firestore';

// 1. Local SQLite initialization
const dbPath = path.join(process.cwd(), 'sqlite.db');
export const sqliteInstance = new Database(dbPath);
sqliteInstance.pragma('foreign_keys = ON');

export const localDrizzle = drizzle(sqliteInstance, { schema });

// 2. Database Integrations Setup (Firebase, Supabase & Neon)
let firebaseConfig: any = null;
try {
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }
} catch (err) {
  console.log('No firebase-applet-config.json found or invalid JSON');
}

export let useFirestore = !!(firebaseConfig && firebaseConfig.projectId);
const firebaseApp = useFirestore ? initializeApp(firebaseConfig) : null;
export const firestoreDb = useFirestore ? (
  firebaseConfig.firestoreDatabaseId
    ? getFirestore(firebaseApp!, firebaseConfig.firestoreDatabaseId)
    : getFirestore(firebaseApp!)
) : null;

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';
const databaseUrl = process.env.DATABASE_URL || '';

export const useNeon = !useFirestore && !!databaseUrl;
export const sql = useNeon ? neon(databaseUrl) : null;

export const useSupabase = !useFirestore && !useNeon && !!(supabaseUrl && supabaseAnonKey);
export const supabase = useSupabase ? createClient(supabaseUrl, supabaseAnonKey) : null;

if (useFirestore) {
  console.log('Firestore active. Connecting to Firebase Project:', firebaseConfig.projectId);
} else if (useNeon) {
  console.log('Neon DB active. Connecting to Postgres database.');
} else if (useSupabase) {
  console.log('Supabase active. Connecting to:', supabaseUrl);
} else {
  console.log('Remote credentials not fully configured. Using local SQLite.');
}

async function runNeonQuery(queryStr: string, params: any[] = []): Promise<any> {
  if (!sql) throw new Error('Neon database is not configured or active');
  const strings = [queryStr] as any as TemplateStringsArray;
  (strings as any).raw = [queryStr];
  return sql(strings, ...params);
}

// 3. Field and Table Mappings (camelCase <-> snake_case)
const FIELD_MAPPING: Record<string, Record<string, string>> = {
  admins: {
    passwordHash: 'password_hash'
  },
  students: {
    rollNumber: 'roll_number',
    regNumber: 'reg_number',
    parentName: 'parent_name',
    parentMobile: 'parent_mobile'
  },
  attendance: {
    studentId: 'student_id'
  },
  requests: {
    studentId: 'student_id',
    adminReply: 'admin_reply'
  }
};

const INVERSE_MAPPING: Record<string, Record<string, string>> = {};
for (const [table, mapping] of Object.entries(FIELD_MAPPING)) {
  INVERSE_MAPPING[table] = {};
  for (const [jsKey, dbKey] of Object.entries(mapping)) {
    INVERSE_MAPPING[table][dbKey] = jsKey;
  }
}

function getTableName(table: any): string {
  if (typeof table === 'string') return table;
  if (table && table[Symbol.for('drizzle:Name')]) {
    return table[Symbol.for('drizzle:Name')];
  }
  // Fallbacks
  if (table === schema.admins) return 'admins';
  if (table === schema.students) return 'students';
  if (table === schema.subjects) return 'subjects';
  if (table === schema.attendance) return 'attendance';
  if (table === schema.notices) return 'notices';
  if (table === schema.requests) return 'requests';
  return '';
}

function mapToDb(tableName: string, data: any): any {
  if (!data || typeof data !== 'object') return data;
  if (Array.isArray(data)) return data.map(item => mapToDb(tableName, item));
  
  const mapping = FIELD_MAPPING[tableName];
  if (!mapping) return data;
  
  const result: any = {};
  for (const [key, val] of Object.entries(data)) {
    const dbKey = mapping[key] || key;
    result[dbKey] = val;
  }
  return result;
}

function mapFromDb(tableName: string, data: any): any {
  if (!data || typeof data !== 'object') return data;
  if (Array.isArray(data)) return data.map(item => mapFromDb(tableName, item));
  
  const mapping = INVERSE_MAPPING[tableName];
  if (!mapping) return data;
  
  const result: any = {};
  for (const [key, val] of Object.entries(data)) {
    const jsKey = mapping[key] || key;
    result[jsKey] = val;
  }
  return result;
}

// Extract column filters from drizzle eq() and and()
function getFilters(condition: any): Record<string, any> {
  const filters: Record<string, any> = {};
  if (!condition) return filters;

  const flattened: any[] = [];
  const flatten = (n: any) => {
    if (!n) return;
    if (n.queryChunks && Array.isArray(n.queryChunks)) {
      for (const chunk of n.queryChunks) {
        flatten(chunk);
      }
    } else {
      flattened.push(n);
    }
  };

  flatten(condition);

  for (let i = 0; i < flattened.length; i++) {
    const current = flattened[i];
    if (current && typeof current === 'object' && 'name' in current && current.table) {
      const columnName = current.name;
      // Look ahead for a Param chunk
      for (let j = i + 1; j < Math.min(i + 5, flattened.length); j++) {
        const next = flattened[j];
        if (next && typeof next === 'object' && 'brand' in next && 'value' in next) {
          filters[columnName] = next.value;
          break;
        }
      }
    }
  }

  return filters;
}

// 4. Supabase Query Chaining Classes
class SupabaseQueryBuilder {
  private tableName: string = '';
  private selectFields: any = null;
  private condition: any = null;
  private joinedTable: any = null;

  constructor(selectFields?: any) {
    this.selectFields = selectFields;
  }

  from(table: any) {
    this.tableName = getTableName(table);
    return this;
  }

  where(condition: any) {
    this.condition = condition;
    return this;
  }

  leftJoin(table: any, condition: any) {
    this.joinedTable = table;
    return this;
  }

  async all() {
    // Handle Requests joined with Students
    if (this.tableName === 'requests' && getTableName(this.joinedTable) === 'students') {
      if (useSupabase) {
        const { data, error } = await supabase!
          .from('requests')
          .select(`
            id,
            date,
            subject,
            message,
            status,
            admin_reply,
            student_id,
            students (
              name,
              pin
            )
          `);
        if (error) {
          console.error('Supabase join query failed:', error);
          throw error;
        }
        return (data || []).map((row: any) => ({
          id: row.id,
          date: row.date,
          subject: row.subject,
          message: row.message,
          status: row.status,
          adminReply: row.admin_reply,
          studentName: row.students?.name,
          studentPin: row.students?.pin
        }));
      } else if (useNeon) {
        const rows = await runNeonQuery(`
          SELECT r.id, r.date, r.subject, r.message, r.status, r.admin_reply, r.student_id,
                 s.name as student_name, s.pin as student_pin
          FROM requests r
          LEFT JOIN students s ON r.student_id = s.id
        `);
        return (rows || []).map((row: any) => ({
          id: row.id,
          date: row.date,
          subject: row.subject,
          message: row.message,
          status: row.status,
          adminReply: row.admin_reply,
          studentName: row.student_name,
          studentPin: row.student_pin
        }));
      }
    }

    if (useSupabase) {
      let query = supabase!.from(this.tableName).select('*');
      const filters = getFilters(this.condition);
      for (const [col, val] of Object.entries(filters)) {
        const mapping = FIELD_MAPPING[this.tableName];
        const dbCol = mapping ? (mapping[col] || col) : col;
        if (val === null) {
          query = query.is(dbCol, null);
        } else {
          query = query.eq(dbCol, val);
        }
      }

      const { data, error } = await query;
      if (error) {
        console.error(`Supabase select failed on ${this.tableName}:`, error);
        throw error;
      }

      const mapped = mapFromDb(this.tableName, data || []);
      if (this.selectFields) {
        return mapped.map((row: any) => {
          const projected: any = {};
          for (const [key, val] of Object.entries(this.selectFields)) {
            const srcKey = (val as any).name || key;
            projected[key] = row[srcKey];
          }
          return projected;
        });
      }

      return mapped;
    } else if (useNeon) {
      let queryStr = `SELECT * FROM ${this.tableName}`;
      const filters = getFilters(this.condition);
      const whereClauses: string[] = [];
      const params: any[] = [];
      
      let paramIndex = 1;
      for (const [col, val] of Object.entries(filters)) {
        const mapping = FIELD_MAPPING[this.tableName];
        const dbCol = mapping ? (mapping[col] || col) : col;
        
        if (val === null) {
          whereClauses.push(`${dbCol} IS NULL`);
        } else {
          whereClauses.push(`${dbCol} = $${paramIndex}`);
          params.push(val);
          paramIndex++;
        }
      }
      
      if (whereClauses.length > 0) {
        queryStr += ` WHERE ${whereClauses.join(' AND ')}`;
      }
      
      const rows = await runNeonQuery(queryStr, params);
      const mapped = mapFromDb(this.tableName, rows || []);
      
      if (this.selectFields) {
        return mapped.map((row: any) => {
          const projected: any = {};
          for (const [key, val] of Object.entries(this.selectFields)) {
            const srcKey = (val as any).name || key;
            projected[key] = row[srcKey];
          }
          return projected;
        });
      }
      return mapped;
    }

    return [];
  }

  async get() {
    const results = await this.all();
    return results[0] || undefined;
  }
}

class SupabaseInsertBuilder {
  private tableName: string;
  private insertData: any;

  constructor(table: any) {
    this.tableName = getTableName(table);
  }

  values(data: any) {
    this.insertData = data;
    return this;
  }

  async run() {
    const dbData = mapToDb(this.tableName, this.insertData);
    if (useSupabase) {
      const { error } = await supabase!
        .from(this.tableName)
        .insert(dbData);
      if (error) {
        console.error(`Supabase insert failed on ${this.tableName}:`, error);
        throw error;
      }
    } else if (useNeon) {
      const cols = Object.keys(dbData);
      const vals = Object.values(dbData);
      const placeholders = cols.map((_, idx) => `$${idx + 1}`).join(', ');
      const queryStr = `INSERT INTO ${this.tableName} (${cols.join(', ')}) VALUES (${placeholders})`;
      try {
        await runNeonQuery(queryStr, vals);
      } catch (err) {
        console.error(`Neon insert failed on ${this.tableName}:`, err);
        throw err;
      }
    }
    return { changes: 1 };
  }
}

class SupabaseUpdateBuilder {
  private tableName: string;
  private updateData: any;
  private condition: any;

  constructor(table: any) {
    this.tableName = getTableName(table);
  }

  set(data: any) {
    this.updateData = data;
    return this;
  }

  where(condition: any) {
    this.condition = condition;
    return this;
  }

  async run() {
    const dbData = mapToDb(this.tableName, this.updateData);
    if (useSupabase) {
      let query = supabase!.from(this.tableName).update(dbData);

      const filters = getFilters(this.condition);
      for (const [col, val] of Object.entries(filters)) {
        const mapping = FIELD_MAPPING[this.tableName];
        const dbCol = mapping ? (mapping[col] || col) : col;
        query = query.eq(dbCol, val);
      }

      const { error } = await query;
      if (error) {
        console.error(`Supabase update failed on ${this.tableName}:`, error);
        throw error;
      }
    } else if (useNeon) {
      const setClauses: string[] = [];
      const params: any[] = [];
      let pIndex = 1;
      
      for (const [col, val] of Object.entries(dbData)) {
        setClauses.push(`${col} = $${pIndex}`);
        params.push(val);
        pIndex++;
      }
      
      let queryStr = `UPDATE ${this.tableName} SET ${setClauses.join(', ')}`;
      
      const filters = getFilters(this.condition);
      const whereClauses: string[] = [];
      for (const [col, val] of Object.entries(filters)) {
        const mapping = FIELD_MAPPING[this.tableName];
        const dbCol = mapping ? (mapping[col] || col) : col;
        if (val === null) {
          whereClauses.push(`${dbCol} IS NULL`);
        } else {
          whereClauses.push(`${dbCol} = $${pIndex}`);
          params.push(val);
          pIndex++;
        }
      }
      
      if (whereClauses.length > 0) {
        queryStr += ` WHERE ${whereClauses.join(' AND ')}`;
      }
      
      try {
        await runNeonQuery(queryStr, params);
      } catch (err) {
        console.error(`Neon update failed on ${this.tableName}:`, err);
        throw err;
      }
    }
    return { changes: 1 };
  }
}

class SupabaseDeleteBuilder {
  private tableName: string;
  private condition: any;

  constructor(table: any) {
    this.tableName = getTableName(table);
  }

  where(condition: any) {
    this.condition = condition;
    return this;
  }

  async run() {
    if (useSupabase) {
      let query = supabase!.from(this.tableName).delete();

      const filters = getFilters(this.condition);
      for (const [col, val] of Object.entries(filters)) {
        const mapping = FIELD_MAPPING[this.tableName];
        const dbCol = mapping ? (mapping[col] || col) : col;
        query = query.eq(dbCol, val);
      }

      const { error } = await query;
      if (error) {
        console.error(`Supabase delete failed on ${this.tableName}:`, error);
        throw error;
      }
    } else if (useNeon) {
      let queryStr = `DELETE FROM ${this.tableName}`;
      const filters = getFilters(this.condition);
      const whereClauses: string[] = [];
      const params: any[] = [];
      let pIndex = 1;
      
      for (const [col, val] of Object.entries(filters)) {
        const mapping = FIELD_MAPPING[this.tableName];
        const dbCol = mapping ? (mapping[col] || col) : col;
        if (val === null) {
          whereClauses.push(`${dbCol} IS NULL`);
        } else {
          whereClauses.push(`${dbCol} = $${pIndex}`);
          params.push(val);
          pIndex++;
        }
      }
      
      if (whereClauses.length > 0) {
        queryStr += ` WHERE ${whereClauses.join(' AND ')}`;
      }
      
      try {
        await runNeonQuery(queryStr, params);
      } catch (err) {
        console.error(`Neon delete failed on ${this.tableName}:`, err);
        throw err;
      }
    }
    return { changes: 1 };
  }
}

async function getNextId(collectionName: string): Promise<number> {
  if (!firestoreDb) return 1;
  try {
    const snapshot = await getDocs(collection(firestoreDb, collectionName));
    let maxId = 0;
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      if (data && typeof data.id === 'number' && data.id > maxId) {
        maxId = data.id;
      }
    });
    return maxId + 1;
  } catch (err) {
    console.error(`Failed to get next ID for ${collectionName}:`, err);
    return Date.now();
  }
}

class FirestoreQueryBuilder {
  private tableName: string = '';
  private selectFields: any = null;
  private condition: any = null;

  constructor(fields?: any) {
    this.selectFields = fields;
  }

  from(table: any) {
    this.tableName = getTableName(table);
    return this;
  }

  where(condition: any) {
    this.condition = condition;
    return this;
  }

  async all() {
    if (!firestoreDb) return [];
    
    let q = collection(firestoreDb, this.tableName);
    const filters = getFilters(this.condition);
    const queryConstraints: any[] = [];
    
    for (const [col, val] of Object.entries(filters)) {
      const mapping = FIELD_MAPPING[this.tableName];
      const dbCol = mapping ? (mapping[col] || col) : col;
      
      if (val === null) {
        queryConstraints.push(where(dbCol, '==', null));
      } else {
        queryConstraints.push(where(dbCol, '==', val));
      }
    }
    
    let queryRef: any = q;
    if (queryConstraints.length > 0) {
      queryRef = query(q, ...queryConstraints);
    }
    
    try {
      const snapshot = await getDocs(queryRef);
      const rows: any[] = [];
      snapshot.forEach(docSnap => {
        rows.push(docSnap.data());
      });
      
      const mapped = mapFromDb(this.tableName, rows);
      
      if (this.selectFields) {
        return mapped.map((row: any) => {
          const projected: any = {};
          for (const [key, val] of Object.entries(this.selectFields)) {
            const srcKey = (val as any).name || key;
            projected[key] = row[srcKey];
          }
          return projected;
        });
      }
      return mapped;
    } catch (err) {
      console.error(`Firestore query failed on ${this.tableName}:`, err);
      throw err;
    }
  }

  async get() {
    const results = await this.all();
    return results[0] || undefined;
  }
}

class FirestoreInsertBuilder {
  private tableName: string;
  private insertData: any;

  constructor(table: any) {
    this.tableName = getTableName(table);
  }

  values(data: any) {
    this.insertData = data;
    return this;
  }

  async run() {
    if (!firestoreDb) return { changes: 0 };
    
    const dbData = mapToDb(this.tableName, this.insertData);
    
    if (dbData.id === undefined || dbData.id === null) {
      dbData.id = await getNextId(this.tableName);
    }
    
    const docId = String(dbData.id);
    
    try {
      await setDoc(doc(firestoreDb, this.tableName, docId), dbData);
    } catch (err) {
      console.error(`Firestore insert failed on ${this.tableName}:`, err);
      throw err;
    }
    return { changes: 1 };
  }
}

class FirestoreUpdateBuilder {
  private tableName: string;
  private updateData: any;
  private condition: any;

  constructor(table: any) {
    this.tableName = getTableName(table);
  }

  set(data: any) {
    this.updateData = data;
    return this;
  }

  where(condition: any) {
    this.condition = condition;
    return this;
  }

  async run() {
    if (!firestoreDb) return { changes: 0 };
    
    const dbData = mapToDb(this.tableName, this.updateData);
    const filters = getFilters(this.condition);
    
    if (filters.id !== undefined && filters.id !== null) {
      const docId = String(filters.id);
      try {
        await updateDoc(doc(firestoreDb, this.tableName, docId), dbData);
        return { changes: 1 };
      } catch (err) {
        console.error(`Firestore direct update failed on ${this.tableName} ID ${docId}:`, err);
        throw err;
      }
    }
    
    let q = collection(firestoreDb, this.tableName);
    const queryConstraints: any[] = [];
    for (const [col, val] of Object.entries(filters)) {
      const mapping = FIELD_MAPPING[this.tableName];
      const dbCol = mapping ? (mapping[col] || col) : col;
      queryConstraints.push(where(dbCol, '==', val));
    }
    
    let queryRef: any = q;
    if (queryConstraints.length > 0) {
      queryRef = query(q, ...queryConstraints);
    }
    
    try {
      const snapshot = await getDocs(queryRef);
      const batch = writeBatch(firestoreDb);
      snapshot.forEach(docSnap => {
        batch.update(docSnap.ref, dbData);
      });
      await batch.commit();
      return { changes: snapshot.size };
    } catch (err) {
      console.error(`Firestore bulk update failed on ${this.tableName}:`, err);
      throw err;
    }
  }
}

class FirestoreDeleteBuilder {
  private tableName: string;
  private condition: any;

  constructor(table: any) {
    this.tableName = getTableName(table);
  }

  where(condition: any) {
    this.condition = condition;
    return this;
  }

  async run() {
    if (!firestoreDb) return { changes: 0 };
    
    const filters = getFilters(this.condition);
    
    if (filters.id !== undefined && filters.id !== null) {
      const docId = String(filters.id);
      try {
        await deleteDoc(doc(firestoreDb, this.tableName, docId));
        return { changes: 1 };
      } catch (err) {
        console.error(`Firestore direct delete failed on ${this.tableName} ID ${docId}:`, err);
        throw err;
      }
    }
    
    let q = collection(firestoreDb, this.tableName);
    const queryConstraints: any[] = [];
    for (const [col, val] of Object.entries(filters)) {
      const mapping = FIELD_MAPPING[this.tableName];
      const dbCol = mapping ? (mapping[col] || col) : col;
      queryConstraints.push(where(dbCol, '==', val));
    }
    
    let queryRef: any = q;
    if (queryConstraints.length > 0) {
      queryRef = query(q, ...queryConstraints);
    }
    
    try {
      const snapshot = await getDocs(queryRef);
      const batch = writeBatch(firestoreDb);
      snapshot.forEach(docSnap => {
        batch.delete(docSnap.ref);
      });
      await batch.commit();
      return { changes: snapshot.size };
    } catch (err) {
      console.error(`Firestore bulk delete failed on ${this.tableName}:`, err);
      throw err;
    }
  }
}

// Verification & Graceful Fallback for Firestore
export async function verifyFirestoreConnection() {
  if (useFirestore) {
    try {
      console.log('Verifying Firestore connection and permission status...');
      // Try to write a test document to subjects. If this fails, we don't have write permissions
      // or the rules are too strict for our client, so we must fall back to SQLite.
      const testDocRef = doc(collection(firestoreDb!, 'subjects'), 'connection_test_doc');
      await setDoc(testDocRef, {
        id: 999999,
        name: 'TEST_CONNECTION_DO_NOT_USE',
        semester: 1
      });
      // Clean up the test document
      await deleteDoc(testDocRef);
      console.log('Firestore connection and write permissions verified successfully. Active and fully writable.');
    } catch (err: any) {
      console.error('--- FIRESTORE WRITE PERMISSION OR CONNECTION ERROR ---');
      console.error('Error Details:', err.message);
      console.error('Action: Falling back to local SQLite database to guarantee 100% application functionality.');
      console.error('--------------------------------------------------');
      useFirestore = false;
    }
  }
}

// 5. Settings cache and synchronizer
const settingsCache: Record<string, string> = {};

export async function initSupabaseSettings() {
  if (useFirestore) {
    try {
      const snapshot = await getDocs(collection(firestoreDb!, 'settings'));
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (data && data.key) {
          settingsCache[data.key] = data.value;
        }
      });
      console.log('Firestore settings loaded into local cache:', settingsCache);
    } catch (err) {
      console.error('Failed to pre-populate Firestore settings:', err);
    }
  } else if (useSupabase) {
    try {
      const { data, error } = await supabase!.from('settings').select('*');
      if (!error && data) {
        for (const row of data) {
          settingsCache[row.key] = row.value;
        }
        console.log('Supabase settings loaded into local cache:', settingsCache);
      }
    } catch (err) {
      console.error('Failed to pre-populate Supabase settings:', err);
    }
  } else if (useNeon) {
    try {
      const rows = await runNeonQuery(`SELECT * FROM settings`);
      if (rows) {
        for (const row of rows) {
          settingsCache[row.key] = row.value;
        }
        console.log('Neon settings loaded into local cache:', settingsCache);
      }
    } catch (err) {
      console.error('Failed to pre-populate Neon settings:', err);
    }
  }
}

// 6. Proxied Exports matching Drizzle ORM structure
export const db = {
  select(fields?: any) {
    if (useFirestore) {
      return new FirestoreQueryBuilder(fields);
    }
    if (useSupabase || useNeon) {
      return new SupabaseQueryBuilder(fields);
    }
    return localDrizzle.select(fields);
  },
  insert(table: any) {
    if (useFirestore) {
      return new FirestoreInsertBuilder(table);
    }
    if (useSupabase || useNeon) {
      return new SupabaseInsertBuilder(table);
    }
    return localDrizzle.insert(table);
  },
  update(table: any) {
    if (useFirestore) {
      return new FirestoreUpdateBuilder(table);
    }
    if (useSupabase || useNeon) {
      return new SupabaseUpdateBuilder(table);
    }
    return localDrizzle.update(table);
  },
  delete(table: any) {
    if (useFirestore) {
      return new FirestoreDeleteBuilder(table);
    }
    if (useSupabase || useNeon) {
      return new SupabaseDeleteBuilder(table);
    }
    return localDrizzle.delete(table);
  },
  run(query: string) {
    if (useFirestore || useSupabase || useNeon) {
      console.log('Skipping db.run query on Cloud DB:', query);
      return Promise.resolve();
    }
    return (localDrizzle as any).run(query);
  }
} as any;

export const sqlite = {
  prepare(query: string) {
    if (useFirestore || useSupabase || useNeon) {
      const lowerQuery = query.toLowerCase();
      return {
        get(...params: any[]) {
          if (lowerQuery.includes('select') && lowerQuery.includes('settings')) {
            const keyMatch = query.match(/key\s*=\s*'([^']+)'/i) || query.match(/key\s*=\s*\?/i);
            const key = keyMatch ? (keyMatch[1] || params[0]) : null;
            if (key) {
              const val = settingsCache[key];
              return val !== undefined ? { value: val } : undefined;
            }
          }
          return undefined;
        },
        run(...params: any[]) {
          if (lowerQuery.includes('insert') || lowerQuery.includes('replace')) {
            const key = 'signup_lock_password';
            const value = params[0];
            if (value !== undefined) {
              settingsCache[key] = value;
              if (useFirestore) {
                setDoc(doc(firestoreDb!, 'settings', key), { key, value })
                  .catch(err => console.error('Failed to sync settings to Firestore:', err));
              } else if (useSupabase) {
                supabase!.from('settings').upsert({ key, value }).then(({ error }) => {
                  if (error) console.error('Failed to sync settings to Supabase:', error);
                });
              } else if (useNeon) {
                runNeonQuery(`INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`, [key, value])
                  .catch(err => console.error('Failed to sync settings to Neon:', err));
              }
            }
          } else if (lowerQuery.includes('delete')) {
            const key = 'signup_lock_password';
            delete settingsCache[key];
            if (useFirestore) {
              deleteDoc(doc(firestoreDb!, 'settings', key))
                .catch(err => console.error('Failed to delete setting from Firestore:', err));
            } else if (useSupabase) {
              supabase!.from('settings').delete().eq('key', key).then(({ error }) => {
                if (error) console.error('Failed to delete setting from Supabase:', error);
              });
            } else if (useNeon) {
              runNeonQuery(`DELETE FROM settings WHERE key = $1`, [key])
                .catch(err => console.error('Failed to delete setting from Neon:', err));
            }
          }
          return { changes: 1 };
        }
      };
    }
    return sqliteInstance.prepare(query);
  }
} as any;
