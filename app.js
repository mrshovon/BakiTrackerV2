// Initialize PouchDB
const db = new PouchDB('baki_tracker');

// Supabase Configuration - DISABLED for local-only mode
// Server sync feature moved to server-sync.js for future upgrade
// const SUPABASE_URL = 'https://pkqejfscxowajrnfqwyo.supabase.co';
// const SUPABASE_KEY = 'sb_publishable_LoM4ZPvd8OxaycU4S7J6Tg_2USRI9yg';
// const SUPABASE_TABLE = 'baki_data';

// Global state
let currentUsername = null;
let currentShopId = null;
let transactionType = 'due'; // 'due' or 'paid'

// Check for username on load
$(document).ready(function() {
  const storedUsername = localStorage.getItem('baki_username');
  
  if (storedUsername) {
    currentUsername = storedUsername;
    $('#dashboard').removeClass('hidden');
    $('#welcomeMessage').text('Welcome, ' + currentUsername + '!');
    loadShops();
  } else {
    $('#onboarding').removeClass('hidden');
  }
  
  // Sync disabled - local-only mode
  // checkAndSync();
});

// Toast notification function
function showToast(message, type = 'success') {
  const bgColor = type === 'success' ? 'bg-emerald-600' : 'bg-rose-600';
  const icon = type === 'success' 
    ? '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>'
    : '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>';
  
  const $toast = $(`
    <div class="${bgColor} text-white px-4 py-3 rounded-xl shadow-lg flex items-center space-x-3 transform translate-x-full transition-transform duration-300">
      ${icon}
      <span>${message}</span>
    </div>
  `);
  
  $('#toastContainer').append($toast);
  
  // Animate in
  setTimeout(function() {
    $toast.removeClass('translate-x-full');
  }, 10);
  
  // Remove after 3 seconds
  setTimeout(function() {
    $toast.addClass('translate-x-full');
    setTimeout(function() {
      $toast.remove();
    }, 300);
  }, 3000);
}

// Onboarding form submission
$('#onboardingForm').on('submit', function(e) {
  e.preventDefault();
  const username = $('#username').val().trim();
  
  if (username) {
    localStorage.setItem('baki_username', username);
    currentUsername = username;
    $('#onboarding').addClass('hidden');
    $('#dashboard').removeClass('hidden');
    $('#welcomeMessage').text('Welcome, ' + currentUsername + '!');
    loadShops();
  }
});

// Logout
$('#logoutBtn').on('click', function() {
  localStorage.removeItem('baki_username');
  location.reload();
});

// Manual sync button - DISABLED for local-only mode
// $('#syncBtn').on('click', function() {
//   showToast('Syncing to cloud...', 'success');
//   syncToCloud();
// });

// Add Shop Modal
$('#addShopBtn').on('click', function() {
  $('#addShopModal').removeClass('hidden');
});

$('#closeShopModal, #cancelShopBtn').on('click', function() {
  $('#addShopModal').addClass('hidden');
  $('#shopNameInput').val('');
});

$('#addShopForm').on('submit', function(e) {
  e.preventDefault();
  const shopName = $('#shopNameInput').val().trim();
  
  if (shopName) {
    const shop = {
      _id: 'shop_' + Date.now(),
      entry_id: 'shop_' + Date.now(), // For Supabase UPSERT
      name: shopName,
      username: currentUsername,
      createdAt: new Date().toISOString(),
      isSynced: false,
      isDeleted: false
    };
    
    db.put(shop).then(function() {
      $('#addShopModal').addClass('hidden');
      $('#shopNameInput').val('');
      loadShops();
      showToast('Shop added successfully');
    }).catch(function(err) {
      console.error('Error adding shop:', err);
      showToast('Error adding shop', 'error');
    });
  }
});

// Load shops
function loadShops() {
  db.allDocs({
    include_docs: true,
    startkey: 'shop_',
    endkey: 'shop_\uffff'
  }).then(function(result) {
    const shops = result.rows.map(function(row) {
      return row.doc;
    }).filter(function(shop) {
      return shop.username === currentUsername && !shop.isDeleted;
    });
    
    renderShops(shops);
    calculateTotalOutstanding(shops);
  }).catch(function(err) {
    console.error('Error loading shops:', err);
  });
}

