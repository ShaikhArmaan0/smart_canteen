/* ================================================================
   Smart Canteen  –  main.js  v3
   All API calls, no dummy data, graceful fallback messages only
   ================================================================ */

const API = 'http://localhost:5000/api';
const CANTEEN_ID = 1;

/* ── STATE ────────────────────────────────────────────────── */
const S = {
  user:  JSON.parse(localStorage.getItem('sc_user')  || 'null'),
  token: localStorage.getItem('sc_token') || null,
  cart:  JSON.parse(localStorage.getItem('sc_cart')  || '[]'),
  theme: localStorage.getItem('sc_theme') || 'light',
  favs:  JSON.parse(localStorage.getItem('sc_favs')  || '[]'),
  menuItems:  [],
  categories: [],
};

/* ── HELPERS ─────────────────────────────────────────────── */
const isLoggedIn = () => !!S.token;
const isAdmin    = () => S.user?.role === 'admin';
const isStudent  = () => S.user?.role === 'student';
const fmt = (n) => '₹' + parseFloat(n || 0).toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2});
const fmtDate = (d) => new Date(d).toLocaleDateString('en-IN', {day:'numeric',month:'short',year:'numeric'});
const fmtDateTime = (d) => new Date(d).toLocaleString('en-IN', {day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});

/* ── API ─────────────────────────────────────────────────── */
async function api(method, path, body) {
  const headers = {'Content-Type':'application/json'};
  if (S.token) headers['Authorization'] = `Bearer ${S.token}`;
  try {
    const r = await fetch(API + path, {method, headers, body: body ? JSON.stringify(body) : null});
    // 401 = token missing/invalid/expired → clear auth and redirect to login
    // But only redirect if we're NOT already on login.html
    if (r.status === 401) {
      clearAuth();
      if (!location.pathname.endsWith('login.html')) {
        location.href = 'login.html';
      }
      return null;
    }
    const data = await r.json();
    return data;
  } catch(e) {
    console.error(`API ${method} ${path} failed:`, e);
    return null;
  }
}

/* ── AUTH ────────────────────────────────────────────────── */
function saveAuth(user, token) {
  S.user = user; S.token = token;
  localStorage.setItem('sc_user',  JSON.stringify(user));
  localStorage.setItem('sc_token', token);
}
function clearAuth() {
  S.user = S.token = null;
  localStorage.removeItem('sc_user');
  localStorage.removeItem('sc_token');
}
function logout() {
  clearAuth(); S.cart = []; cartSave();
  toast('Logged out successfully', 'info');
  setTimeout(() => location.href = 'login.html', 700);
}

/* Guard: redirect to login if not authenticated */
function requireAuth(adminOnly=false) {
  if (!isLoggedIn()) { location.href = 'login.html'; return false; }
  if (adminOnly && !isAdmin()) { location.href = 'index.html'; return false; }
  return true;
}
function requireStudent() {
  if (!isLoggedIn()) { location.href = 'login.html'; return false; }
  if (isAdmin()) { location.href = 'admin.html'; return false; }
  return true;
}

/* ── CART ────────────────────────────────────────────────── */
function cartSave() { localStorage.setItem('sc_cart', JSON.stringify(S.cart)); }
function cartAdd(item) {
  const ex = S.cart.find(i => i.id === item.id);
  if (ex) ex.quantity++;
  else S.cart.push({...item, quantity:1});
  cartSave(); cartBadge();
}
function cartRemove(id) { S.cart = S.cart.filter(i => i.id !== id); cartSave(); cartBadge(); }
function cartQty(id, d) {
  const it = S.cart.find(i => i.id === id);
  if (!it) return;
  it.quantity = Math.max(0, it.quantity + d);
  if (it.quantity === 0) cartRemove(id); else { cartSave(); cartBadge(); }
}
const cartTotal = () => S.cart.reduce((s,i) => s + i.price*i.quantity, 0);
const cartCount = () => S.cart.reduce((s,i) => s + i.quantity, 0);
function cartBadge() {
  document.querySelectorAll('.cart-badge').forEach(b => {
    const c = cartCount();
    b.textContent = c;
    b.style.display = c > 0 ? 'flex' : 'none';
  });
}

/* ── TOAST ───────────────────────────────────────────────── */
function toast(msg, type='default') {
  const w = document.getElementById('toast-wrap');
  if (!w) return;
  const icons = {success:'✅',error:'❌',info:'ℹ️',default:'🔔'};
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${icons[type]||'🔔'}</span> ${msg}`;
  w.appendChild(el);
  setTimeout(() => el.remove(), 3400);
}

/* ── THEME ───────────────────────────────────────────────── */
function applyTheme(t) {
  S.theme = t;
  document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem('sc_theme', t);
  document.querySelectorAll('.theme-toggle').forEach(el => el.classList.toggle('on', t==='dark'));
}
function toggleTheme() { applyTheme(S.theme === 'dark' ? 'light' : 'dark'); }

/* ── SPLASH (only on very first visit ever, using localStorage) ─────────── */
let _splashDone = localStorage.getItem('sc_splashed');
function initSplash() {
  const s = document.getElementById('splash');
  if (!s) return;
  if (_splashDone) { s.remove(); return; }
  localStorage.setItem('sc_splashed', '1');
  s.classList.add('visible');
  setTimeout(()=>s.classList.add('hide'), 2000);
  setTimeout(()=>s.remove(), 2700);
}

/* ── SIDEBAR ─────────────────────────────────────────────── */
function initSidebar() {
  const ham = document.getElementById('hamburger');
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (!ham || !sidebar) return;
  const open = () => { sidebar.classList.add('open'); if(backdrop) backdrop.classList.add('show'); document.body.style.overflow='hidden'; };
  const close = () => { sidebar.classList.remove('open'); if(backdrop) backdrop.classList.remove('show'); document.body.style.overflow=''; };
  ham.addEventListener('click', () => sidebar.classList.contains('open') ? close() : open());
  if (backdrop) backdrop.addEventListener('click', close);
  sidebar.querySelectorAll('.sidebar-item[data-href]').forEach(item => {
    item.addEventListener('click', () => {
      location.href = item.dataset.href;
    });
  });
}

/* ── MODALS ──────────────────────────────────────────────── */
function openModal(id)  { const m=document.getElementById(id); if(m){m.classList.add('open'); document.body.style.overflow='hidden';} }
function closeModal(id) { const m=document.getElementById(id); if(m){m.classList.remove('open'); document.body.style.overflow='';} }

/* ── STARS RENDER ────────────────────────────────────────── */
function starsHtml(r=0) {
  let h='<div class="card-stars">';
  for(let i=1;i<=5;i++) {
    if(i<=Math.floor(r))     h+='<i class="fas fa-star"></i>';
    else if(i-r<1)           h+='<i class="fas fa-star-half-alt"></i>';
    else                     h+='<i class="far fa-star"></i>';
  }
  return h+(r?`<span>${r}</span>`:'')+'</div>';
}

/* ── ORDER PROGRESS ──────────────────────────────────────── */
const STEPS = ['pending','confirmed','preparing','ready','completed'];
const STEP_LABELS = ['Placed','Confirmed','Cooking','Ready','Done'];
function progressHtml(status) {
  const idx = STEPS.indexOf(status);
  let h='<div class="prog-steps">';
  STEPS.forEach((s,i) => {
    if(i>0) h+=`<div class="prog-line ${i<=idx?'done':''}"></div>`;
    h+=`<div class="prog-step">
      <div class="prog-dot ${i<idx?'done':i===idx?'active':''}">
        ${i<idx?'<i class="fas fa-check"></i>':i+1}
      </div>
      <div class="prog-label">${STEP_LABELS[i]}</div>
    </div>`;
  });
  return h+'</div>';
}

/* ══════════════════════════════════════════════
   HOME PAGE – Menu
══════════════════════════════════════════════ */
async function initHome() {
  updateNavUser();  // just updates nav display, no redirect
  try {
    const [catRes, itemRes] = await Promise.all([
      api('GET', `/menu/categories?canteen_id=${CANTEEN_ID}`),
      api('GET', `/menu/items?canteen_id=${CANTEEN_ID}&available=1`),
    ]);
    if (itemRes?.success) {
      S.menuItems = itemRes.data.map(i=>({
        id:i.id, cat:i.category_id, catName:i.category_name||'Food',
        name:i.name, desc:i.description||'', price:parseFloat(i.price),
        time:i.preparation_time||10, avail:i.is_available,
        img:i.image_url||'', rating:0,
      }));
    }
    S.categories = [{id:'all',name:'All',icon:'🍽️'}];
    const catIcons = {'Veg':'🥗','Non-Veg':'🍗','Snacks':'🍟','Drinks':'🥤','Desserts':'🍮'};
    const seen = new Set();
    S.menuItems.forEach(i => {
      if (!seen.has(i.cat)) {
        seen.add(i.cat);
        S.categories.push({id:i.cat, name:i.catName, icon:catIcons[i.catName]||'🍽️'});
      }
    });
  } catch(e) {
    console.error('Menu load failed', e);
    document.getElementById('menu-grid').innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">⚠️</div><h3>Cannot connect to server</h3><p>Make sure the backend is running on port 5000</p></div>`;
    return;
  }
  S.activeFilter = 'all';
  renderFilters();
  renderGrid();
  document.getElementById('search-input')?.addEventListener('input', e => renderGrid(e.target.value));
}

function renderFilters() {
  const bar = document.getElementById('filters-bar');
  if (!bar) return;
  bar.innerHTML = S.categories.map(c=>`
    <div class="filter-chip ${S.activeFilter===c.id?'active':''}" onclick="filterBy(${JSON.stringify(c.id)})">
      ${c.icon} ${c.name}
    </div>`).join('');
}

function filterBy(id) { S.activeFilter=id; renderFilters(); renderGrid(); }

