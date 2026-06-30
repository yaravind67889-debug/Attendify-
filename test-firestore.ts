import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';

async function test() {
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  console.log('Project ID:', firebaseConfig.projectId);
  console.log('Custom DB ID:', firebaseConfig.firestoreDatabaseId);

  const app = initializeApp(firebaseConfig);

  // 1. Test Default Database
  try {
    console.log('\n--- Testing (default) database ---');
    const defaultDb = getFirestore(app);
    const snapshot = await getDocs(collection(defaultDb, 'settings'));
    console.log(`Success on (default)! Retrieved ${snapshot.size} documents.`);
  } catch (err: any) {
    console.log('Failed on (default) with error:', err.message);
  }

  // 2. Test Custom Named Database
  try {
    console.log('\n--- Testing Custom Named database (settings) ---');
    const customDb = getFirestore(app, firebaseConfig.firestoreDatabaseId);
    const snapshot = await getDocs(collection(customDb, 'settings'));
    console.log(`Success on Custom Named DB (settings)! Retrieved ${snapshot.size} documents.`);
    snapshot.forEach(doc => {
      console.log(doc.id, '=>', doc.data());
    });

    console.log('\n--- Testing Custom Named database (subjects) ---');
    const subSnapshot = await getDocs(collection(customDb, 'subjects'));
    console.log(`Success on Custom Named DB (subjects)! Retrieved ${subSnapshot.size} documents.`);
    subSnapshot.forEach(doc => {
      console.log(doc.id, '=>', doc.data());
    });
  } catch (err: any) {
    console.log('Failed on Custom Named DB with error:', err.message);
  }

  process.exit(0);
}

test();
