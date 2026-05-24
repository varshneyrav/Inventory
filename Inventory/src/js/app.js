// js/app.js - Premium KhataBook Inventory Engine
// Handles state management, UI renders, Chart.js graphs, import/export, and page controllers.

// -------------------------------------------------------------
// 1. CONSTANTS & CONFIG
// -------------------------------------------------------------
const STORAGE_KEYS = {
  PRODUCTS: "khata_products",
  SALES: "khata_sales",
  ACTIVITIES: "khata_activities",
  THEME: "khata_theme"
};
const LOW_STOCK_THRESHOLD = 5;

// -------------------------------------------------------------
// 2. STATE STORAGE
// -------------------------------------------------------------
let state = {
  products: [],
  sales: [],
  activities: [],
  currentTab: "dashboard",
  theme: "light"
};

// Load initial state
function loadState() {
  state.products = JSON.parse(localStorage.getItem(STORAGE_KEYS.PRODUCTS)) || [];
  state.sales = JSON.parse(localStorage.getItem(STORAGE_KEYS.SALES)) || [];
  state.activities = JSON.parse(localStorage.getItem(STORAGE_KEYS.ACTIVITIES)) || [];
  state.theme = localStorage.getItem(STORAGE_KEYS.THEME) || "light";
}

// Persist state
function saveState(key) {
  localStorage.setItem(key, JSON.stringify(state[key.split("khata_")[1]]));
}

// -------------------------------------------------------------
// 3. TOAST SYSTEM
// -------------------------------------------------------------
function showToast(message, type = "success") {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = `toast ${type === "error" ? "error" : ""}`;
  toast.innerHTML = `
    <i data-lucide="${type === "error" ? "alert-circle" : "check-circle"}"></i>
    <span>${message}</span>
  `;
  container.appendChild(toast);
  lucide.createIcons();

  // Slide out after 3 seconds
  setTimeout(() => {
    toast.style.animation = "slideInRight 0.3s reverse forwards";
    toast.addEventListener("animationend", () => toast.remove());
  }, 3000);
}

// -------------------------------------------------------------
// 4. ACTIVITY LOGGER
// -------------------------------------------------------------
function logActivity(type, message) {
  const activity = {
    id: "_" + Math.random().toString(36).substr(2, 9),
    type, // 'add', 'sale', 'edit', 'delete', 'system'
    message,
    timestamp: new Date().toISOString()
  };
  state.activities.push(activity);
  
  // Keep only last 50 activities
  if (state.activities.length > 50) {
    state.activities.shift();
  }
  
  saveState(STORAGE_KEYS.ACTIVITIES);
  renderActivities();
}

// -------------------------------------------------------------
// 5. CHART ENGINE
// -------------------------------------------------------------
let stockChart = null;

function renderChart() {
  const canvas = document.getElementById("stock-chart");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  
  // Destroy existing chart to avoid overlay glitching
  if (stockChart) {
    stockChart.destroy();
  }

  // Get active products (at least received > 0)
  const activeProducts = state.products.slice(0, 10); // Limit to top 10 products for clarity
  const labels = activeProducts.map(p => p.name);
  const remainingData = activeProducts.map(p => Math.max(0, p.received - p.sold));
  const soldData = activeProducts.map(p => p.sold);

  const isDark = document.documentElement.classList.contains("dark");
  const gridColor = isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(148, 163, 184, 0.12)";
  const textColor = isDark ? "#9ca3af" : "#64748b";

  stockChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Remaining Stock",
          data: remainingData,
          backgroundColor: isDark ? "#00b67a" : "rgba(0, 182, 122, 0.8)",
          borderRadius: 8,
          borderSkipped: false
        },
        {
          label: "Products Sold",
          data: soldData,
          backgroundColor: isDark ? "#ef4444" : "rgba(239, 68, 68, 0.8)",
          borderRadius: 8,
          borderSkipped: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            color: textColor,
            font: { family: "Inter", weight: "600" }
          }
        }
      },
      scales: {
        x: {
          stacked: true,
          grid: { display: false },
          ticks: { color: textColor, font: { family: "Inter" } }
        },
        y: {
          stacked: true,
          grid: { color: gridColor },
          ticks: { color: textColor, font: { family: "Inter" } }
        }
      }
    }
  });
}