function renderGrid(search='') {
  const grid = document.getElementById('menu-grid');
  if (!grid) return;
  let items = S.menuItems;
  if (S.activeFilter !== 'all') items = items.filter(i=>i.cat===S.activeFilter);
  if (search) items = items.filter(i=>i.name.toLowerCase().includes(search.toLowerCase()));
  const countEl = document.getElementById('item-count');
  if (countEl) countEl.textContent = `(${items.length})`;
  if (!items.length) {
    grid.innerHTML=`<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">🔍</div><h3>No items found</h3><p>Try a different search or category</p></div>`;
    return;
  }
  grid.innerHTML = items.map((item,idx)=>{
    const isFav = S.favs.includes(item.id);
    return `<div class="food-card" style="animation-delay:${idx*.04}s" onclick="openItemDetail(${item.id})">
      <div class="card-img-wrap">
        <img src="${item.img}" alt="${item.name}" onerror="this.parentElement.querySelector('.card-img-placeholder').style.display='flex';this.style.display='none'">
        <div class="card-img-placeholder" style="display:none">🍽️</div>
        <span class="card-badge ${item.avail?'avail':'unavail'}">${item.avail?'Available':'Sold Out'}</span>
        <div class="card-fav ${isFav?'loved':''}" onclick="event.stopPropagation();toggleFav(${item.id})">
          <i class="fa${isFav?'s':'r'} fa-heart"></i>
        </div>
      </div>
      <div class="card-body">
        <div class="card-cat">${item.catName}</div>
        <div class="card-name">${item.name}</div>
        ${item.rating ? starsHtml(item.rating) : ''}
        <div class="card-footer">
          <div><div class="card-price">₹${item.price}</div>
          <div class="card-time"><i class="fas fa-clock"></i> ${item.time} min</div></div>
          <button class="add-btn" id="add-${item.id}" onclick="event.stopPropagation();addItem(${item.id})" ${!item.avail?'disabled':''}>
            <i class="fas fa-plus"></i>
          </button>
        </div>
      </div>
    </div>`;
  }).join('');
}

function addItem(id) {
  const item = S.menuItems.find(i=>i.id===id);
  if (!item || !item.avail) return;
  cartAdd(item);
  const btn = document.getElementById(`add-${id}`);
  if (btn) {
    btn.classList.add('added'); btn.innerHTML='<i class="fas fa-check"></i>';
    setTimeout(()=>{ btn.classList.remove('added'); btn.innerHTML='<i class="fas fa-plus"></i>'; }, 1200);
  }
  toast(`${item.name} added to cart!`, 'success');
}

function toggleFav(id) {
  const idx = S.favs.indexOf(id);
  if (idx>=0) S.favs.splice(idx,1); else S.favs.push(id);
  localStorage.setItem('sc_favs', JSON.stringify(S.favs));
  renderGrid(document.getElementById('search-input')?.value||'');
}

function openItemDetail(id) {
  const item = S.menuItems.find(i=>i.id===id);
  if (!item) return;
  const body = document.getElementById('item-detail-body');
  if (!body) return;
  body.innerHTML = `
    <img src="${item.img}" alt="${item.name}" style="width:calc(100% + 52px);margin:-26px -26px 18px;height:220px;object-fit:cover;" onerror="this.style.background='linear-gradient(135deg,#FFB085,#FF6B35)'">
    <div style="font-size:21px;font-weight:800;margin-bottom:6px">${item.name}</div>
    <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:10px">
      ${item.rating ? starsHtml(item.rating) : ''}
      <span style="font-size:12px;color:var(--text-2)"><i class="fas fa-clock" style="color:var(--warning)"></i> ${item.time} min</span>
      <span class="badge ${item.avail?'completed':'cancelled'}">${item.avail?'Available':'Sold Out'}</span>
    </div>
    <div style="font-size:13.5px;color:var(--text-2);line-height:1.7;margin-bottom:16px">${item.desc}</div>
    <div style="font-size:26px;font-weight:800;color:var(--primary);margin-bottom:18px">₹${item.price}</div>
    <button class="btn btn-primary" onclick="addItem(${item.id});closeModal('item-modal')" ${!item.avail?'disabled':''}>
      <i class="fas fa-shopping-cart"></i> Add to Cart
    </button>`;
  openModal('item-modal');
}

/* ══════════════════════════════════════════════
   CART PAGE
══════════════════════════════════════════════ */
function initCart() {
  renderCart();
  updateNavUser();
}

function renderCart() {
  const list = document.getElementById('cart-list');
  const empty = document.getElementById('cart-empty');
  const sumWrap = document.getElementById('cart-summary-wrap');
  if (!list) return;
  if (!S.cart.length) {
    list.innerHTML='';
    if (empty) empty.classList.remove('hidden');
    if (sumWrap) sumWrap.classList.add('hidden');
    return;
  }
  if (empty) empty.classList.add('hidden');
  if (sumWrap) sumWrap.classList.remove('hidden');
  list.innerHTML = S.cart.map((item,idx)=>`
    <div class="cart-item" style="animation-delay:${idx*.05}s">
      <img class="cart-thumb" src="${item.img||''}" alt="${item.name}" onerror="this.style.display='none'">
      <div class="cart-info">
        <div class="cart-name">${item.name}</div>
        <div class="cart-meta">${item.catName||''}</div>
        <div class="cart-price">${fmt(item.price*item.quantity)}</div>
        <div class="qty-ctrl">
          <button class="qty-btn" onclick="cartQty(${item.id},-1);renderCart()">−</button>
          <span class="qty-num">${item.quantity}</span>
          <button class="qty-btn" onclick="cartQty(${item.id},+1);renderCart()">+</button>
        </div>
      </div>
      <button class="cart-del" onclick="cartRemove(${item.id});renderCart()"><i class="fas fa-trash"></i></button>
    </div>`).join('');
  const sub=cartTotal(), tax=sub*.05, dlv=sub>200?0:20, total=sub+tax+dlv;
  const sum = document.getElementById('cart-summary');
  if (sum) sum.innerHTML = `
    <div class="summary-row"><span>Subtotal</span><span>${fmt(sub)}</span></div>
    <div class="summary-row"><span>GST (5%)</span><span>${fmt(tax)}</span></div>
    <div class="summary-row"><span>Delivery</span><span>${dlv===0?'<span style="color:var(--success);font-weight:600">FREE</span>':fmt(dlv)}</span></div>
    <div class="summary-row total"><span>Total</span><span>${fmt(total)}</span></div>`;
}

function checkout() {
  if (!S.cart.length) { toast('Cart is empty!','error'); return; }
  if (!isLoggedIn()) { toast('Please login to checkout','error'); setTimeout(()=>location.href='login.html',800); return; }
  const sub=cartTotal(), tax=sub*.05, dlv=sub>200?0:20, total=sub+tax+dlv;
  const amtEl = document.getElementById('pay-amount');
  if (amtEl) amtEl.textContent = fmt(total);
  openModal('pay-modal');
}

let selPayMethod='upi';
function selectPay(m) {
  selPayMethod=m;
  document.querySelectorAll('.pay-opt').forEach(b=>b.classList.toggle('sel',b.dataset.m===m));
}

async function confirmPay() {
  const btn = document.getElementById('pay-btn');
  if (btn) { btn.disabled=true; btn.innerHTML='<i class="fas fa-spinner spin"></i> Processing…'; }
  if (!S.cart.length) { toast('Cart is empty','error'); if(btn){btn.disabled=false;btn.innerHTML='<i class="fas fa-lock"></i> Pay Now';} return; }
  try {
    const items = S.cart.map(i=>({menu_item_id:i.id, quantity:i.quantity}));
    const payload = { canteen_id: CANTEEN_ID, items };
    const orderRes = await api('POST', '/orders', payload);
    if (orderRes?.success) {
      const order = orderRes.data;
      // Simulate payment confirmation for UPI/cash
      await api('POST', '/payments/mock-success', {order_id: order.id, payment_method: selPayMethod});
      closeModal('pay-modal');
      S.cart=[]; cartSave(); cartBadge();
      toast(`Order #${order.id} placed! Token: #${order.token_number} 🎉`, 'success');
      renderCart();
      setTimeout(()=>location.href='orders.html', 1500);
    } else {
      toast(orderRes?.message||'Order failed. Please try again.','error');
    }
  } catch(e) {
    console.error('Order error:', e);
    toast('Could not connect to server. Make sure backend is running on port 5000.','error');
  }
  if (btn) { btn.disabled=false; btn.innerHTML='<i class="fas fa-lock"></i> Pay Now'; }
}

/* ══════════════════════════════════════════════
   ORDERS PAGE
══════════════════════════════════════════════ */
async function initOrders() {
  if (!requireStudent()) return;
  updateNavUser();
  await loadOrders();
}

async function loadOrders(filter='all') {
  const grid = document.getElementById('orders-grid');
  if (grid) grid.innerHTML=`<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-2)"><i class="fas fa-spinner spin" style="font-size:24px;display:block;margin-bottom:12px"></i>Loading orders…</div>`;
  try {
    const res = await api('GET', '/orders');
    if (res?.success) {
      let orders = res.data;
      if (filter!=='all') orders = orders.filter(o=>o.status===filter);
      renderOrders(orders);
    } else {
      if (grid) grid.innerHTML=`<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">📦</div><h3>No orders yet</h3><p>Order some food to see it here</p></div>`;
    }
  } catch(e) {
    if (grid) grid.innerHTML=`<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">⚠️</div><h3>Server unavailable</h3><p>Please start the backend server</p></div>`;
  }
}

function renderOrders(orders) {
  const grid = document.getElementById('orders-grid');
  if (!grid) return;
  if (!orders.length) {
    grid.innerHTML=`<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">📦</div><h3>No orders found</h3><p>Your orders will appear here</p><a href="index.html"><button class="btn btn-primary" style="width:auto;padding:11px 24px;margin-top:12px">Order Food</button></a></div>`;
    return;
  }
  grid.innerHTML = orders.map((o,i)=>{
    const items = (o.items||[]).map(x=>`${x.name} × ${x.quantity}`).join(' · ');
    const canCancel = ['pending','confirmed'].includes(o.status);
    return `<div class="order-card" style="animation-delay:${i*.06}s" onclick="viewOrderReceipt(${o.id})">
      <div class="order-head">
        <div><div class="order-id">#ORD-${o.id}</div><div class="order-date">${fmtDateTime(o.order_time)}</div></div>
        <span class="badge ${o.status}">${o.status.charAt(0).toUpperCase()+o.status.slice(1)}</span>
      </div>
      <div class="order-progress">${progressHtml(o.status)}</div>
      <div class="order-items-text">${items}</div>
      <div class="order-foot">
        <div class="order-total">${fmt(o.total_amount)}</div>
        <div style="display:flex;align-items:center;gap:8px">
          <div class="order-token">Token #${o.token_number}</div>
          ${canCancel ? `<button class="btn btn-danger btn-sm" style="padding:5px 10px;font-size:11px" onclick="event.stopPropagation();cancelOrder(${o.id})"><i class="fas fa-times"></i> Cancel</button>` : ''}
        </div>
      </div>
    </div>`;
  }).join('');
}

