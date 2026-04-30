// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyBfmw0hAPDcIwXuFEbg9JFCaq30wTk0PrE",
  authDomain: "bakitracker.firebaseapp.com",
  databaseURL: "https://bakitracker-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "bakitracker",
  storageBucket: "bakitracker.firebasestorage.app",
  messagingSenderId: "47772272556",
  appId: "1:47772272556:web:56d759e50cf998bd965c09"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// Password hashing function using Web Crypto API
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hash));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

// Sanitize username for Firebase paths (remove invalid characters: . # $ [ ])
function sanitizeUsername(username) {
  return username.replace(/[.#$\[\]]/g, '_');
}

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
    // Show login screen by default
    $('#login').removeClass('hidden');
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
$('#onboardingForm').on('submit', async function(e) {
  e.preventDefault();
  const username = $('#username').val().trim();
  const password = $('#password').val();
  
  if (username && password) {
    const sanitizedUsername = sanitizeUsername(username);
    // Check if username already exists in Firebase
    database.ref('usernames/' + sanitizedUsername).once('value').then(function(snapshot) {
      if (snapshot.exists()) {
        showToast('Username already taken. Please choose another.', 'error');
      } else {
        // Hash the password
        return hashPassword(password);
      }
    }).then(function(passwordHash) {
      if (!passwordHash) return;
      
      // Register the username with password hash
      const userData = {
        username: username, // Store original username for display
        passwordHash: passwordHash,
        createdAt: new Date().toISOString()
      };
      
      return database.ref('usernames/' + sanitizedUsername).set(userData);
    }).then(function() {
      localStorage.setItem('baki_username', username);
      currentUsername = username;
      $('#onboarding').addClass('hidden');
      $('#dashboard').removeClass('hidden');
      $('#welcomeMessage').text('Welcome, ' + currentUsername + '!');
      loadShops();
    }).catch(function(err) {
      console.error('Error registering username:', err);
      showToast('Error registering username', 'error');
    });
  }
});

// Logout
$('#logoutBtn').on('click', function() {
  localStorage.removeItem('baki_username');
  location.reload();
});

// Login form submission
$('#loginForm').on('submit', async function(e) {
  e.preventDefault();
  const username = $('#loginUsername').val().trim();
  const password = $('#loginPassword').val();
  
  if (username && password) {
    const sanitizedUsername = sanitizeUsername(username);
    // Check if username exists
    database.ref('usernames/' + sanitizedUsername).once('value').then(function(snapshot) {
      if (!snapshot.exists()) {
        showToast('Username not found. Please create an account.', 'error');
        return null;
      }
      
      const userData = snapshot.val();
      // Hash the entered password
      return hashPassword(password).then(function(passwordHash) {
        if (passwordHash === userData.passwordHash) {
          // Password matches
          localStorage.setItem('baki_username', username);
          currentUsername = username;
          $('#login').addClass('hidden');
          $('#dashboard').removeClass('hidden');
          $('#welcomeMessage').text('Welcome, ' + currentUsername + '!');
          loadShops();
          showToast('Login successful');
        } else {
          showToast('Incorrect password', 'error');
        }
      });
    }).catch(function(err) {
      console.error('Error during login:', err);
      showToast('Login failed', 'error');
    });
  }
});

// Toggle between login and register forms
$('#showLoginBtn').on('click', function(e) {
  e.preventDefault();
  $('#onboarding').addClass('hidden');
  $('#login').removeClass('hidden');
});

$('#showRegisterBtn').on('click', function(e) {
  e.preventDefault();
  $('#login').addClass('hidden');
  $('#onboarding').removeClass('hidden');
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

// Change Password Modal
$('#changePasswordBtn').on('click', function() {
  $('#changePasswordModal').removeClass('hidden');
});

$('#closeChangePasswordModal, #cancelChangePasswordBtn').on('click', function() {
  $('#changePasswordModal').addClass('hidden');
  $('#currentPassword').val('');
  $('#newPassword').val('');
  $('#confirmPassword').val('');
});

// Change Password form submission
$('#changePasswordForm').on('submit', async function(e) {
  e.preventDefault();
  const currentPassword = $('#currentPassword').val();
  const newPassword = $('#newPassword').val();
  const confirmPassword = $('#confirmPassword').val();
  
  if (newPassword !== confirmPassword) {
    showToast('New passwords do not match', 'error');
    return;
  }
  
  if (newPassword === currentPassword) {
    showToast('New password must be different from current password', 'error');
    return;
  }
  
  // Verify current password
  const sanitizedUsername = sanitizeUsername(currentUsername);
  database.ref('usernames/' + sanitizedUsername).once('value').then(function(snapshot) {
    if (!snapshot.exists()) {
      showToast('User not found', 'error');
      return null;
    }
    
    const userData = snapshot.val();
    return hashPassword(currentPassword).then(function(currentPasswordHash) {
      if (currentPasswordHash !== userData.passwordHash) {
        showToast('Current password is incorrect', 'error');
        return null;
      }
      
      // Hash new password and update
      return hashPassword(newPassword);
    });
  }).then(function(newPasswordHash) {
    if (!newPasswordHash) return;
    
    return database.ref('usernames/' + sanitizedUsername + '/passwordHash').set(newPasswordHash);
  }).then(function() {
    $('#changePasswordModal').addClass('hidden');
    $('#currentPassword').val('');
    $('#newPassword').val('');
    $('#confirmPassword').val('');
    showToast('Password changed successfully');
  }).catch(function(err) {
    console.error('Error changing password:', err);
    showToast('Error changing password', 'error');
  });
});

$('#closeShopModal, #cancelShopBtn').on('click', function() {
  $('#addShopModal').addClass('hidden');
  $('#shopNameInput').val('');
});

$('#addShopForm').on('submit', function(e) {
  e.preventDefault();
  const shopName = $('#shopNameInput').val().trim();
  
  if (shopName) {
    const shopId = 'shop_' + Date.now();
    const shop = {
      name: shopName,
      username: currentUsername,
      createdAt: new Date().toISOString(),
      isDeleted: false
    };
    
    database.ref('users/' + currentUsername + '/shops/' + shopId).set(shop).then(function() {
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
  database.ref('users/' + currentUsername + '/shops').once('value').then(function(snapshot) {
    const shops = [];
    snapshot.forEach(function(childSnapshot) {
      const shop = childSnapshot.val();
      shop._id = childSnapshot.key;
      if (!shop.isDeleted) {
        shops.push(shop);
      }
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
  database.ref('users/' + currentUsername + '/shops/' + shopId + '/isDeleted').set(true).then(function() {
    // Soft delete all transactions for this shop
    return database.ref('users/' + currentUsername + '/transactions').once('value');
  }).then(function(snapshot) {
    const deletePromises = [];
    snapshot.forEach(function(childSnapshot) {
      const txn = childSnapshot.val();
      if (txn.shopId === shopId) {
        deletePromises.push(
          database.ref('users/' + currentUsername + '/transactions/' + childSnapshot.key + '/isDeleted').set(true)
        );
      }
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
  return database.ref('users/' + currentUsername + '/transactions').once('value').then(function(snapshot) {
    let balance = 0;
    snapshot.forEach(function(childSnapshot) {
      const txn = childSnapshot.val();
      if (txn.shopId === shopId && !txn.isDeleted) {
        balance = txn.type === 'due' ? balance + txn.amount : balance - txn.amount;
      }
    });
    return balance;
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
  database.ref('users/' + currentUsername + '/transactions').once('value').then(function(snapshot) {
    const transactions = [];
    snapshot.forEach(function(childSnapshot) {
      const txn = childSnapshot.val();
      txn._id = childSnapshot.key;
      if (txn.shopId === shopId && !txn.isDeleted) {
        transactions.push(txn);
      }
    });
    
    transactions.sort(function(a, b) {
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
      database.ref('users/' + currentUsername + '/transactions/' + txnId + '/isDeleted').set(true).then(function() {
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
    const txnId = 'txn_' + currentShopId + '_' + Date.now();
    const transaction = {
      shopId: currentShopId,
      shopName: $('#shopName').text(),
      amount: amount,
      type: transactionType,
      timestamp: new Date().toISOString(),
      isDeleted: false
    };
    
    if (note) {
      transaction.note = note;
    }
    
    database.ref('users/' + currentUsername + '/transactions/' + txnId).set(transaction).then(function() {
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

// Test notification function - sends notification every 2 minutes
// Comment out this block to disable test notifications
// function sendTestNotification() {
//   if ('Notification' in window) {
//     if (Notification.permission === 'granted') {
//       new Notification('Baki Tracker Test', {
//         body: 'Test notification - PWA is working!',
//         icon: 'icon-192x192.svg',
//         badge: 'icon-192x192.svg'
//       });
//       console.log('Test notification sent at:', new Date().toLocaleTimeString());
//     } else if (Notification.permission !== 'denied') {
//       Notification.requestPermission().then(function(permission) {
//         if (permission === 'granted') {
//           sendTestNotification();
//         }
//       });
//     }
//   }
// }

// Send test notification every 2 minutes (120000 ms)
// Comment out the line below to stop test notifications
// setInterval(sendTestNotification, 2 * 60 * 1000);

// Send one immediately on load
// sendTestNotification();