// -------------------------------------------------------------
// 6. UI RENDER ENGINE
// -------------------------------------------------------------

// Switch between navigation tabs
function switchTab(tabId) {
  state.currentTab = tabId;
  
  // Update sidebar active classes
  document.querySelectorAll(".nav-item").forEach(item => {
    item.classList.toggle("active", item.dataset.tab === tabId);
  });
  
  // Update mobile bottom nav active classes
  document.querySelectorAll(".mobile-nav-item").forEach(item => {
    item.classList.toggle("active", item.dataset.tab === tabId);
  });

  // Toggle Tab Panels
  document.querySelectorAll(".tab-panel").forEach(panel => {
    panel.classList.toggle("active", panel.id === `${tabId}-view`);
  });

  // Adjust header title & display details
  const viewTitle = document.getElementById("view-title");
  const viewSubtitle = document.getElementById("view-subtitle");
  
  if (tabId === "dashboard") {
    viewTitle.textContent = "Business Overview";
    viewSubtitle.textContent = "Electronic shop assistant & analytics";
    renderChart(); // redraw chart with updated metrics
  } else if (tabId === "inventory") {
    viewTitle.textContent = "Stock Registry";
    viewSubtitle.textContent = "Manage product inventory & factories";
    renderInventoryTable();
    populateCategoryFilter();
  } else if (tabId === "sales") {
    viewTitle.textContent = "Sales History";
    viewSubtitle.textContent = "Keep track of outbound products sold";
    renderSalesHistory();
  }

  // Hide Add Stock button on Sales tab (prevent inappropriate stock addition)
  const addStockBtn = document.getElementById("btn-add-stock-top");
  if (addStockBtn) {
    addStockBtn.style.display = tabId === "sales" ? "none" : "inline-flex";
  }

  // Refresh icons
  lucide.createIcons();
}

// Dashboard statistics
function renderDashboardMetrics() {
  const totalProducts = state.products.length;
  const totalReceived = state.products.reduce((acc, p) => acc + p.received, 0);
  const totalSold = state.products.reduce((acc, p) => acc + p.sold, 0);
  const lowStockCount = state.products.filter(p => (p.received - p.sold) <= LOW_STOCK_THRESHOLD).length;

  document.getElementById("val-total-products").textContent = totalProducts;
  document.getElementById("val-total-received").textContent = totalReceived;
  document.getElementById("val-total-sold").textContent = totalSold;
  
  const lowStockValEl = document.getElementById("val-low-stock");
  lowStockValEl.textContent = lowStockCount;
  
  const lowStockLblEl = document.getElementById("lbl-low-stock");
  if (lowStockCount > 0) {
    lowStockValEl.parentElement.classList.add("danger");
    lowStockValEl.parentElement.classList.remove("warning");
    lowStockLblEl.textContent = `${lowStockCount} items require refill`;
    lowStockLblEl.className = "card-trend text-danger";
  } else {
    lowStockValEl.parentElement.classList.remove("danger");
    lowStockValEl.parentElement.classList.add("warning");
    lowStockLblEl.textContent = "All stock optimal";
    lowStockLblEl.className = "card-trend text-success";
  }
}

// Format date utility
function formatActivityTime(isoString) {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  return date.toLocaleDateString();
}