function filterOrders(f, el) {
  document.querySelectorAll('#order-filters .filter-chip').forEach(c=>c.classList.remove('active'));
  if(el) el.classList.add('active');
  loadOrders(f);
}

function showCancelModal(orderId) {
  let modal = document.getElementById('cancel-flow-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'cancel-flow-modal';
    modal.className = 'dialog-overlay';
    document.body.appendChild(modal);
  }
  modal.innerHTML = `
    <div class="dialog" style="max-width:460px">
      <div style="text-align:center;padding:8px 0 16px">
        <div style="width:64px;height:64px;border-radius:50%;background:rgba(239,68,68,.1);display:flex;align-items:center;justify-content:center;margin:0 auto 14px">
          <i class="fas fa-times-circle" style="font-size:30px;color:var(--danger)"></i>
        </div>
        <div style="font-size:18px;font-weight:700;margin-bottom:6px">Cancel Order #${orderId}?</div>
        <div style="font-size:13px;color:var(--text-2)">This action cannot be undone.</div>
      </div>
      <div style="background:var(--surface2);border-radius:12px;padding:14px;margin-bottom:18px;font-size:13px;color:var(--text-2);line-height:1.6">
        <i class="fas fa-info-circle" style="color:var(--primary);margin-right:6px"></i>
        If you have already paid, you can request a <strong>manual refund</strong> at the Campus Canteen counter after cancelling.
      </div>
      <div style="display:flex;gap:10px">
        <button class="btn btn-ghost" style="flex:1" onclick="closeCancelModal()">Keep Order</button>
        <button class="btn btn-danger" style="flex:1" id="confirm-cancel-btn" onclick="doCancel(${orderId})">
          <i class="fas fa-times"></i> Yes, Cancel
        </button>
      </div>
    </div>`;
  // Use requestAnimationFrame so transition plays after innerHTML is set
  requestAnimationFrame(() => {
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  });
  modal.onclick = (e) => { if (e.target === modal) closeCancelModal(); };
}

function closeCancelModal() {
  const modal = document.getElementById('cancel-flow-modal');
  if (modal) modal.classList.remove('open');
  document.body.style.overflow = '';
}

async function doCancel(orderId) {
  const btn = document.getElementById('confirm-cancel-btn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner spin"></i> Cancelling…'; }
  try {
    const res = await api('PUT', `/orders/${orderId}/status`, {status: 'cancelled'});
    if (res?.success) {
      closeCancelModal();
      showRefundInfoModal(orderId);
      loadOrders();
    } else {
      toast(res?.message || 'Could not cancel order', 'error');
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-times"></i> Yes, Cancel'; }
    }
  } catch(e) {
    toast('Server error', 'error');
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-times"></i> Yes, Cancel'; }
  }
}

async function cancelOrder(orderId) {
  showCancelModal(orderId);
}

async function showRefundInfoModal(orderId) {
  // Submit refund request automatically
  let refundId = null;
  try {
    const rr = await api('POST', '/refunds/request', {order_id: orderId});
    if (rr?.success) refundId = rr.data?.id;
  } catch(e) {}

  let modal = document.getElementById('refund-info-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'refund-info-modal';
    modal.className = 'dialog-overlay';
    document.body.appendChild(modal);
  }
  modal.innerHTML = `
    <div class="dialog" style="max-width:460px">
      <div style="text-align:center;padding:8px 0 20px">
        <div style="width:64px;height:64px;border-radius:50%;background:rgba(16,185,129,.12);display:flex;align-items:center;justify-content:center;margin:0 auto 14px">
          <i class="fas fa-check-circle" style="font-size:30px;color:var(--success)"></i>
        </div>
        <div style="font-size:18px;font-weight:700;margin-bottom:4px">Order #${orderId} Cancelled</div>
        <div style="font-size:13px;color:var(--success);font-weight:600">Refund request submitted ✓</div>
      </div>

      <div style="background:var(--primary-soft);border-radius:14px;padding:16px;margin-bottom:14px">
        <div style="font-weight:700;font-size:13px;color:var(--primary);margin-bottom:10px;display:flex;align-items:center;gap:6px">
          <i class="fas fa-rupee-sign"></i> How to Claim Your Refund
        </div>
        <div style="display:flex;flex-direction:column;gap:10px">
          <div style="display:flex;align-items:flex-start;gap:10px;font-size:13px;color:var(--text-2)">
            <div style="width:22px;height:22px;border-radius:50%;background:var(--primary);color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0">1</div>
            <span>Visit the <strong>Order Counter</strong> at the campus canteen</span>
          </div>
          <div style="display:flex;align-items:flex-start;gap:10px;font-size:13px;color:var(--text-2)">
            <div style="width:22px;height:22px;border-radius:50%;background:var(--primary);color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0">2</div>
            <span>Show your <strong>Order #${orderId}</strong> and your phone number</span>
          </div>
          <div style="display:flex;align-items:flex-start;gap:10px;font-size:13px;color:var(--text-2)">
            <div style="width:22px;height:22px;border-radius:50%;background:var(--primary);color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0">3</div>
            <span>Admin will send an <strong>OTP to your phone</strong> — share it to confirm refund</span>
          </div>
          <div style="display:flex;align-items:flex-start;gap:10px;font-size:13px;color:var(--text-2)">
            <div style="width:22px;height:22px;border-radius:50%;background:var(--success);color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0">✓</div>
            <span>Receive your <strong>instant cash refund</strong> at the counter</span>
          </div>
        </div>
      </div>

      <div style="background:var(--surface2);border-radius:12px;padding:12px;margin-bottom:18px;display:flex;align-items:center;gap:10px;font-size:13px">
        <i class="fas fa-map-marker-alt" style="color:var(--danger);font-size:16px;flex-shrink:0"></i>
        <div><strong>Order Counter</strong> · Main Campus Canteen<br><span style="color:var(--text-3)">Block A, Ground Floor · Open 8AM–9PM</span></div>
      </div>

      <button class="btn btn-primary" style="width:100%;padding:13px" onclick="document.getElementById('refund-info-modal').classList.remove('open');document.body.style.overflow=''">
        <i class="fas fa-check"></i> Got it
      </button>
    </div>`;
  requestAnimationFrame(() => {
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  });
  modal.onclick = (e) => { if (e.target === modal) { modal.classList.remove('open'); document.body.style.overflow=''; } };
}

/* ── Receipt Modal ── */
async function viewOrderReceipt(orderId) {
  const body = document.getElementById('receipt-body');
  if (!body) return;
  body.innerHTML='<div style="text-align:center;padding:20px"><i class="fas fa-spinner spin"></i></div>';
  openModal('receipt-modal');
  try {
    const [orderRes, payRes] = await Promise.all([
      api('GET', `/orders/${orderId}`),
      api('GET', `/payments/order/${orderId}`).catch(()=>null),
    ]);
    if (orderRes?.success) {
      const o = orderRes.data;
      const pay = payRes?.data;
      body.innerHTML = `
        <div class="receipt">
          <div class="receipt-header">
            <div class="receipt-logo">🍽️</div>
            <div class="receipt-title">Smart Canteen</div>
            <div class="receipt-sub">Main Campus · Tax Invoice</div>
          </div>
          <div class="receipt-section">
            <div class="receipt-section-title">Order Details</div>
            <div class="receipt-row"><span>Order ID</span><span>#ORD-${o.id}</span></div>
            <div class="receipt-row"><span>Token Number</span><span class="fw-700 text-primary">#${o.token_number}</span></div>
            <div class="receipt-row"><span>Date & Time</span><span>${fmtDateTime(o.order_time)}</span></div>
            <div class="receipt-row"><span>Status</span><span class="badge ${o.status}">${o.status}</span></div>
            <div class="receipt-row"><span>Canteen</span><span>${o.canteen_name||'Main Canteen'}</span></div>
          </div>
          <div class="receipt-section">
            <div class="receipt-section-title">Customer</div>
            <div class="receipt-row"><span>Name</span><span>${o.user_name||S.user?.name||'—'}</span></div>
            <div class="receipt-row"><span>Email</span><span>${S.user?.email||'—'}</span></div>
            ${S.user?.phone?`<div class="receipt-row"><span>Phone</span><span>${S.user.phone}</span></div>`:''}
          </div>
          <div class="receipt-section">
            <div class="receipt-section-title">Items Ordered</div>
            ${(o.items||[]).map(item=>`
              <div class="receipt-row">
                <span>${item.name} × ${item.quantity}</span>
                <span>${fmt(item.price*item.quantity)}</span>
              </div>`).join('')}
          </div>
          <div class="receipt-section">
            <div class="receipt-section-title">Payment</div>
            <div class="receipt-row"><span>Subtotal</span><span>${fmt(o.total_amount)}</span></div>
            <div class="receipt-row"><span>GST (5%)</span><span>${fmt(o.total_amount*.05)}</span></div>
            <div class="receipt-row receipt-total"><span>Total Paid</span><span>${fmt(o.total_amount*1.05)}</span></div>
            ${pay?`<div class="receipt-row"><span>Payment Method</span><span>${(pay.payment_method||'').toUpperCase()}</span></div>
            <div class="receipt-row"><span>Transaction ID</span><span style="font-size:11px">${pay.transaction_id||'—'}</span></div>
            <div class="receipt-row"><span>Payment Status</span><span class="badge ${pay.payment_status==='success'?'completed':'cancelled'}">${pay.payment_status}</span></div>`:''}
          </div>
          <div class="receipt-footer">
            <div>Thank you for ordering! 🙏</div>
            <div>Smart Canteen · support@canteen.edu</div>
          </div>
        </div>
        <div style="display:flex;gap:10px;margin-top:18px">
          <button class="btn btn-outline btn-sm" style="flex:1" onclick="printReceipt()"><i class="fas fa-print"></i> Print</button>
          <button class="btn btn-ghost btn-sm" style="flex:1" onclick="closeModal('receipt-modal')">Close</button>
        </div>`;
    }
  } catch(e) { body.innerHTML='<div class="empty-state"><div class="empty-icon">⚠️</div><h3>Could not load receipt</h3></div>'; }
}

