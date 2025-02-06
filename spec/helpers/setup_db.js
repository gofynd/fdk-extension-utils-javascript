'use strict';

const _ = require('lodash');
const mongoose = require('mongoose');

const options = {
  appName: 'fdk-billing-javascript',
  readPreference: 'secondaryPreferred',
  serverSelectionTimeoutMS: 5000,
  connectTimeoutMS: 5000,
};

const dbConnection = createConnection("default", "mongodb://localhost:27017/test_fdk_billing");

/**
 * Connect to MongoDB
 * @param {string} name
 * @param {string} uri
 * @returns {mongoose.Connection}
 */
function createConnection(name, uri) {
  console.time('mongodb connection time');
  let db = mongoose.createConnection(uri, options);

  db.on('connected', function () {
    console.timeLog('mongodb connection time');
  });

  db.on('error', function (err) {
    console.error(err);
    setTimeout(function () {
      db.openUri(uri).catch(() => {});
    }, 5 * 1000);
  });

  return db;
}

async function clearData() {
    const collections = await dbConnection.db.listCollections().toArray();
    const promises = [];
    for (const collection of collections) {
        promises.push(dbConnection.db.collection(collection.name).deleteMany({}));
    }
    await Promise.all(promises);
}

module.exports = {
    dbConnection,
    clearData
};