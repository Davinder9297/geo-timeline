import 'dotenv/config';
import { MongoClient } from 'mongodb';
import { EJSON } from 'bson';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Full database backup — dumps every collection in the database to a
 * timestamped folder as EJSON (MongoDB's extended JSON), not plain JSON, so
 * ObjectId/Date/etc. round-trip exactly on restore instead of degrading to
 * plain strings. Connects with the raw driver rather than the Mongoose
 * schemas used elsewhere in this app, so it backs up the whole database —
 * including any collection not currently mapped to a schema — rather than
 * only the collections this app happens to know about today.
 */
async function backupDatabase() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost/geo-timeline';
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db();
    const dbName = db.databaseName;

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(__dirname, '..', 'backups', `${dbName}_${timestamp}`);
    fs.mkdirSync(backupDir, { recursive: true });

    const collections = await db.listCollections().toArray();
    console.log(`Backing up database "${dbName}" (${collections.length} collections) to:`);
    console.log(`  ${backupDir}\n`);

    let totalDocuments = 0;

    for (const { name } of collections) {
      const collection = db.collection(name);
      const documents = await collection.find({}).toArray();
      const filePath = path.join(backupDir, `${name}.json`);
      fs.writeFileSync(filePath, EJSON.stringify(documents, undefined, 2));
      console.log(`  ✓ ${name}: ${documents.length} documents`);
      totalDocuments += documents.length;
    }

    console.log(`\n✓ Backup complete — ${totalDocuments} documents across ${collections.length} collections.`);
    console.log(`✓ Saved to: ${backupDir}`);
  } catch (error) {
    console.error('✗ Backup failed:', (error as Error).message);
    process.exitCode = 1;
  } finally {
    await client.close();
  }
}

backupDatabase();