function printReceipt() {
  const content = document.querySelector('.receipt')?.outerHTML;
  if (!content) return;
  const w = window.open('','_blank');
  w.document.write(`<html><head><title>Receipt</title><style>body{font-family:sans-serif;max-width:400px;margin:20px auto}.receipt-row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #eee}.receipt-header{text-align:center;margin-bottom:16px}</style></head><body>${content}</body></html>`);
  w.print();
}

/* ══════════════════════════════════════════════
   PROFILE PAGE
══════════════════════════════════════════════ */
async function initProfile() {
  if (!requireStudent()) return;
  renderProfilePage();
  await loadProfileStats();
}

function renderProfilePage() {
  const user = S.user || {};
  const av = document.getElementById('profile-avatar');
  const nm = document.getElementById('profile-name');
  const em = document.getElementById('profile-email');
  const ph = document.getElementById('profile-phone');
  const ro = document.getElementById('profile-role');
  if (av) av.textContent = (user.name||'U').charAt(0).toUpperCase();
  if (nm) nm.textContent = user.name||'';
  if (em) em.textContent = user.email||'';
  if (ph) ph.textContent = user.phone||'Not set';
  if (ro) ro.textContent = user.role||'student';
  // Pre-fill edit form
  const fn = document.getElementById('edit-name');
  const fe = document.getElementById('edit-email');
  const fp = document.getElementById('edit-phone');
  if (fn) fn.value = user.name||'';
  if (fe) fe.value = user.email||'';
  if (fp) fp.value = user.phone||'';
  // Theme toggle
  const tt = document.getElementById('theme-toggle');
  if (tt) tt.classList.toggle('on', S.theme==='dark');
}

async function loadProfileStats() {
  try {
    const res = await api('GET','/orders');
    if (res?.success) {
      const orders = res.data;
      const el = document.getElementById('profile-order-count');
      if (el) el.textContent = orders.length;
      const completed = orders.filter(o=>o.status==='completed');
      const spent = completed.reduce((s,o)=>s+parseFloat(o.total_amount),0);
      const se = document.getElementById('profile-spent');
      if (se) se.textContent = fmt(spent);
      const avg = completed.length ? spent/completed.length : 0;
      const ae = document.getElementById('profile-avg');
      if (ae) ae.textContent = fmt(avg);
    }
  } catch(e) {}
}

async function saveProfile(e) {
  e.preventDefault();
  const btn = e.target.querySelector('[type=submit]');
  if (btn) { btn.disabled=true; btn.textContent='Saving…'; }
  const data = {
    name:  document.getElementById('edit-name')?.value.trim(),
    email: document.getElementById('edit-email')?.value.trim(),
    phone: document.getElementById('edit-phone')?.value.trim(),
  };
  const cp = document.getElementById('edit-current-pw')?.value;
  const np = document.getElementById('edit-new-pw')?.value;
  if (cp && np) { data.current_password=cp; data.new_password=np; }
  try {
    const res = await api('PUT', '/auth/profile', data);
    if (res?.success) {
      saveAuth(res.data, S.token);
      renderProfilePage();
      toast('Profile updated!', 'success');
      closeModal('edit-profile-modal');
    } else {
      toast(res?.message||'Update failed', 'error');
    }
  } catch(e) { toast('Server error','error'); }
  if (btn) { btn.disabled=false; btn.textContent='Save Changes'; }
}

async function savePassword(e) {
  e.preventDefault();
  const btn = e.target.querySelector('[type=submit]');
  if (btn) { btn.disabled=true; btn.textContent='Saving…'; }
  const cp = document.getElementById('cpw-current')?.value;
  const np = document.getElementById('cpw-new')?.value;
  if (!cp || !np) { toast('Fill both password fields', 'error'); if (btn) { btn.disabled=false; btn.textContent='Update Password'; } return; }
  if (np.length < 6) { toast('New password must be at least 6 characters', 'error'); if (btn) { btn.disabled=false; btn.textContent='Update Password'; } return; }
  try {
    const res = await api('PUT', '/auth/profile', {current_password: cp, new_password: np});
    if (res?.success) {
      toast('Password updated!', 'success');
      closeModal('change-pw-modal');
      e.target.reset();
    } else {
      toast(res?.message||'Update failed', 'error');
    }
  } catch(e) { toast('Server error','error'); }
  if (btn) { btn.disabled=false; btn.textContent='Update Password'; }
}

/* ══════════════════════════════════════════════
   TRANSACTIONS PAGE
══════════════════════════════════════════════ */
async function initTransactions() {
  if (!requireStudent()) return;
  updateNavUser();
  await loadTransactions();
}

async function loadTransactions() {
  const wrap = document.getElementById('transactions-wrap');
  if (wrap) wrap.innerHTML='<div style="text-align:center;padding:30px"><i class="fas fa-spinner spin" style="font-size:22px;display:block;margin-bottom:10px"></i>Loading…</div>';
  try {
    const res = await api('GET', '/orders');
    if (res?.success) {
      const orders = res.data;
      renderTransactions(orders);
    }
  } catch(e) {
    if (wrap) wrap.innerHTML='<div class="empty-state"><div class="empty-icon">⚠️</div><h3>Server unavailable</h3></div>';
  }
}

function renderTransactions(orders) {
  const wrap = document.getElementById('transactions-wrap');
  const paid = orders.filter(o=>['completed','confirmed','preparing','ready'].includes(o.status));
  const totalSpent = paid.reduce((s,o)=>s+parseFloat(o.total_amount),0);
  const tsEl = document.getElementById('tx-total-spent');
  if (tsEl) tsEl.textContent = fmt(totalSpent);
  const tcEl = document.getElementById('tx-count');
  if (tcEl) tcEl.textContent = orders.length;
  if (!orders.length) {
    if (wrap) wrap.innerHTML='<div class="empty-state"><div class="empty-icon">💳</div><h3>No orders yet</h3><p>Order food to see your history here</p></div>';
    return;
  }
  const statusIcon = {completed:'✅',confirmed:'🔵',preparing:'🍳',ready:'🔔',pending:'⏳',cancelled:'❌',refunded:'💰'};
  if (wrap) wrap.innerHTML = orders.map((o,i) => {
    const itemList  = (o.items||[]).map(x=>`${x.name} ×${x.quantity}`).join(' · ') || '—';
    const st        = o.status;
    const canDelete = st === 'cancelled' || o.is_refunded;
    return `<div class="tx-card" style="animation-delay:${i*.04}s">
      <div class="tx-card-head">
        <div>
          <div class="tx-order-id">#ORD-${o.id}
            <span class="badge ${st}" style="font-size:10px;margin-left:6px">${statusIcon[st]||''} ${st}</span>
          </div>
          <div class="tx-meta">Token #${o.token_number||'—'} · ${fmtDateTime(o.order_time||o.created_at)}</div>
        </div>
        <div class="tx-amount">${fmt(o.total_amount)}</div>
      </div>
      <div class="tx-items">${itemList}</div>
      <div class="tx-card-foot">
        <button class="btn btn-ghost btn-sm" onclick="viewOrderReceipt(${o.id})">
          <i class="fas fa-receipt"></i> Receipt
        </button>
        ${canDelete ? `<button class="btn btn-sm" style="background:rgba(239,68,68,.1);color:var(--danger);border:none" onclick="showDeleteOrderModal(${o.id})">
          <i class="fas fa-trash"></i> Delete Log
        </button>` : ''}
      </div>
    </div>`;
  }).join('');
}

function showDeleteOrderModal(orderId) {
  let modal = document.getElementById('delete-order-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'delete-order-modal';
    modal.className = 'dialog-overlay';
    document.body.appendChild(modal);
  }
  modal.innerHTML = `
    <div class="dialog" style="max-width:420px">
      <div style="text-align:center;padding:6px 0 18px">
        <div style="width:60px;height:60px;border-radius:50%;background:rgba(239,68,68,.1);display:flex;align-items:center;justify-content:center;margin:0 auto 14px">
          <i class="fas fa-trash-alt" style="font-size:26px;color:var(--danger)"></i>
        </div>
        <div style="font-size:17px;font-weight:700;margin-bottom:6px">Delete Order Log?</div>
        <div style="font-size:13px;color:var(--text-2);line-height:1.7">
          This will permanently remove <strong>Order #${orderId}</strong> and all its records from the database.<br>
          <span style="color:var(--danger);font-weight:600">This action cannot be undone.</span>
        </div>
      </div>
      <div style="background:var(--surface2);border-radius:10px;padding:10px 14px;margin-bottom:16px;font-size:12px;color:var(--text-3)">
        <i class="fas fa-info-circle" style="color:var(--info);margin-right:6px"></i>
        Only cancelled or fully refunded orders can be deleted.
      </div>
      <div style="display:flex;gap:10px">
        <button class="btn btn-ghost" style="flex:1" onclick="document.getElementById('delete-order-modal').classList.remove('open');document.body.style.overflow=''">
          Cancel
        </button>
        <button class="btn btn-danger" style="flex:1" onclick="confirmDeleteOrder(${orderId})">
          <i class="fas fa-trash-alt"></i> Delete Permanently
        </button>
      </div>
    </div>`;
  requestAnimationFrame(() => { modal.classList.add('open'); document.body.style.overflow='hidden'; });
  modal.onclick = (e) => { if (e.target===modal) { modal.classList.remove('open'); document.body.style.overflow=''; } };
}

