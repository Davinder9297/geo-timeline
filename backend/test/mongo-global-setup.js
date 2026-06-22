const { MongoMemoryReplSet } = require('mongodb-memory-server');

module.exports = async function globalSetup() {
  // The app uses MongoDB transactions (session.withTransaction), which require
  // a replica set — a plain standalone MongoMemoryServer rejects transactions
  // with "Transaction numbers are only allowed on a replica set member or mongos".
  const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  global.__MONGOD__ = replSet;
  process.env.MONGODB_URI = replSet.getUri('geo-timeline-e2e');
  process.env.JWT_SECRET = 'e2e-test-secret';
  process.env.NODE_ENV = 'test';
};