// Render shops
function renderShops(shops) {
  const $shopList = $('#shopList');
  $shopList.empty();
  
  if (shops.length === 0) {
    $('#emptyState').removeClass('hidden');
    return;
  }
  
  $('#emptyState').addClass('hidden');
  
  shops.forEach(function(shop) {
    getShopBalance(shop._id).then(function(balance) {
      const balanceClass = balance > 0 ? 'text-rose-600' : 'text-emerald-600';
      const balancePrefix = balance > 0 ? '-' : '';
      
      const $card = $('<div>').addClass('bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-shadow cursor-pointer');
      $card.html(`
        <div class="flex items-start justify-between mb-4">
          <div class="flex items-center space-x-3">
            <div class="bg-emerald-100 rounded-xl p-2">
              <svg class="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path>
              </svg>
            </div>
            <div>
              <h3 class="font-semibold text-slate-900">${shop.name}</h3>
              <p class="text-sm text-slate-500">View transactions</p>
            </div>
          </div>
          <div class="text-right">
            <p class="text-lg font-bold ${balanceClass}">${balancePrefix}${Math.abs(balance).toFixed(2)}</p>
          </div>
        </div>
        <div class="flex justify-end pt-3 border-t border-slate-100">
          <button class="delete-shop-btn text-sm text-rose-500 hover:text-rose-700 flex items-center space-x-1" data-id="${shop._id}">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
            </svg>
            <span>Delete</span>
          </button>
        </div>
      `);
      
      $card.on('click', function(e) {
        if (!$(e.target).closest('.delete-shop-btn').length) {
          currentShopId = shop._id;
          showShopDetail(shop);
        }
      });
      
      $shopList.append($card);
    });
  });
  
  // Delete shop handler
  $('.delete-shop-btn').on('click', function(e) {
    e.stopPropagation();
    const shopId = $(this).data('id');
    if (confirm('Are you sure you want to delete this shop? This will also mark all transactions for deletion.')) {
      softDeleteShop(shopId);
    }
  });
}

// Soft delete shop and its transactions
function softDeleteShop(shopId) {
  db.get(shopId).then(function(shop) {
    shop.isDeleted = true;
    shop.isSynced = false;
    return db.put(shop);
  }).then(function() {
    // Soft delete all transactions for this shop
    return db.allDocs({
      include_docs: true,
      startkey: 'txn_' + shopId,
      endkey: 'txn_' + shopId + '\uffff'
    });
  }).then(function(result) {
    const transactions = result.rows.map(function(row) {
      return row.doc;
    });
    
    const deletePromises = transactions.map(function(txn) {
      txn.isDeleted = true;
      txn.isSynced = false;
      return db.put(txn);
    });
    
    return Promise.all(deletePromises);
  }).then(function() {
    loadShops();
    showToast('Shop deleted successfully');
  }).catch(function(err) {
    console.error('Error deleting shop:', err);
    showToast('Error deleting shop', 'error');
  });
}

// Get shop balance
function getShopBalance(shopId) {
  return db.allDocs({
    include_docs: true,
    startkey: 'txn_' + shopId,
    endkey: 'txn_' + shopId + '\uffff'
  }).then(function(result) {
    const transactions = result.rows.map(function(row) {
      return row.doc;
    }).filter(function(txn) {
      return !txn.isDeleted;
    });
    
    return transactions.reduce(function(total, txn) {
      return txn.type === 'due' ? total + txn.amount : total - txn.amount;
    }, 0);
  });
}

// Calculate total outstanding
function calculateTotalOutstanding(shops) {
  let total = 0;
  let completed = 0;
  
  shops.forEach(function(shop) {
    getShopBalance(shop._id).then(function(balance) {
      total += balance;
      completed++;
      
      if (completed === shops.length) {
        const $totalOutstanding = $('#totalOutstanding');
        $totalOutstanding.text(total > 0 ? '-' + Math.abs(total).toFixed(2) : Math.abs(total).toFixed(2));
        $totalOutstanding.removeClass('text-rose-600 text-emerald-600');
        $totalOutstanding.addClass(total > 0 ? 'text-rose-600' : 'text-emerald-600');
        
        const $trendIcon = $('#trendIcon');
        $trendIcon.removeClass('text-rose-600 text-emerald-600');
        $trendIcon.addClass(total > 0 ? 'text-rose-600' : 'text-emerald-600');
      }
    });
  });
}

// Show shop detail
function showShopDetail(shop) {
  $('#dashboard').addClass('hidden');
  $('#shopDetail').removeClass('hidden');
  $('#shopName').text(shop.name);
  
  loadTransactions(shop._id);
}

// Back to dashboard
$('#backBtn').on('click', function() {
  $('#shopDetail').addClass('hidden');
  $('#dashboard').removeClass('hidden');
  currentShopId = null;
  loadShops();
});

// Load transactions
function loadTransactions(shopId) {
  db.allDocs({
    include_docs: true,
    startkey: 'txn_' + shopId,
    endkey: 'txn_' + shopId + '\uffff'
  }).then(function(result) {
    const transactions = result.rows.map(function(row) {
      return row.doc;
    }).filter(function(txn) {
      return !txn.isDeleted;
    }).sort(function(a, b) {
      return new Date(b.timestamp) - new Date(a.timestamp);
    });
    
    renderTransactions(transactions);
    $('#shopTransactionCount').text(transactions.length + ' transactions');
    
    getShopBalance(shopId).then(function(balance) {
      const $shopBalance = $('#shopBalance');
      $shopBalance.text(balance > 0 ? '-' + Math.abs(balance).toFixed(2) : Math.abs(balance).toFixed(2));
      $shopBalance.removeClass('text-rose-600 text-emerald-600');
      $shopBalance.addClass(balance > 0 ? 'text-rose-600' : 'text-emerald-600');
    });
  }).catch(function(err) {
    console.error('Error loading transactions:', err);
  });
}