async function confirmDeleteOrder(orderId) {
  const modal = document.getElementById('delete-order-modal');
  if (modal) { modal.classList.remove('open'); document.body.style.overflow=''; }
  try {
    const res = await api('DELETE', `/orders/${orderId}`);
    if (res?.success) {
      toast('Order log deleted permanently', 'info');
      // Refresh whichever view is active
      if (document.getElementById('transactions-wrap')) loadTransactions();
      if (document.getElementById('admin-orders-body'))  loadAdminOrders(document.getElementById('orders-status-filter')?.value || '');
      if (document.getElementById('dashboard-orders-body')) renderAdminDashboard();
    } else {
      toast(res?.message || 'Could not delete order', 'error');
    }
  } catch(e) { toast('Server error', 'error'); }
}

/* ══════════════════════════════════════════════
   REVIEWS PAGE
══════════════════════════════════════════════ */
async function initReviews() {
  updateNavUser();
  await loadReviews();
}

async function loadReviews() {
  const wrap = document.getElementById('reviews-wrap');
  if (wrap) wrap.innerHTML='<div style="text-align:center;padding:30px"><i class="fas fa-spinner spin" style="font-size:22px;display:block;margin-bottom:10px"></i>Loading reviews…</div>';
  try {
    const res = await api('GET','/reviews');
    if (res?.success) renderReviews(res.data);
  } catch(e) {
    if (wrap) wrap.innerHTML='<div class="empty-state"><div class="empty-icon">⚠️</div><h3>Server unavailable</h3></div>';
  }
}

function renderReviews(reviews) {
  const wrap = document.getElementById('reviews-wrap');
  if (!wrap) return;
  if (!reviews.length) {
    wrap.innerHTML='<div class="empty-state"><div class="empty-icon">💬</div><h3>No reviews yet</h3><p>Be the first to leave a review!</p></div>';
    return;
  }
  const avgRating = (reviews.reduce((s,r)=>s+r.rating,0)/reviews.length).toFixed(1);
  const avgEl = document.getElementById('avg-rating');
  if (avgEl) avgEl.textContent = avgRating;
  const cntEl = document.getElementById('review-count');
  if (cntEl) cntEl.textContent = reviews.length;
  const myId = S.user?.id;
  wrap.innerHTML = reviews.map((r,i)=>`
    <div class="review-card" style="animation-delay:${i*.05}s">
      <div class="review-author">
        <div class="review-avatar">${r.user_name.charAt(0).toUpperCase()}</div>
        <div style="flex:1">
          <div class="review-name">${r.user_name}</div>
          <div class="review-date">${fmtDate(r.created_at)} ${r.item_name?`· ${r.item_name}`:''}</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;margin-left:auto">
          <div class="review-stars">${Array.from({length:5},(_,j)=>`<i class="fa${j<r.rating?'s':'r'} fa-star"></i>`).join('')}</div>
          ${myId && r.user_id === myId ? `<button class="icon-btn trash" onclick="deleteReview(${r.id})" title="Delete my review"><i class="fas fa-trash"></i></button>` : ''}
        </div>
      </div>
      ${r.comment?`<div class="review-comment">${r.comment}</div>`:''}
    </div>`).join('');
}

let selectedRating = 0;
function deleteReview(reviewId) {
  let modal = document.getElementById('delete-review-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'delete-review-modal';
    modal.className = 'dialog-overlay';
    document.body.appendChild(modal);
  }
  modal.innerHTML = `
    <div class="dialog" style="max-width:420px">
      <div style="text-align:center;padding:6px 0 18px">
        <div style="width:60px;height:60px;border-radius:50%;background:rgba(239,68,68,.1);display:flex;align-items:center;justify-content:center;margin:0 auto 14px">
          <i class="fas fa-trash" style="font-size:26px;color:var(--danger)"></i>
        </div>
        <div style="font-size:17px;font-weight:700;margin-bottom:6px">Delete Review?</div>
        <div style="font-size:13px;color:var(--text-2);line-height:1.6">
          This will permanently remove your review.<br>This action <strong>cannot be undone</strong>.
        </div>
      </div>
      <div style="display:flex;gap:10px">
        <button class="btn btn-ghost" style="flex:1" onclick="document.getElementById('delete-review-modal').classList.remove('open');document.body.style.overflow=''">
          Keep it
        </button>
        <button class="btn btn-danger" style="flex:1" onclick="confirmDeleteReview(${reviewId})">
          <i class="fas fa-trash"></i> Delete
        </button>
      </div>
    </div>`;
  requestAnimationFrame(() => {
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  });
  modal.onclick = (e) => { if (e.target === modal) { modal.classList.remove('open'); document.body.style.overflow=''; } };
}

async function confirmDeleteReview(reviewId) {
  const modal = document.getElementById('delete-review-modal');
  if (modal) { modal.classList.remove('open'); document.body.style.overflow=''; }
  try {
    const res = await api('DELETE', `/reviews/${reviewId}`);
    if (res?.success) {
      toast('Review deleted', 'info');
      loadReviews();
    } else {
      toast(res?.message || 'Could not delete review', 'error');
    }
  } catch(e) { toast('Server error', 'error'); }
}
function selectStar(n) {
  selectedRating = n;
  document.querySelectorAll('#star-rating i').forEach((el,i)=>el.classList.toggle('active',i<n));
}

async function submitReview(e) {
  e.preventDefault();
  if (!isLoggedIn()) { toast('Please login to review','error'); return; }
  if (!selectedRating) { toast('Please select a rating','error'); return; }
  const comment = document.getElementById('review-comment')?.value.trim();
  const reviewType = 'general';
  try {
    const res = await api('POST','/reviews',{rating:selectedRating,comment,review_type:reviewType});
    if (res?.success) {
      toast('Review submitted!','success');
      closeModal('review-modal');
      selectedRating=0;
      document.getElementById('star-rating')?.querySelectorAll('i').forEach(i=>i.classList.remove('active'));
      document.getElementById('review-comment').value='';
      loadReviews();
    } else { toast(res?.message||'Failed','error'); }
  } catch(e) { toast('Server error','error'); }
}

/* ══════════════════════════════════════════════
   AUTH FORMS
══════════════════════════════════════════════ */
function switchTab(t) {
  document.querySelectorAll('.auth-tab').forEach(el=>el.classList.toggle('active',el.dataset.tab===t));
  document.querySelectorAll('.auth-form').forEach(el=>el.classList.toggle('hidden',el.id!==`form-${t}`));
}

function validateEmail(email) { return /^[\w.+-]+@[\w-]+\.[a-zA-Z]{2,}$/.test(email); }
function validateField(id, msg) {
  const el = document.getElementById(id);
  if (!el) return true;
  const grp = el.closest('.form-group');
  const errEl = grp?.querySelector('.form-error');
  if (!el.value.trim()) {
    grp?.classList.add('error');
    if (errEl) errEl.textContent = msg;
    return false;
  }
  grp?.classList.remove('error');
  return true;
}

async function handleLogin(e) {
  e.preventDefault();
  let valid = true;
  if (!validateField('l-email','Email is required')) valid=false;
  if (!validateField('l-pass','Password is required')) valid=false;
  if (!valid) return;
  const email = document.getElementById('l-email').value.trim().toLowerCase();
  const pw    = document.getElementById('l-pass').value;
  if (!validateEmail(email)) { toast('Invalid email address','error'); return; }
  const btn = e.target.querySelector('[type=submit]');
  if (btn) { btn.disabled=true; btn.innerHTML='<i class="fas fa-spinner spin"></i> Logging in…'; }
  try {
    const res = await api('POST','/auth/login',{email,password:pw});
    if (res?.success) {
      saveAuth(res.data.user, res.data.token);
      toast(`Welcome, ${res.data.user.name}!`,'success');
      setTimeout(()=>location.href=res.data.user.role==='admin'?'admin.html':'index.html', 600);
    } else {
      toast(res?.message||'Invalid credentials','error');
      if (btn) { btn.disabled=false; btn.innerHTML='<i class="fas fa-sign-in-alt"></i> Login'; }
    }
  } catch(er) {
    toast('Cannot connect to server. Is the backend running?','error');
    if (btn) { btn.disabled=false; btn.innerHTML='<i class="fas fa-sign-in-alt"></i> Login'; }
  }
}

async function handleRegister(e) {
  e.preventDefault();
  let valid=true;
  if (!validateField('r-name','Name is required')) valid=false;
  if (!validateField('r-email','Email is required')) valid=false;
  if (!validateField('r-pass','Password is required')) valid=false;
  if (!valid) return;
  const name  = document.getElementById('r-name').value.trim();
  const email = document.getElementById('r-email').value.trim().toLowerCase();
  const pw    = document.getElementById('r-pass').value;
  const phone = document.getElementById('r-phone')?.value.trim()||'';
  if (name.length<2) { toast('Name must be at least 2 characters','error'); return; }
  if (!validateEmail(email)) { toast('Invalid email address','error'); return; }
  if (pw.length<6) { toast('Password must be at least 6 characters','error'); return; }
  if (!phone || phone.length < 10) { toast('Phone number is required (min 10 digits)','error'); return; }
  const btn = e.target.querySelector('[type=submit]');
  if (btn) { btn.disabled=true; btn.innerHTML='<i class="fas fa-spinner spin"></i> Creating account…'; }
  try {
    const res = await api('POST','/auth/register',{name,email,password:pw,phone,role:'student'});
    if (res?.success) {
      toast('Account created! Please login','success');
      switchTab('login');
    } else {
      toast(res?.message||'Registration failed','error');
    }
    if (btn) { btn.disabled=false; btn.innerHTML='<i class="fas fa-user-plus"></i> Create Account'; }
  } catch(er) {
    toast('Cannot connect to server','error');
    if (btn) { btn.disabled=false; btn.innerHTML='<i class="fas fa-user-plus"></i> Create Account'; }
  }
}

async function handleForgotPassword(e) {
  e.preventDefault();
  const email = document.getElementById('forgot-email')?.value.trim().toLowerCase();
  if (!email || !validateEmail(email)) { toast('Enter a valid email','error'); return; }
  const btn = e.target.querySelector('[type=submit]');
  if (btn) { btn.disabled=true; btn.textContent='Sending…'; }
  try {
    const res = await api('POST','/auth/forgot-password',{email});
    if (res?.success) {
      // In demo mode, token is returned in response
      toast('Reset code sent! Check console for token (demo)','info');
      console.log('RESET TOKEN (demo):', res.data?.reset_token);
      document.getElementById('forgot-token-section').classList.remove('hidden');
    } else { toast(res?.message||'Error','error'); }
  } catch(er) { toast('Server error','error'); }
  if (btn) { btn.disabled=false; btn.textContent='Send Reset Link'; }
}