// Render dynamic activities
function renderActivities() {
  const container = document.getElementById("activity-list-container");
  if (!container) return;

  container.innerHTML = "";
  
  if (state.activities.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; color: var(--text-secondary); padding: 32px 0;">
        <p style="font-size: 13px;">No recent activity logged.</p>
      </div>
    `;
    return;
  }

  // Render last 8 activities reversed (newest first)
  const list = [...state.activities].reverse().slice(0, 8);
  list.forEach(act => {
    const div = document.createElement("div");
    div.className = "activity-item";
    
    let badgeClass = "system";
    if (act.type === "add") badgeClass = "add";
    if (act.type === "sale") badgeClass = "sale";

    div.innerHTML = `
      <span class="activity-badge ${badgeClass}"></span>
      <div class="activity-content">
        <p class="activity-text">${act.message}</p>
        <p class="activity-time">${formatActivityTime(act.timestamp)}</p>
      </div>
    `;
    container.appendChild(div);
  });
}

// Populate Category Filter dropdown
function populateCategoryFilter() {
  const select = document.getElementById("category-filter");
  if (!select) return;

  const currentSelection = select.value;
  const categories = [...new Set(state.products.map(p => p.category))].filter(Boolean);
  
  select.innerHTML = '<option value="">All Categories</option>';
  categories.forEach(cat => {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = cat;
    if (cat === currentSelection) opt.selected = true;
    select.appendChild(opt);
  });
}

// Render Main Inventory table
function renderInventoryTable() {
  const tbody = document.getElementById("inventory-table-body");
  const emptyState = document.getElementById("inventory-empty-state");
  const table = document.getElementById("inventory-main-table");
  
  if (!tbody) return;

  const searchVal = document.getElementById("inventory-search").value.toLowerCase();
  const categoryFilterVal = document.getElementById("category-filter").value;
  const lowStockToggleEl = document.getElementById("low-stock-toggle");
  const lowStockOnlyVal = lowStockToggleEl ? lowStockToggleEl.checked : false;

  // Filter products based on search indices
  const filteredProducts = state.products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchVal) || 
                          p.category.toLowerCase().includes(searchVal) || 
                          p.supplier.toLowerCase().includes(searchVal);
    
    const matchesCategory = !categoryFilterVal || p.category === categoryFilterVal;
    
    const remaining = p.received - p.sold;
    const matchesLowStock = !lowStockOnlyVal || remaining <= LOW_STOCK_THRESHOLD;

    return matchesSearch && matchesCategory && matchesLowStock;
  });

  tbody.innerHTML = "";

  if (filteredProducts.length === 0) {
    table.style.display = "none";
    emptyState.classList.remove("hidden");
    return;
  }

  table.style.display = "table";
  emptyState.classList.add("hidden");

  filteredProducts.forEach(p => {
    const remaining = p.received - p.sold;
    let badgeClass = "badge-success";
    let statusText = "In Stock";
    
    if (remaining === 0) {
      badgeClass = "badge-danger";
      statusText = "Out of Stock";
    } else if (remaining <= LOW_STOCK_THRESHOLD) {
      badgeClass = "badge-warning";
      statusText = "Low Stock";
    }

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td style="font-weight:600;">${p.name}</td>
      <td>${p.category}</td>
      <td>${p.received}</td>
      <td>${p.sold}</td>
      <td style="font-weight:700; color: var(--primary);">${remaining}</td>
      <td>${p.supplier}</td>
      <td>
        <span class="badge ${badgeClass}">
          <span class="badge-dot"></span>
          ${statusText}
        </span>
      </td>
      <td>
        <div class="action-cell">
          <button class="btn btn-secondary btn-sm" onclick="editProduct('${p.id}')" title="Edit Product">
            <i data-lucide="edit-3" style="width:14px;height:14px;"></i>
          </button>
          <button class="btn btn-danger-outline btn-sm" onclick="deleteProduct('${p.id}')" title="Delete Product">
            <i data-lucide="trash-2" style="width:14px;height:14px;"></i>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  lucide.createIcons();
}

// Render Sales Outbound Registry
function renderSalesHistory() {
  const tbody = document.getElementById("sales-table-body");
  const emptyState = document.getElementById("sales-empty-state");
  const tableWrapper = tbody?.closest(".table-wrapper");

  if (!tbody) return;

  tbody.innerHTML = "";

  if (state.sales.length === 0) {
    if (tableWrapper) tableWrapper.style.display = "none";
    emptyState.classList.remove("hidden");
    return;
  }

  if (tableWrapper) tableWrapper.style.display = "block";
  emptyState.classList.add("hidden");

  // Sort sales newest first
  const sortedSales = [...state.sales].reverse();

  sortedSales.forEach(sale => {
    const formattedDate = new Date(sale.timestamp).toLocaleDateString("en-IN", {
      day: "2-digit", month: "short", year: "numeric"
    });
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${formattedDate}</td>
      <td style="font-weight:600;">${sale.productName}</td>
      <td>${sale.quantity}</td>
      <td>₹${(sale.price || 0).toFixed(2)}</td>
      <td class="text-success" style="font-weight:700;">₹${(sale.totalAmount || 0).toFixed(2)}</td>
      <td>${sale.customer || '<span style="opacity:0.4;">—</span>'}</td>
      <td>
        <button class="btn btn-danger-outline btn-sm" onclick="refundSale('${sale.id}')" title="Refund/Delete Sale">
          <i data-lucide="rotate-ccw" style="width:14px;height:14px;"></i> Refund
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  lucide.createIcons();
}

// Populate product selection dropdown in Record Sale Modal
function populateProductSelect() {
  const select = document.getElementById("sale-product-select");
  if (!select) return;

  select.innerHTML = '<option value="" disabled selected>Choose product...</option>';
  
  state.products.forEach(p => {
    const remaining = p.received - p.sold;
    if (remaining > 0) {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = `${p.name} (${remaining} remaining)`;
      select.appendChild(opt);
    }
  });
}

// Global UI refresh hook
function refreshUI() {
  renderDashboardMetrics();
  renderActivities();
  populateProductSelect();
  
  if (state.currentTab === "dashboard") {
    renderChart();
  } else if (state.currentTab === "inventory") {
    renderInventoryTable();
    populateCategoryFilter();
  } else if (state.currentTab === "sales") {
    renderSalesHistory();
  }
}

// -------------------------------------------------------------
// 7. MODALS MANAGER
// -------------------------------------------------------------
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  const overlay = document.getElementById("modal-overlay");
  if (modal && overlay) {
    modal.classList.add("active");
    overlay.classList.add("active");
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  const overlay = document.getElementById("modal-overlay");
  if (modal && overlay) {
    modal.classList.remove("active");
    overlay.classList.remove("active");
  }
}

function closeAllModals() {
  document.querySelectorAll(".modal").forEach(m => m.classList.remove("active"));
  document.getElementById("modal-overlay").classList.remove("active");
}

// -------------------------------------------------------------
// 8. DATA OPERATIONS
// -------------------------------------------------------------

// Add or Edit Inbound Product Stock
function handleSaveStock(e) {
  e.preventDefault();
  const form = document.getElementById("form-add-stock");
  const formData = new FormData(form);
  
  const name = formData.get("name").trim();
  const category = formData.get("category").trim();
  const quantity = parseInt(formData.get("quantity"), 10);
  const supplier = formData.get("supplier").trim();
  const dateVal = formData.get("date");
  const notes = formData.get("notes").trim();
  const editId = document.getElementById("edit-product-id").value;

  if (!name || !category || isNaN(quantity) || quantity <= 0 || !supplier || !dateVal) {
    showToast("Please fill all required fields correctly.", "error");
    return;
  }

  if (editId) {
    // Edit existing product
    const prodIndex = state.products.findIndex(p => p.id === editId);
    if (prodIndex > -1) {
      const oldProd = state.products[prodIndex];
      
      // Safety check: Cannot set total received less than sold
      if (quantity < oldProd.sold) {
        showToast(`Quantity cannot be less than sold count (${oldProd.sold}).`, "error");
        return;
      }

      state.products[prodIndex] = {
        ...oldProd,
        name,
        category,
        received: quantity,
        supplier,
        purchaseDate: dateVal,
        notes
      };

      logActivity("edit", `Modified product details for: ${name}`);
      showToast("Product updated successfully!");
    }
  } else {
    // Add new product
    const newProduct = {
      id: "prod_" + Math.random().toString(36).substr(2, 9),
      name,
      category,
      received: quantity,
      sold: 0,
      supplier,
      purchaseDate: dateVal,
      notes,
      createdAt: new Date().toISOString()
    };
    state.products.push(newProduct);
    logActivity("add", `Registered ${quantity} of new product: ${name}`);
    showToast("Incoming stock logged!");
  }

  saveState(STORAGE_KEYS.PRODUCTS);
  closeModal("modal-add-stock");
  form.reset();
  document.getElementById("edit-product-id").value = "";
  
  refreshUI();
}

// Open modal in edit mode
window.editProduct = function(id) {
  const prod = state.products.find(p => p.id === id);
  if (!prod) return;

  document.getElementById("stock-modal-title").textContent = "Edit Product Details";
  document.getElementById("btn-save-stock").textContent = "Update Details";
  document.getElementById("edit-product-id").value = prod.id;

  const form = document.getElementById("form-add-stock");
  form.name.value = prod.name;
  form.category.value = prod.category;
  form.quantity.value = prod.received;
  form.supplier.value = prod.supplier;
  form.date.value = prod.purchaseDate;
  form.notes.value = prod.notes || "";

  openModal("modal-add-stock");
};

// Delete Product
window.deleteProduct = function(id) {
  const prod = state.products.find(p => p.id === id);
  if (!prod) return;

  if (confirm(`Are you sure you want to delete ${prod.name}? All history for this product will be lost.`)) {
    // Remove product
    state.products = state.products.filter(p => p.id !== id);
    saveState(STORAGE_KEYS.PRODUCTS);
    
    // Clean up related sales
    state.sales = state.sales.filter(s => s.productId !== id);
    saveState(STORAGE_KEYS.SALES);

    logActivity("delete", `Removed product: ${prod.name}`);
    showToast("Product deleted successfully.");
    refreshUI();
  }
};

// Record Outbound Sale
function handleRecordSale(e) {
  console.log('handleRecordSale triggered');
  e.preventDefault();
  const form = document.getElementById("form-record-sale");
  const formData = new FormData(form);
  
  const productId = formData.get("productId");
  const quantity = parseInt(formData.get("quantity"), 10);
  const price = parseFloat(formData.get("price"));
  const customer = (formData.get("customer") || "").trim();
  const saleDate = formData.get("saleDate");
  const saleNotes = (formData.get("saleNotes") || "").trim();

  if (!productId || isNaN(quantity) || quantity <= 0) {
    showToast("Please select a product and enter quantity.", "error");
    return;
  }

  if (isNaN(price) || price < 0) {
    showToast("Please enter a valid selling price.", "error");
    return;
  }

  const prod = state.products.find(p => p.id === productId);
  if (!prod) {
    showToast("Product not found.", "error");
    return;
  }

  const remaining = prod.received - prod.sold;
  if (quantity > remaining) {
    showToast(`Insufficient stock! Only ${remaining} items remaining.`, "error");
    return;
  }

  // Deduct stock (increase sold count)
  prod.sold += quantity;
  saveState(STORAGE_KEYS.PRODUCTS);

  const totalAmount = quantity * price;

  // Log sale registry
  const sale = {
    id: "sale_" + Math.random().toString(36).substr(2, 9),
    productId,
    productName: prod.name,
    category: prod.category,
    quantity,
    price,
    totalAmount,
    customer,
    notes: saleNotes,
    timestamp: saleDate ? new Date(saleDate + "T12:00:00").toISOString() : new Date().toISOString()
  };
  state.sales.push(sale);
  saveState(STORAGE_KEYS.SALES);

  logActivity("sale", `Sold ${quantity} unit(s) of: ${prod.name} — ₹${totalAmount.toFixed(2)}`);
  showToast(`Sale recorded! ₹${totalAmount.toFixed(2)} for ${quantity}x ${prod.name}`);

  closeModal("modal-record-sale");
  form.reset();
  refreshUI();
}

// Refund / Delete Sale registry entry
window.refundSale = function(saleId) {
  const saleIndex = state.sales.findIndex(s => s.id === saleId);
  if (saleIndex === -1) return;

  const sale = state.sales[saleIndex];
  if (confirm(`Refund sale of ${sale.quantity} ${sale.productName}? This will return stock to inventory.`)) {
    // Return stock to product if product still exists
    const prod = state.products.find(p => p.id === sale.productId);
    if (prod) {
      prod.sold = Math.max(0, prod.sold - sale.quantity);
      saveState(STORAGE_KEYS.PRODUCTS);
    }

    // Delete sale
    state.sales.splice(saleIndex, 1);
    saveState(STORAGE_KEYS.SALES);

    logActivity("system", `Refunded ${sale.quantity} units of: ${sale.productName}`);
    showToast("Sale refunded successfully.");
    refreshUI();
  }
};

// -------------------------------------------------------------
// 9. EXPORT & IMPORT MODULE
// -------------------------------------------------------------

// Trigger user prompt download of data
function triggerExport(format) {
  const dataExport = {
    products: state.products,
    sales: state.sales,
    activities: state.activities
  };

  if (format === "json") {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(dataExport, null, 2));
    const dlAnchorElem = document.createElement("a");
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `khata_backup_${new Date().toISOString().split('T')[0]}.json`);
    dlAnchorElem.click();
    logActivity("system", "Exported database backup as JSON");
    showToast("JSON Backup downloaded!");
  } else if (format === "csv") {
    // Generate CSV for Products
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Type,ID,Name,Category,Received/Quantity,Sold,Supplier/Notes,Date\n";
    
    // Add Products
    state.products.forEach(p => {
      csvContent += `Product,${p.id},"${p.name.replace(/"/g, '""')}","${p.category.replace(/"/g, '""')}",${p.received},${p.sold},"${p.supplier.replace(/"/g, '""')} - ${p.notes?.replace(/"/g, '""') || ''}",${p.purchaseDate}\n`;
    });
    
    // Add Sales
    state.sales.forEach(s => {
      csvContent += `Sale,${s.id},"${s.productName.replace(/"/g, '""')}","${s.category.replace(/"/g, '""')}",${s.quantity},,Outbound,${s.timestamp.split('T')[0]}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const dlAnchorElem = document.createElement("a");
    dlAnchorElem.setAttribute("href", encodedUri);
    dlAnchorElem.setAttribute("download", `khata_backup_${new Date().toISOString().split('T')[0]}.csv`);
    dlAnchorElem.click();
    logActivity("system", "Exported database backup as CSV");
    showToast("CSV Backup downloaded!");
  }
}

