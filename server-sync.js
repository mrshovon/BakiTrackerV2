// Server Sync Module - Future Upgrade Feature
// This file contains the Supabase sync functionality
// To enable: Uncomment the code in app.js and add this script to index.html

// Supabase Configuration
const SUPABASE_URL = 'https://pkqejfscxowajrnfqwyo.supabase.co';
const SUPABASE_KEY = 'sb_publishable_LoM4ZPvd8OxaycU4S7J6Tg_2USRI9yg';
const SUPABASE_TABLE = 'baki_data';

// Check if sync is needed based on last sync time
function checkAndSync() {
  const lastSync = localStorage.getItem('lastSyncTimestamp');
  
  if (lastSync) {
    const lastSyncDate = new Date(lastSync);
    const now = new Date();
    const nextMidnight = new Date(lastSyncDate);
    nextMidnight.setDate(nextMidnight.getDate() + 1);
    nextMidnight.setHours(0, 0, 0, 0);
    
    if (now >= nextMidnight) {
      syncToCloud();
    }
  } else {
    syncToCloud();
  }
}

// Sync unsynced documents to Supabase
function syncToCloud() {
  db.allDocs({
    include_docs: true
  }).then(function(result) {
    const unsyncedDocs = result.rows
      .map(function(row) {
        return row.doc;
      })
      .filter(function(doc) {
        return doc.isSynced === false;
      });
    
    if (unsyncedDocs.length === 0) {
      console.log('No unsynced data to push');
      return;
    }
    
    // Prepare payload for Supabase UPSERT
    const payload = {
      username: currentUsername,
      records: unsyncedDocs.map(function(doc) {
        return {
          entry_id: doc.entry_id || doc._id,
          _id: doc._id,
          name: doc.name,
          shopId: doc.shopId,
          shopName: doc.shopName,
          amount: doc.amount,
          type: doc.type,
          note: doc.note,
          timestamp: doc.timestamp,
          username: doc.username,
          createdAt: doc.createdAt,
          isDeleted: doc.isDeleted
        };
      })
    };
    
    // Send to Supabase with UPSERT logic
    fetch(SUPABASE_URL + '/rest/v1/' + SUPABASE_TABLE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Prefer': 'resolution=ignore-duplicates' // UPSERT: update if exists, insert if new
      },
      body: JSON.stringify(payload.records)
    }).then(function(response) {
      if (!response.ok) {
        throw new Error('Sync failed');
      }
      return response.json();
    }).then(function(data) {
      console.log('Sync successful:', data);
      
      // Mark all as synced
      const syncPromises = unsyncedDocs.map(function(doc) {
        doc.isSynced = true;
        return db.put(doc);
      });
      
      return Promise.all(syncPromises);
    }).then(function() {
      // Update last sync timestamp
      localStorage.setItem('lastSyncTimestamp', new Date().toISOString());
      
      // Purge deleted docs from PouchDB after successful sync
      const deletedDocs = unsyncedDocs.filter(function(doc) {
        return doc.isDeleted === true;
      });
      
      if (deletedDocs.length > 0) {
        const purgePromises = deletedDocs.map(function(doc) {
          return db.remove(doc);
        });
        return Promise.all(purgePromises);
      }
    }).then(function() {
      showToast('Data synced successfully');
      if (deletedDocs && deletedDocs.length > 0) {
        console.log('Purged ' + deletedDocs.length + ' deleted documents');
      }
    }).catch(function(err) {
      console.error('Error syncing data:', err);
      showToast('Sync failed. Will retry later.', 'error');
    });
  }).catch(function(err) {
    console.error('Error loading unsynced docs:', err);
  });
}

// Request notification permission for sync alerts
if ('Notification' in window && Notification.permission === 'default') {
  Notification.requestPermission();
}

// Set up periodic sync check (every 5 minutes)
setInterval(checkAndSync, 5 * 60 * 1000);