async function handleResetPassword(e) {
  e.preventDefault();
  const email  = document.getElementById('forgot-email')?.value.trim().toLowerCase();
  const token  = document.getElementById('reset-token')?.value.trim();
  const newPw  = document.getElementById('reset-new-pw')?.value;
  if (!token) { toast('Enter the reset token','error'); return; }
  if (!newPw || newPw.length<6) { toast('Password must be at least 6 characters','error'); return; }
  try {
    const res = await api('POST','/auth/reset-password',{email,token,new_password:newPw});
    if (res?.success) { toast('Password reset! Please login','success'); switchTab('login'); closeModal('forgot-modal'); }
    else { toast(res?.message||'Invalid token','error'); }
  } catch(er) { toast('Server error','error'); }
}

function togglePw(inputId, iconId) {
  const inp=document.getElementById(inputId); const icon=document.getElementById(iconId);
  if(!inp) return;
  inp.type = inp.type==='password'?'text':'password';
  if(icon) icon.className=`fas fa-eye${inp.type==='text'?'-slash':''} input-right-icon`;
}

/* ══════════════════════════════════════════════
   ADMIN PANEL
══════════════════════════════════════════════ */
async function initAdmin() {
  if (!requireAuth(true)) return;
  updateNavUser();
  await renderAdminDashboard();
  // Load unread enquiries count for badge
  try {
    const res = await api('GET', '/enquiries');
    if (res?.success) {
      const badge = document.getElementById('enquiries-unread-badge');
      const unread = res.data.unread;
      if (badge && unread > 0) { badge.textContent = unread; badge.style.display = 'inline-flex'; }
    }
  } catch(e) {}
  // Auto-refresh every 30 seconds
  if (!window._adminRefreshTimer) {
    window._adminRefreshTimer = setInterval(() => {
      const ordersPanel = document.querySelector('[data-panel="orders"]:not(.hidden)');
      const dashPanel   = document.querySelector('[data-panel="dashboard"]:not(.hidden)');
      if (ordersPanel) loadAdminOrders(document.getElementById('orders-status-filter')?.value || '');
      if (dashPanel)   loadDashboardOrders();
    }, 30000);
  }
}

async function renderAdminDashboard() {
  try {
    const res = await api('GET', '/admin/dashboard');
    if (res?.success) {
      const d = res.data;
      // Show TOTAL values (always have data) with today's as subtitle
      const set = (id, val) => { const el=document.getElementById(id); if(el) el.textContent=val; };
      set('stat-today-orders', (d.total_orders ?? 0).toLocaleString('en-IN'));
      set('stat-today-sales',  '₹'+(d.total_sales ?? 0).toLocaleString('en-IN',{maximumFractionDigits:0}));
      set('stat-total-users',  (d.total_users  ?? 0).toLocaleString('en-IN'));
      set('stat-pending',      (d.pending_orders ?? 0).toLocaleString('en-IN'));
      set('stat-sub-orders',   `+${d.today_orders ?? 0} today`);
      set('stat-sub-sales',    `+₹${(d.today_sales ?? 0).toLocaleString('en-IN',{maximumFractionDigits:0})} today`);
      const ti = document.getElementById('top-items-wrap');
      if (ti) {
        if (d.top_items && d.top_items.length) {
          const medals = ['🥇','🥈','🥉'];
          ti.innerHTML = d.top_items.map((item, i) => `
            <div style="display:flex;align-items:center;gap:12px;padding:10px 14px;background:var(--surface2);border-radius:12px;margin-bottom:8px">
              <span style="font-size:22px">${medals[i]||'🍽️'}</span>
              <div style="flex:1">
                <div style="font-weight:600;font-size:14px">${item.name}</div>
                <div style="font-size:12px;color:var(--text-3)">${item.quantity} orders placed</div>
              </div>
              <div style="font-size:20px;font-weight:800;color:var(--primary)">${item.quantity}</div>
            </div>`).join('');
        } else {
          ti.innerHTML = '<p style="color:var(--text-3);font-size:13px;padding:4px 0">No orders yet</p>';
        }
      }
    } else {
      console.error('Dashboard API failed:', res?.message);
    }
  } catch(e) { console.error('Dashboard error:', e); }
  await Promise.all([loadAdminMenu(), loadDashboardOrders()]);
}

function animCount(id, target, prefix='') {
  const el = document.getElementById(id);
  if (!el) return;
  const isCurrency = prefix === '₹';
  const numTarget = parseFloat(target) || 0;
  if (numTarget === 0) { el.textContent = isCurrency ? '₹0' : '0'; return; }
  let cur = 0;
  const step = Math.max(numTarget / 50, 1);
  const t = setInterval(() => {
    cur = Math.min(cur + step, numTarget);
    el.textContent = isCurrency
      ? '₹' + Math.floor(cur).toLocaleString('en-IN')
      : Math.floor(cur).toLocaleString('en-IN');
    if (cur >= numTarget) {
      el.textContent = isCurrency
        ? '₹' + numTarget.toLocaleString('en-IN', {minimumFractionDigits:0, maximumFractionDigits:0})
        : Math.round(numTarget).toLocaleString('en-IN');
      clearInterval(t);
    }
  }, 25);
}

async function loadAdminMenu() {
  const list = document.getElementById('admin-menu-list');
  if (!list) return;
  list.innerHTML='<div style="text-align:center;padding:20px"><i class="fas fa-spinner spin"></i></div>';
  try {
    const res = await api('GET', `/menu/items?canteen_id=${CANTEEN_ID}`);
    if (res?.success) {
      const items = res.data;
      list.innerHTML = items.map(item=>`
        <div class="admin-item">
          <img class="admin-item-thumb" src="${item.image_url||''}" alt="${item.name}" onerror="this.style.display='none'">
          <div class="admin-item-info">
            <div class="admin-item-name">${item.name}</div>
            <div class="admin-item-price">₹${item.price} · ${item.category_name||''} · ${item.is_available?'<span style="color:var(--success)">Available</span>':'<span style="color:var(--danger)">Unavailable</span>'}</div>
          </div>
          <div class="admin-item-acts">
            <button class="icon-btn edit" onclick="openEditItem(${item.id})" title="Edit"><i class="fas fa-pen"></i></button>
            <button class="icon-btn trash" onclick="deleteItem(${item.id})" title="Delete"><i class="fas fa-trash"></i></button>
          </div>
        </div>`).join('');
    }
  } catch(e) { list.innerHTML='<p style="padding:14px;color:var(--text-2)">Could not load items</p>'; }
}

async function loadDashboardOrders() {
  const tb = document.getElementById('dashboard-orders-body');
  if (!tb) return;
  try {
    const res = await api('GET', '/orders/all');
    if (res?.success) {
      const statuses = ['pending','confirmed','preparing','ready','completed','cancelled'];
      tb.innerHTML = res.data.slice(0,10).map(o => buildOrderRow(o, statuses)).join('')
        || '<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--text-2)">No orders yet</td></tr>';
    }
  } catch(e) {}
}

function buildOrderRow(o, statuses) {
  const canDelete = o.status === 'cancelled' || o.is_refunded;
  return `<tr>
    <td><strong>#${o.id}</strong><div style="font-size:11px;color:var(--text-3)">Token ${o.token_number||'—'}</div></td>
    <td><div style="font-weight:600">${o.user_name||'—'}</div><div style="font-size:11px;color:var(--text-3)">${o.user_email||''}</div></td>
    <td style="max-width:160px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${(o.items||[]).map(x=>x.name).join(', ')}">${(o.items||[]).map(x=>`${x.name} ×${x.quantity}`).join(', ')||'—'}</td>
    <td><strong>${fmt(o.total_amount)}</strong></td>
    <td><span class="badge ${o.status}">${o.status}</span></td>
    <td>
      <select class="status-select" onchange="adminSetStatus(${o.id},this.value,this)">
        ${statuses.map(s=>`<option ${s===o.status?'selected':''} value="${s}">${s.charAt(0).toUpperCase()+s.slice(1)}</option>`).join('')}
      </select>
    </td>
    <td style="display:flex;gap:4px;align-items:center">
      <button class="btn btn-ghost btn-sm" onclick="adminViewReceipt(${o.id})"><i class="fas fa-receipt"></i></button>
      ${canDelete ? `<button class="icon-btn trash" title="Delete order log" onclick="showDeleteOrderModal(${o.id})"><i class="fas fa-trash"></i></button>` : ''}
    </td>
  </tr>`;
}

async function loadAdminOrders(status='') {
  const tb = document.getElementById('admin-orders-body');
  if (!tb) return;
  tb.innerHTML='<tr><td colspan="7" style="text-align:center;padding:16px"><i class="fas fa-spinner spin"></i></td></tr>';
  try {
    const url = status ? `/orders/all?status=${status}` : '/orders/all';
    const res = await api('GET', url);
    if (res?.success) {
      const statuses = ['pending','confirmed','preparing','ready','completed','cancelled'];
      tb.innerHTML = res.data.map(o => buildOrderRow(o, statuses)).join('')
        || '<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--text-2)">No orders found</td></tr>';
    }
  } catch(e) { if(tb) tb.innerHTML='<tr><td colspan="7" style="text-align:center;padding:16px;color:var(--danger)">Server error</td></tr>'; }
}

async function adminSetStatus(orderId, status, selectEl) {
  try {
    const res = await api('PUT', `/orders/${orderId}/status`, {status});
    if (res?.success) {
      toast(`Order #${orderId} → ${status}`, 'success');
      // Update the badge in the same row in real time
      const row = selectEl?.closest('tr');
      if (row) {
        const badge = row.querySelector('.badge');
        if (badge) { badge.className = `badge ${status}`; badge.textContent = status; }
      }
      // Also refresh dashboard if it's visible
      const dashPanel = document.querySelector('[data-panel="dashboard"]:not(.hidden)');
      if (dashPanel) renderAdminDashboard();
    } else {
      toast('Failed to update status', 'error');
    }
  } catch(e) { toast('Server error','error'); }
}