// Process imported backup file
function triggerImport(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(evt) {
    try {
      const data = JSON.parse(evt.target.result);
      if (data && Array.isArray(data.products)) {
        state.products = data.products;
        state.sales = data.sales || [];
        state.activities = data.activities || [];
        
        saveState(STORAGE_KEYS.PRODUCTS);
        saveState(STORAGE_KEYS.SALES);
        saveState(STORAGE_KEYS.ACTIVITIES);
        
        logActivity("system", "Imported inventory database backup from file");
        showToast("Database restored successfully!");
        refreshUI();
      } else {
        showToast("Invalid backup file structure.", "error");
      }
    } catch (err) {
      showToast("Failed to parse file. Ensure it is a valid JSON backup.", "error");
    }
  };
  reader.readAsText(file);
  e.target.value = ""; // Reset input
}

// -------------------------------------------------------------
// 10. THEME CONTROLLER
// -------------------------------------------------------------
function toggleTheme() {
  const isDark = document.documentElement.classList.toggle("dark");
  state.theme = isDark ? "dark" : "light";
  localStorage.setItem(STORAGE_KEYS.THEME, state.theme);
  
  // Update icons on toggle buttons
  const desktopBtn = document.getElementById("theme-toggle-desktop");
  const mobileBtn = document.getElementById("theme-toggle-mobile");
  
  const iconMarkup = isDark ? '<i data-lucide="sun"></i>' : '<i data-lucide="moon"></i>';
  
  if (desktopBtn) {
    desktopBtn.innerHTML = `${iconMarkup} <span>Theme Mode</span>`;
  }
  if (mobileBtn) {
    mobileBtn.innerHTML = `${iconMarkup} <span>Theme</span>`;
  }

  // Redraw charts with dark styling adjustments
  if (state.currentTab === "dashboard") {
    renderChart();
  }

  lucide.createIcons();
}