// Render transactions
function renderTransactions(transactions) {
  const $transactionList = $('#transactionList');
  $transactionList.empty();
  
  if (transactions.length === 0) {
    $('#emptyTransactionState').removeClass('hidden');
    return;
  }
  
  $('#emptyTransactionState').addClass('hidden');
  
  transactions.forEach(function(txn) {
    const typeClass = txn.type === 'due' ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600';
    const amountClass = txn.type === 'due' ? 'text-rose-600' : 'text-emerald-600';
    const amountPrefix = txn.type === 'due' ? '-' : '+';
    
    const $item = $('<div>').addClass('bg-white rounded-xl shadow p-4 flex items-center justify-between');
    $item.html(`
      <div class="flex items-center space-x-4">
        <div class="${typeClass} rounded-full p-2">
          ${txn.type === 'due' 
            ? '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"></path></svg>'
            : '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>'
          }
        </div>
        <div>
          <p class="font-medium text-slate-900 capitalize">${txn.type}</p>
          <div class="flex items-center space-x-2 text-sm text-slate-500">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
            </svg>
            <span>${new Date(txn.timestamp).toLocaleDateString()}</span>
          </div>
          ${txn.note ? `<p class="text-sm text-slate-500 mt-1">${txn.note}</p>` : ''}
        </div>
      </div>
      <div class="flex items-center space-x-4">
        <p class="text-lg font-semibold ${amountClass}">${amountPrefix}${txn.amount.toFixed(2)}</p>
        <button class="delete-txn p-2 rounded-lg hover:bg-rose-100 transition-colors" data-id="${txn._id}">
          <svg class="w-4 h-4 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
          </svg>
        </button>
      </div>
    `);
    
    $transactionList.append($item);
  });
  
  // Delete transaction handler
  $('.delete-txn').on('click', function() {
    const txnId = $(this).data('id');
    if (confirm('Are you sure you want to delete this transaction?')) {
      db.get(txnId).then(function(doc) {
        return db.remove(doc);
      }).then(function() {
        loadTransactions(currentShopId);
      }).catch(function(err) {
        console.error('Error deleting transaction:', err);
      });
    }
  });
}

// Add Transaction Modal
$('#addTransactionBtn').on('click', function() {
  $('#addTransactionModal').removeClass('hidden');
  transactionType = 'due';
  updateTypeButtons();
});

$('#closeTransactionModal, #cancelTransactionBtn').on('click', function() {
  $('#addTransactionModal').addClass('hidden');
  $('#amount').val('');
  $('#note').val('');
});

$('#typeDue, #typePaid').on('click', function() {
  transactionType = $(this).attr('id') === 'typeDue' ? 'due' : 'paid';
  updateTypeButtons();
});

function updateTypeButtons() {
  $('#typeDue').removeClass('bg-rose-600 text-white bg-slate-100 text-slate-700 hover:bg-slate-200');
  $('#typePaid').removeClass('bg-emerald-600 text-white bg-slate-100 text-slate-700 hover:bg-slate-200');
  
  if (transactionType === 'due') {
    $('#typeDue').addClass('bg-rose-600 text-white');
    $('#typePaid').addClass('bg-slate-100 text-slate-700 hover:bg-slate-200');
  } else {
    $('#typePaid').addClass('bg-emerald-600 text-white');
    $('#typeDue').addClass('bg-slate-100 text-slate-700 hover:bg-slate-200');
  }
}

$('#addTransactionForm').on('submit', function(e) {
  e.preventDefault();
  const amount = parseFloat($('#amount').val());
  const note = $('#note').val().trim();
  
  if (amount > 0) {
    const transaction = {
      _id: 'txn_' + currentShopId + '_' + Date.now(),
      entry_id: 'txn_' + currentShopId + '_' + Date.now(), // For Supabase UPSERT
      shopId: currentShopId,
      shopName: $('#shopName').text(),
      amount: amount,
      type: transactionType,
      note: note || undefined,
      timestamp: new Date().toISOString(),
      isSynced: false,
      isDeleted: false
    };
    
    db.put(transaction).then(function() {
      $('#addTransactionModal').addClass('hidden');
      $('#amount').val('');
      $('#note').val('');
      loadTransactions(currentShopId);
      showToast('Transaction added successfully');
    }).catch(function(err) {
      console.error('Error adding transaction:', err);
      showToast('Error adding transaction', 'error');
    });
  }
});

// Sync functionality with Supabase - DISABLED for local-only mode
// Moved to server-sync.js for future upgrade
/*
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
    
    // Send to Supabase
    fetch(SUPABASE_URL + '/rest/v1/' + SUPABASE_TABLE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Prefer': 'resolution=ignore-duplicates'
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

// Request notification permission
if ('Notification' in window && Notification.permission === 'default') {
  Notification.requestPermission();
}

// Set up periodic sync check (every 5 minutes)
setInterval(checkAndSync, 5 * 60 * 1000);
*/