async function adminViewReceipt(orderId) {
  const body = document.getElementById('admin-receipt-body');
  if (!body) return;
  body.innerHTML='<div style="text-align:center;padding:20px"><i class="fas fa-spinner spin"></i></div>';
  openModal('admin-receipt-modal');
  try {
    const res = await api('GET', `/orders/${orderId}`);
    if (res?.success) {
      const o = res.data;
      const payRes = await api('GET', `/payments/order/${orderId}`).catch(()=>null);
      const pay = payRes?.data;
      body.innerHTML = `<div class="receipt">
        <div class="receipt-header">
          <div class="receipt-logo">🍽️</div>
          <div class="receipt-title">Smart Canteen</div>
          <div class="receipt-sub">Admin Copy · Order Receipt</div>
        </div>
        <div class="receipt-section">
          <div class="receipt-section-title">Customer Info</div>
          <div class="receipt-row"><span>Name</span><span>${o.user_name||'—'}</span></div>
          <div class="receipt-row"><span>Email</span><span>${o.user_email||'—'}</span></div>
          <div class="receipt-row"><span>User ID</span><span>#${o.user_id}</span></div>
        </div>
        <div class="receipt-section">
          <div class="receipt-section-title">Order Info</div>
          <div class="receipt-row"><span>Order ID</span><span>#ORD-${o.id}</span></div>
          <div class="receipt-row"><span>Token</span><span class="fw-700 text-primary">#${o.token_number}</span></div>
          <div class="receipt-row"><span>Date</span><span>${fmtDateTime(o.order_time)}</span></div>
          <div class="receipt-row"><span>Status</span><span class="badge ${o.status}">${o.status}</span></div>
        </div>
        <div class="receipt-section">
          <div class="receipt-section-title">Items</div>
          ${(o.items||[]).map(item=>`<div class="receipt-row"><span>${item.name} × ${item.quantity}</span><span>${fmt(item.price*item.quantity)}</span></div>`).join('')}
        </div>
        <div class="receipt-row receipt-total"><span>Total</span><span>${fmt(o.total_amount)}</span></div>
        ${pay?`<div class="receipt-section" style="margin-top:12px"><div class="receipt-section-title">Payment</div>
          <div class="receipt-row"><span>Method</span><span>${(pay.payment_method||'').toUpperCase()}</span></div>
          <div class="receipt-row"><span>Status</span><span>${pay.payment_status}</span></div>
          <div class="receipt-row"><span>Transaction</span><span style="font-size:11px">${pay.transaction_id||'—'}</span></div></div>`:''}
        <div class="receipt-footer">Smart Canteen Admin System</div>
      </div>
      <div style="display:flex;gap:10px;margin-top:18px">
        <button class="btn btn-outline btn-sm" style="flex:1" onclick="printReceipt()"><i class="fas fa-print"></i> Print</button>
        <button class="btn btn-ghost btn-sm" style="flex:1" onclick="closeModal('admin-receipt-modal')">Close</button>
      </div>`;
    }
  } catch(e) {}
}

/* Admin add/edit items */
let _editingItemId = null;
async function openEditItem(id) {
  _editingItemId = id;
  try {
    const res = await api('GET', `/menu/items/${id}`);
    if (res?.success) {
      const item = res.data;
      document.getElementById('edit-item-name').value  = item.name;
      document.getElementById('edit-item-price').value = item.price;
      document.getElementById('edit-item-desc').value  = item.description||'';
      document.getElementById('edit-item-img').value   = item.image_url||'';
      document.getElementById('edit-item-avail').value = item.is_available?'1':'0';
    }
  } catch(e) {}
  openModal('edit-item-modal');
}

async function saveEditItem(e) {
  e.preventDefault();
  const data = {
    name:         document.getElementById('edit-item-name').value.trim(),
    price:        parseFloat(document.getElementById('edit-item-price').value),
    description:  document.getElementById('edit-item-desc').value.trim(),
    image_url:    document.getElementById('edit-item-img').value.trim(),
    is_available: document.getElementById('edit-item-avail').value==='1',
  };
  try {
    const res = await api('PUT', `/menu/items/${_editingItemId}`, data);
    if (res?.success) { toast('Item updated!','success'); closeModal('edit-item-modal'); loadAdminMenu(); }
    else toast(res?.message||'Failed','error');
  } catch(e) { toast('Server error','error'); }
}

async function deleteItem(id) {
  if (!confirm('Delete this menu item? This cannot be undone.')) return;
  try {
    const res = await api('DELETE', `/menu/items/${id}`);
    if (res?.success) { toast('Item deleted','info'); loadAdminMenu(); }
    else toast('Failed to delete','error');
  } catch(e) { toast('Server error','error'); }
}

async function submitAddItem(e) {
  e.preventDefault();
  const name  = document.getElementById('add-name').value.trim();
  const price = parseFloat(document.getElementById('add-price').value);
  const desc  = document.getElementById('add-desc').value.trim();
  const img   = document.getElementById('add-img').value.trim();
  const catId = parseInt(document.getElementById('add-cat').value);
  if (!name || !price || !catId) { toast('Fill required fields','error'); return; }
  try {
    const res = await api('POST', '/menu/items', {
      canteen_id:CANTEEN_ID, category_id:catId, name, price, description:desc, image_url:img,
    });
    if (res?.success) { toast(`${name} added!`,'success'); closeModal('add-item-modal'); loadAdminMenu(); e.target.reset(); }
    else toast(res?.message||'Failed','error');
  } catch(er) { toast('Server error','error'); }
}

let _allStudents = [];

async function loadAdminUsers() {
  const tb = document.getElementById('admin-users-body');
  const countEl = document.getElementById('student-count');
  if (!tb) return;
  tb.innerHTML='<tr><td colspan="6" style="text-align:center;padding:16px"><i class="fas fa-spinner spin"></i></td></tr>';
  try {
    const res = await api('GET', '/admin/users?role=student');
    if (res?.success) {
      _allStudents = res.data;
      renderStudentTable(_allStudents);
      if (countEl) countEl.textContent = `${_allStudents.length} student${_allStudents.length!==1?'s':''} registered`;
    }
  } catch(e) { if(tb) tb.innerHTML='<tr><td colspan="6" style="text-align:center;padding:16px;color:var(--danger)">Server error</td></tr>'; }
}

function renderStudentTable(students) {
  const tb = document.getElementById('admin-users-body');
  if (!tb) return;
  if (!students.length) {
    tb.innerHTML='<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text-2)">No students found</td></tr>';
    return;
  }
  tb.innerHTML = students.map(u=>`
    <tr>
      <td><strong>#${u.id}</strong></td>
      <td><strong>${u.name}</strong></td>
      <td>${u.email}</td>
      <td>${u.phone||'—'}</td>
      <td>${fmtDate(u.created_at)}</td>
      <td>${u.order_count ?? '—'}</td>
    </tr>`).join('');
}

function filterStudents(query) {
  const countEl = document.getElementById('student-count');
  if (!query.trim()) {
    renderStudentTable(_allStudents);
    if (countEl) countEl.textContent = `${_allStudents.length} student${_allStudents.length!==1?'s':''} registered`;
    return;
  }
  const q = query.toLowerCase();
  const filtered = _allStudents.filter(u =>
    u.name.toLowerCase().includes(q) ||
    u.email.toLowerCase().includes(q) ||
    (u.phone||'').toLowerCase().includes(q)
  );
  renderStudentTable(filtered);
  if (countEl) countEl.textContent = `${filtered.length} of ${_allStudents.length} students match "${query}"`;
}

/* Admin tab switching */
function switchAdminTab(tab) {
  document.querySelectorAll('.admin-tab').forEach(t=>t.classList.toggle('active',t.dataset.tab===tab));
  document.querySelectorAll('.admin-tab-panel').forEach(p=>p.classList.toggle('hidden',p.dataset.panel!==tab));
  document.querySelectorAll('.sidebar-item[onclick]').forEach(item => {
    const fn = item.getAttribute('onclick') || '';
    item.classList.toggle('active', fn.includes(`'${tab}'`));
  });
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (sidebar) sidebar.classList.remove('open');
  if (backdrop) backdrop.classList.remove('show');
  document.body.style.overflow = '';
  if (tab==='orders')    loadAdminOrders('');
  if (tab==='users')     loadAdminUsers();
  if (tab==='menu')      loadAdminMenu();
  if (tab==='dashboard') renderAdminDashboard();
  if (tab==='reviews')   loadAdminReviews();
  if (tab==='enquiries') loadAdminEnquiries();
  if (tab==='refunds')   loadAdminRefunds();
}

async function loadAdminRefunds() {
  const tb = document.getElementById('admin-refunds-body');
  if (!tb) return;
  tb.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:16px"><i class="fas fa-spinner spin"></i></td></tr>';
  try {
    const res = await api('GET', '/admin/refunds');
    if (res?.success) {
      const refunds = res.data;
      if (!refunds.length) {
        tb.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--text-2)">No refund requests yet</td></tr>';
        return;
      }
      tb.innerHTML = refunds.map(r => `
        <tr>
          <td><strong>#${r.order_id}</strong></td>
          <td>
            <div style="font-weight:600">${r.user_name}</div>
            <div style="font-size:11px;color:var(--text-3)">${r.user_email}</div>
          </td>
          <td><strong style="color:var(--primary)">₹${r.amount.toLocaleString('en-IN')}</strong></td>
          <td>
            <div style="font-weight:600">${r.user_phone||'—'}</div>
            <div style="font-size:11px;color:var(--text-3)">Registered phone</div>
          </td>
          <td><span class="badge ${r.status}" style="font-size:11px">${r.status.replace('_',' ')}</span></td>
          <td>
            ${r.otp ? `<div style="font-family:monospace;font-size:18px;font-weight:800;letter-spacing:3px;color:var(--primary);background:var(--primary-soft);padding:6px 12px;border-radius:8px;text-align:center">${r.otp}</div>
            <div style="font-size:10px;color:var(--text-3);text-align:center;margin-top:2px">Show to student</div>` : '<span style="color:var(--text-3);font-size:12px">—</span>'}
          </td>
          <td>
            ${r.status === 'refunded' 
              ? '<span style="color:var(--success);font-size:13px;font-weight:600"><i class="fas fa-check-circle"></i> Refunded</span>' 
              : r.status === 'otp_sent'
                ? `<div style="display:flex;flex-direction:column;gap:6px">
                     <div style="display:flex;gap:4px">
                       <input type="text" id="otp-input-${r.id}" class="form-input" style="padding:6px 10px;font-size:13px;letter-spacing:2px;font-family:monospace;max-width:90px" placeholder="OTP" maxlength="6">
                       <button class="btn btn-primary btn-sm" onclick="verifyRefundOTP(${r.id})" style="white-space:nowrap">Verify</button>
                     </div>
                     <button class="btn btn-ghost btn-sm" onclick="sendRefundOTP(${r.id})" style="font-size:11px">Resend OTP</button>
                   </div>`
                : `<button class="btn btn-primary btn-sm" onclick="sendRefundOTP(${r.id})"><i class="fas fa-paper-plane"></i> Send OTP</button>`
            }
          </td>
        </tr>`).join('');
    }
  } catch(e) { tb.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--danger)">Server error</td></tr>'; }
}