function initTheme() {
  if (state.theme === "dark" || (state.theme === "light" && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
    // Synchronize to stored settings
    if (state.theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }
  
  // Set correct initial button layouts
  const isDark = document.documentElement.classList.contains("dark");
  const desktopBtn = document.getElementById("theme-toggle-desktop");
  const mobileBtn = document.getElementById("theme-toggle-mobile");
  const iconMarkup = isDark ? '<i data-lucide="sun"></i>' : '<i data-lucide="moon"></i>';

  if (desktopBtn) desktopBtn.innerHTML = `${iconMarkup} <span>Theme Mode</span>`;
  if (mobileBtn) mobileBtn.innerHTML = `${iconMarkup} <span>Theme</span>`;
}

// -------------------------------------------------------------
// 11. BINDING & EVENT LISTENERS
// -------------------------------------------------------------
function setupEventListeners() {
  // Navigation tabs (Sidebar + Bottom Nav)
  document.querySelectorAll(".nav-item, .mobile-nav-item").forEach(item => {
    item.addEventListener("click", () => {
      const tabId = item.dataset.tab;
      if (tabId) switchTab(tabId);
    });
  });

  // Action Buttons
  document.getElementById("btn-add-stock-top")?.addEventListener("click", () => {
    document.getElementById("stock-modal-title").textContent = "Add Incoming Stock";
    document.getElementById("btn-save-stock").textContent = "Save Stock";
    document.getElementById("edit-product-id").value = "";
    document.getElementById("form-add-stock").reset();
    openModal("modal-add-stock");
  });
  
  document.getElementById("btn-add-stock-empty")?.addEventListener("click", () => {
    document.getElementById("stock-modal-title").textContent = "Add Incoming Stock";
    document.getElementById("btn-save-stock").textContent = "Save Stock";
    document.getElementById("edit-product-id").value = "";
    document.getElementById("form-add-stock").reset();
    openModal("modal-add-stock");
  });

  // Shared function to open the Add Sale modal
  function openSaleModal() {
    if (state.products.length === 0) {
      showToast("Add products to inventory first before recording sales.", "error");
      return;
    }
    populateProductSelect();
    // Reset the available stock display
    const stockDisplay = document.getElementById("available-stock-display");
    if (stockDisplay) stockDisplay.innerHTML = '<i data-lucide="package"></i><span>Select a product first</span>';
    // Default sale date to today
    const saleDateInput = document.getElementById("sale-date");
    if (saleDateInput) saleDateInput.valueAsDate = new Date();
    // Reset form
    document.getElementById("form-record-sale")?.reset();
    // Re-set date after reset
    if (saleDateInput) saleDateInput.valueAsDate = new Date();
    openModal("modal-record-sale");
    lucide.createIcons();
  }

  document.getElementById("btn-record-sale-top")?.addEventListener("click", openSaleModal);
  document.getElementById("btn-record-sale-empty")?.addEventListener("click", openSaleModal);

  // Show available stock when product is selected in sale modal
  document.getElementById("sale-product-select")?.addEventListener("change", (e) => {
    const prod = state.products.find(p => p.id === e.target.value);
    const stockDisplay = document.getElementById("available-stock-display");
    if (prod && stockDisplay) {
      const remaining = prod.received - prod.sold;
      const color = remaining <= LOW_STOCK_THRESHOLD ? "var(--danger)" : "var(--primary)";
      stockDisplay.innerHTML = `<i data-lucide="package"></i><span style="color:${color}; font-weight:700;">${remaining} units available</span>`;
      lucide.createIcons();
    }
  });

  // Mobile FAB action list
  document.getElementById("mobile-fab")?.addEventListener("click", () => {
    if (state.products.length === 0) {
      showToast("Register products first before recording sales.", "error");
      return;
    }
    // Populate product dropdown and open sale modal
    populateProductSelect();
    openModal("modal-record-sale");
  });

  // Export / Import binders
  document.getElementById("btn-export-top")?.addEventListener("click", () => {
    const type = confirm("Export as CSV? Press Cancel for JSON.");
    triggerExport(type ? "csv" : "json");
  });

  document.getElementById("btn-import-top")?.addEventListener("click", () => {
    document.getElementById("backup-file-input").click();
  });

  document.getElementById("backup-file-input")?.addEventListener("change", triggerImport);

  // Modals closes
  document.querySelectorAll("[data-close]").forEach(btn => {
    btn.addEventListener("click", closeAllModals);
  });
  document.getElementById("modal-overlay")?.addEventListener("click", closeAllModals);

  // Form Submits
  // Safeguard: only attach if the form exists
  const addStockForm = document.getElementById("form-add-stock");
  if (addStockForm) addStockForm.addEventListener("submit", handleSaveStock);

  const recordSaleForm = document.getElementById("form-record-sale");
  if (recordSaleForm) recordSaleForm.addEventListener("submit", handleRecordSale);

  // Filtering on input changes
  document.getElementById("inventory-search")?.addEventListener("input", renderInventoryTable);
  document.getElementById("category-filter")?.addEventListener("change", renderInventoryTable);
  document.getElementById("low-stock-toggle")?.addEventListener("change", renderInventoryTable);

  // Theme switches
  document.getElementById("theme-toggle-desktop")?.addEventListener("click", toggleTheme);
  document.getElementById("theme-toggle-mobile")?.addEventListener("click", toggleTheme);
}

// -------------------------------------------------------------
// 12. INITIALIZATION
// -------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  loadState();
  initTheme();
  setupEventListeners();
  
  // Set default tab on load
  switchTab("dashboard");
  refreshUI();
  
  // Final render of icons
  lucide.createIcons();
});