async function sendRefundOTP(refundId) {
  try {
    const res = await api('POST', `/refunds/${refundId}/send-otp`, {});
    if (res?.success) {
      toast(`OTP sent: ${res.data.otp} — Show to student`, 'success');
      loadAdminRefunds();
    } else {
      toast(res?.message || 'Failed to send OTP', 'error');
    }
  } catch(e) { toast('Server error', 'error'); }
}

async function verifyRefundOTP(refundId) {
  const otp = document.getElementById(`otp-input-${refundId}`)?.value.trim();
  if (!otp || otp.length !== 6) { toast('Enter the 6-digit OTP', 'error'); return; }
  try {
    const res = await api('POST', `/refunds/${refundId}/verify`, {otp});
    if (res?.success) {
      toast('Refund confirmed! Cash paid to student.', 'success');
      loadAdminRefunds();
    } else {
      toast(res?.message || 'Verification failed', 'error');
    }
  } catch(e) { toast('Server error', 'error'); }
}

async function loadAdminReviews() {
  const tb = document.getElementById('admin-reviews-body');
  if (!tb) return;
  tb.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:16px"><i class="fas fa-spinner spin"></i></td></tr>';
  try {
    const res = await api('GET', '/admin/reviews');
    if (res?.success) {
      const reviews = res.data;
      if (!reviews.length) {
        tb.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text-2)">No reviews yet</td></tr>';
        return;
      }
      tb.innerHTML = reviews.map(r => `
        <tr>
          <td><strong>${r.user_name||'—'}</strong></td>
          <td>${r.item_name ? `<span style="font-size:12px;background:var(--surface2);padding:3px 8px;border-radius:6px">${r.item_name}</span>` : '<span style="color:var(--text-3);font-size:12px">General</span>'}</td>
          <td><span style="color:#f59e0b">${'★'.repeat(r.rating)}${'☆'.repeat(5-r.rating)}</span> <span style="font-size:12px;color:var(--text-3)">${r.rating}/5</span></td>
          <td style="max-width:280px">${r.comment||'—'}</td>
          <td><span class="badge ${r.review_type}" style="font-size:11px">${r.review_type}</span></td>
          <td style="font-size:12px;color:var(--text-3)">${fmtDate(r.created_at)}</td>
        </tr>`).join('');
    }
  } catch(e) { tb.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--danger)">Server error</td></tr>'; }
}

async function loadAdminEnquiries() {
  const tb = document.getElementById('admin-enquiries-body');
  const badge = document.getElementById('enquiries-unread-badge');
  if (!tb) return;
  tb.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:16px"><i class="fas fa-spinner spin"></i></td></tr>';
  try {
    const res = await api('GET', '/enquiries');
    if (res?.success) {
      const { enquiries, unread } = res.data;
      if (badge) {
        badge.textContent = unread > 0 ? unread : '';
        badge.style.display = unread > 0 ? 'inline-flex' : 'none';
      }
      if (!enquiries.length) {
        tb.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text-2)">No enquiries yet</td></tr>';
        return;
      }
      tb.innerHTML = enquiries.map(e => `
        <tr style="${e.is_read ? '' : 'background:var(--primary-soft);'}">
          <td><strong>${e.name}</strong>${!e.is_read ? ' <span style="font-size:10px;background:var(--primary);color:#fff;padding:2px 6px;border-radius:10px">NEW</span>' : ''}</td>
          <td><a href="mailto:${e.email}" style="color:var(--primary)">${e.email}</a></td>
          <td>${e.phone||'—'}</td>
          <td><span class="badge" style="font-size:11px;background:var(--surface2);color:var(--text-2)">${e.type||'general'}</span></td>
          <td style="max-width:260px">${e.message}</td>
          <td>
            <div style="font-size:12px;color:var(--text-3)">${fmtDate(e.created_at)}</div>
            ${!e.is_read ? `<button class="btn btn-ghost btn-sm" style="margin-top:4px;font-size:11px;padding:3px 8px" onclick="markEnquiryRead(${e.id},this)"><i class="fas fa-check"></i> Mark Read</button>` : '<span style="font-size:11px;color:var(--success)"><i class="fas fa-check-circle"></i> Read</span>'}
          </td>
        </tr>`).join('');
    }
  } catch(e) { tb.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--danger)">Server error</td></tr>'; }
}

async function markEnquiryRead(id, btn) {
  try {
    const res = await api('PUT', `/enquiries/${id}`, {});
    if (res?.success) {
      loadAdminEnquiries(); // refresh
      toast('Marked as read', 'success');
    }
  } catch(e) {}
}

function updateNavUser() {
  const el = document.getElementById('nav-user-name');
  if (el && S.user) el.textContent = S.user.name;
}

/* ══════════════════════════════════════════════
   ADMIN PROFILE
══════════════════════════════════════════════ */
async function initAdminProfile() {
  if (!requireAuth(true)) return;
  renderAdminProfilePage();
}

function renderAdminProfilePage() {
  const user = S.user || {};
  const av = document.getElementById('admin-profile-avatar');
  const nm = document.getElementById('admin-profile-name');
  const em = document.getElementById('admin-profile-email');
  const ph = document.getElementById('admin-profile-phone');
  if (av) av.textContent=(user.name||'A').charAt(0).toUpperCase();
  if (nm) nm.textContent=user.name||'';
  if (em) em.textContent=user.email||'';
  if (ph) ph.textContent=user.phone||'Not set';
  const fn = document.getElementById('admin-edit-name');
  const fe = document.getElementById('admin-edit-email');
  const fp = document.getElementById('admin-edit-phone');
  if (fn) fn.value=user.name||'';
  if (fe) fe.value=user.email||'';
  if (fp) fp.value=user.phone||'';
  const tt = document.getElementById('admin-theme-toggle');
  if (tt) tt.classList.toggle('on', S.theme==='dark');
}

async function saveAdminProfile(e) {
  e.preventDefault();
  const data = {
    name: document.getElementById('admin-edit-name')?.value.trim(),
    email:document.getElementById('admin-edit-email')?.value.trim(),
    phone:document.getElementById('admin-edit-phone')?.value.trim(),
  };
  const cp=document.getElementById('admin-current-pw')?.value;
  const np=document.getElementById('admin-new-pw')?.value;
  if (cp && np) { data.current_password=cp; data.new_password=np; }
  try {
    const res = await api('PUT','/auth/profile',data);
    if (res?.success) { saveAuth(res.data,S.token); renderAdminProfilePage(); toast('Profile updated!','success'); closeModal('admin-edit-modal'); }
    else toast(res?.message||'Failed','error');
  } catch(e) { toast('Server error','error'); }
}

/* ══════════════════════════════════════════════
   CONTACT PAGE
══════════════════════════════════════════════ */
async function submitContactForm(e) {
  e.preventDefault();
  const btn = e.target.querySelector('[type=submit]');
  if (btn) { btn.disabled=true; btn.innerHTML='<i class="fas fa-spinner spin"></i> Sending…'; }
  const name    = document.getElementById('c-name')?.value.trim();
  const email   = document.getElementById('c-email')?.value.trim();
  const phone   = document.getElementById('c-phone')?.value.trim();
  const type    = document.getElementById('c-type')?.value;
  const message = document.getElementById('c-msg')?.value.trim();
  if (!name || !email || !message) {
    toast('Please fill all required fields', 'error');
    if (btn) { btn.disabled=false; btn.innerHTML='<i class="fas fa-paper-plane"></i> Send Message'; }
    return;
  }
  if (!validateEmail(email)) {
    toast('Invalid email address', 'error');
    if (btn) { btn.disabled=false; btn.innerHTML='<i class="fas fa-paper-plane"></i> Send Message'; }
    return;
  }
  try {
    const r = await fetch(API + '/enquiries', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({name, email, phone, type, message})
    });
    const res = await r.json();
    if (res?.success) {
      toast('Message sent! We\'ll get back to you soon.', 'success');
      e.target.reset();
    } else {
      toast(res?.message || 'Failed to send message', 'error');
    }
  } catch(err) {
    toast('Could not connect to server', 'error');
  }
  if (btn) { btn.disabled=false; btn.innerHTML='<i class="fas fa-paper-plane"></i> Send Message'; }
}

/* ══════════════════════════════════════════════
   INIT
══════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  applyTheme(S.theme);
  initSplash();
  initSidebar();
  cartBadge();

  document.querySelectorAll('.overlay,.dialog-overlay').forEach(ov => {
    ov.addEventListener('click', e => { if(e.target===ov) closeModal(ov.id); });
  });

  const page = document.body.dataset.page;
  if (page==='home')          initHome();
  if (page==='cart')          initCart();
  if (page==='orders')        initOrders();
  if (page==='profile')       initProfile();
  if (page==='transactions')  initTransactions();
  if (page==='reviews')       initReviews();
  if (page==='admin')         initAdmin();
  if (page==='admin-profile') initAdminProfile();
});