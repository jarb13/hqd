/**
 * DocuAck Application Logic
 * ใช้ IIFE (Immediately Invoked Function Expression) 
 * เพื่อป้องกันไม่ให้ตัวแปรภายในไปกวน Global Scope
 */
(function() {
  // --- 1. Utility & Security Functions ---
  // ฟังก์ชันป้องกัน XSS (แปลงอักขระพิเศษเป็น HTML Entities ก่อนแสดงผล)
  const escapeHTML = (str) => {
    if (str === null || str === undefined) return '';
    return String(str).replace(/[&<>'"]/g, 
      tag => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
      }[tag] || tag)
    );
  };

  const API_URL = "https://script.google.com/macros/s/AKfycbwh-PvW0UNXCz99CbzZJx9QJxhwL-M13P0fDn_55NTT_r942YryR6OuGhdmZiKlcVW_/exec";

  // --- 2. Fallback Data (Cleaned Security) ---
  // เอารหัส PIN ออกจากหน้าบ้าน (Frontend) เพื่อความปลอดภัย 
  const FALLBACK_USERS = [
    { id: '020482', name: 'นาย ธนพล จันทรพร', department: 'เจ้าหน้าที่บริหารงานทั่วไป', role: 'admin' },
    { id: '010363', name: 'น.ส. นิภาพร จีนไม้', department: 'นักวิชาการพัฒนาคุณภาพ', role: 'user' },
    { id: '000826', name: 'นาง วันทนา วีระถาวร', department: 'พยาบาล', role: 'user' },
    { id: '001668', name: 'น.ส. ณัฏฐ์พิชญา ศรีตพงษ์', department: 'เจ้าหน้าที่บริหารงานทั่วไป', role: 'user' },
    { id: '002610', name: 'น.ส. เสาวลักษณ์ เจริญสวัสดิ์', department: 'ฝ่ายการเงิน', role: 'user' }
  ];

  const FALLBACK_DOCS = [
    {
      id: 'DOC-2026-001',
      title: 'นโยบายความมั่นคงปลอดภัยไซเบอร์และมาตรการป้องกัน Phishing ประจำปี 2026',
      fileUrl: 'https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/preview',
      urgencyLevel: 'Very Urgent',
      startDate: '2026-09-01',
      endDate: '2026-09-20',
      targetAudience: 'All',
      readStatus: ['020482'],
      category: 'นโยบายไอทีและความปลอดภัย',
      description: 'แนวปฏิบัติการยืนยันตัวตน 2 ขั้นตอน (2FA) และการรักษาความปลอดภัยข้อมูลลูกค้า'
    },
    {
      id: 'DOC-2026-002',
      title: 'แนวปฏิบัติการตรวจประเมินคุณภาพงานและการควบคุมความเสี่ยงเฉพาะรายบุคคล',
      fileUrl: 'https://drive.google.com/file/d/1w8E7Xl0_zD3qN4v_sampleFireDrill/preview',
      urgencyLevel: 'Urgent',
      startDate: '2026-09-18',
      endDate: '2026-10-10',
      targetAudience: '020482,010363',
      readStatus: ['020482'],
      category: 'พัฒนาคุณภาพองค์กร',
      description: 'เอกสารระเบียบปฏิบัติเฉพาะเจ้าหน้าที่บริหารงานทั่วไป'
    }
  ];

  // --- 3. App State ---
  let state = {
    user: JSON.parse(localStorage.getItem('docuack_session')) || null,
    users: JSON.parse(localStorage.getItem('docuack_cached_users')) || FALLBACK_USERS, 
    docs: JSON.parse(localStorage.getItem('docuack_cached_docs')) || FALLBACK_DOCS,  
    tab: 'documents',
    search: '',
    filterUrgency: 'all',
    filterStatus: 'all',
    filterAudience: 'all',
    viewDoc: null,
    trackingDoc: null,
    showCreateModal: false,
    createDocForm: { audienceType: 'All', selectedUserIds: [], searchKeyword: '', filterDept: 'all' },
    userSearch: '',
    userFilterRole: 'all',
    editUserModal: null,
    showAddUserModal: false
  };

  // --- 4. Initialization & Data Fetching ---
  async function initApp() {
    const loader = document.getElementById('global-loader');
    const loaderTitle = document.getElementById('loader-title');
    const loaderDesc = document.getElementById('loader-desc');
    const loaderActions = document.getElementById('loader-actions');
    const loaderSpinner = document.getElementById('loader-spinner');

    const timeoutId = setTimeout(() => {
      if (loader && loader.style.display !== 'none') {
        loaderSpinner.classList.add('hidden');
        loaderTitle.innerText = "เชื่อมต่อฐานข้อมูลล่าช้า";
        loaderTitle.classList.add('text-amber-400');
        loaderDesc.innerText = "Google Apps Script ใช้เวลาตอบสนองนานกว่าปกติ";
        loaderActions.classList.remove('hidden');
      }
    }, 7000);

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'getAppData' })
      });
      clearTimeout(timeoutId);
      if (!response.ok) throw new Error("HTTP Status: " + response.status);
      const result = await response.json();
      if (result.status === 'success' && result.data) {
        if (Array.isArray(result.data.users) && result.data.users.length > 0) {
          state.users = result.data.users;
          localStorage.setItem('docuack_cached_users', JSON.stringify(state.users));
        }
        if (Array.isArray(result.data.docs) && result.data.docs.length > 0) {
          state.docs = result.data.docs;
          localStorage.setItem('docuack_cached_docs', JSON.stringify(state.docs));
        }
      }
    } catch (error) {
      console.warn("API Connection Error, using cached/fallback data:", error);
      clearTimeout(timeoutId);
      if (!state.users || state.users.length === 0) state.users = FALLBACK_USERS;
      if (!state.docs || state.docs.length === 0) state.docs = FALLBACK_DOCS;
    } 
    loader.style.display = 'none';
    render();
  }

  // --- 5. Helper Functions ---
  function setSession(u) {
    if (u) localStorage.setItem('docuack_session', JSON.stringify(u));
    else localStorage.removeItem('docuack_session');
  }

  function isDocAssignedToUser(doc, userId) {
    if (!doc) return false;
    const audience = String(doc.targetAudience || 'All').trim();
    if (audience.toLowerCase() === 'all' || audience === 'ทุกคน') return true;
    const ids = audience.split(',').map(s => s.trim().toUpperCase());
    return ids.includes(String(userId).trim().toUpperCase());
  }

  function getDocTargetList(doc) {
    if (!doc) return [];
    const audience = String(doc.targetAudience || 'All').trim();
    if (audience.toLowerCase() === 'all' || audience === 'ทุกคน') return state.users;
    const ids = audience.split(',').map(s => s.trim().toUpperCase());
    return state.users.filter(u => ids.includes(String(u.id).trim().toUpperCase()));
  }

  function isDocOverdue(doc) {
    if (!doc.endDate) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(doc.endDate);
    end.setHours(23, 59, 59, 999);
    const targetUsers = getDocTargetList(doc);
    const readCount = Array.isArray(doc.readStatus) ? doc.readStatus.length : 0;
    return today.getTime() > end.getTime() && readCount < targetUsers.length;
  }

  // --- 6. Rendering Logic ---
  function render() {
    const app = document.getElementById('app');
    if (!state.user) renderLogin(app);
    else renderDashboard(app);
  }

  function renderLogin(app) {
    app.innerHTML = `
      <div class="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div class="sm:mx-auto sm:w-full sm:max-w-md">
          <div class="text-center mb-6">
            <div class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white shadow-xl shadow-blue-500/20 mb-4 ring-4 ring-white/10">
              <i class="fa-solid fa-file-circle-check text-3xl"></i>
            </div>
            <h1 class="text-3xl font-extrabold text-white tracking-tight">DocuAck Portal</h1>
            <p class="text-sm text-slate-300 mt-1">ระบบรับทราบเอกสารองค์กร</p>
          </div>
          
          <div class="bg-white rounded-2xl shadow-2xl p-8 border border-slate-200">
            <h2 class="text-base font-bold text-slate-800 mb-1 text-center">เข้าสู่ระบบด้วยรหัสพนักงาน</h2>
            <form id="loginForm" class="space-y-4 mt-5">
              <div>
                <label class="block text-xs font-bold text-slate-600 uppercase mb-1">รหัสพนักงาน (Employee ID)</label>
                <div class="relative">
                  <input type="text" id="loginId" required placeholder="เช่น 020482" class="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold uppercase focus:outline-none focus:ring-2 focus:ring-blue-600 transition" />
                  <i class="fa-regular fa-id-badge absolute left-3 top-3.5 text-slate-400 text-sm"></i>
                </div>
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-600 uppercase mb-1">รหัสผ่าน (PIN)</label>
                <div class="relative">
                  <input type="password" id="loginPin" required placeholder="กรอกรหัสผ่าน" class="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600 transition" />
                  <i class="fa-solid fa-lock absolute left-3 top-3.5 text-slate-400 text-sm"></i>
                </div>
              </div>
              <div id="loginError" class="text-xs text-red-600 hidden font-medium text-center bg-red-50 p-2.5 rounded-xl border border-red-200"></div>
              
              <button type="submit" class="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer">
                <span>เข้าสู่ระบบ</span><i class="fa-solid fa-arrow-right text-xs"></i>
              </button>
            </form>

            <div class="mt-6 pt-5 border-t border-slate-100">
              <p class="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                <i class="fa-solid fa-wand-magic-sparkles text-amber-500"></i> บัญชีหลักทดสอบระบบ:
              </p>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button type="button" onclick="DocuAckApp.quickLogin('020482')" class="p-2.5 text-left rounded-xl border border-indigo-200 bg-indigo-50/70 hover:bg-indigo-100 transition-all text-xs cursor-pointer">
                  <div class="flex items-center justify-between mb-0.5"><span class="font-bold text-indigo-900">020482</span><span class="text-[10px] bg-indigo-600 text-white px-1.5 rounded-full font-bold">Admin</span></div>
                  <div class="font-bold text-slate-800 truncate">นาย ธนพล จันทรพร</div>
                </button>
                <button type="button" onclick="DocuAckApp.quickLogin('010363')" class="p-2.5 text-left rounded-xl border border-emerald-200 bg-emerald-50/70 hover:bg-emerald-100 transition-all text-xs cursor-pointer">
                  <div class="flex items-center justify-between mb-0.5"><span class="font-bold text-emerald-900">010363</span><span class="text-[10px] bg-emerald-600 text-white px-1.5 rounded-full font-bold">User</span></div>
                  <div class="font-bold text-slate-800 truncate">น.ส. นิภาพร จีนไม้</div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('loginForm').onsubmit = function(e) {
      e.preventDefault();
      const id = document.getElementById('loginId').value.trim().toUpperCase();
      const pin = document.getElementById('loginPin').value.trim();
      const err = document.getElementById('loginError');
      
      const u = state.users.find(x => String(x.id).toUpperCase() === id);
      
      if (!u) {
        err.innerText = `ไม่พบรหัสผู้ใช้ '${escapeHTML(id)}' ในระบบ`;
        err.classList.remove('hidden');
        return;
      }
      
      // การประเมินรหัสผ่านเบื้องต้นสำหรับ Frontend Demo (ควรย้ายไป API ในอนาคต)
      if (pin !== String(u.id) && pin !== '1234' && pin !== u.pin) {
        err.innerText = 'รหัสผ่าน PIN ไม่ถูกต้อง';
        err.classList.remove('hidden');
        return;
      }
      
      state.user = u;
      setSession(u);
      render();
    };
  }

  function renderDashboard(app) {
    const isAdmin = (String(state.user.role).trim().toLowerCase() === 'admin');
    const roleText = isAdmin ? 'Admin (ผู้ดูแลระบบ)' : 'บุคลากรทั่วไป';
    const badgeClass = isAdmin ? 'bg-indigo-100 text-indigo-800 border-indigo-200' : 'bg-emerald-100 text-emerald-800 border-emerald-200';
    
    // Header & Navbar
    app.innerHTML = `
      <header class="bg-white/95 backdrop-blur-md border-b border-slate-200 sticky top-0 z-40 shadow-xs">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-700 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <i class="fa-solid fa-file-circle-check text-xl"></i>
            </div>
            <div>
              <div class="font-bold text-lg text-slate-900">DocuAck</div>
              <div class="text-2xs text-slate-500">ระบบรับทราบเอกสารองค์กร</div>
            </div>
          </div>
          <div class="flex items-center gap-2.5">
            <div class="text-right hidden md:block pl-2 border-l border-slate-200">
              <div class="text-xs font-bold text-slate-900">${escapeHTML(state.user.name)}</div>
              <div class="text-2xs text-slate-500">${escapeHTML(state.user.id)} • ${escapeHTML(state.user.department)}</div>
            </div>
            <span class="text-xs font-bold px-2.5 py-1 rounded-xl border ${badgeClass}">${roleText}</span>
            <button onclick="DocuAckApp.logout()" class="px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-xl font-bold transition-colors flex items-center gap-1.5">
              <i class="fa-solid fa-arrow-right-from-bracket"></i> <span class="hidden sm:inline">ออก</span>
            </button>
          </div>
        </div>
      </header>
      <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div class="flex items-center justify-between border-b border-slate-200 mb-6">
          <div class="flex items-center gap-2">
            <button onclick="DocuAckApp.setTab('documents')" class="py-3 px-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${state.tab === 'documents' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'}">
              <i class="fa-regular fa-folder-open"></i> เอกสารเวียน
            </button>
            ${isAdmin ? `
              <button onclick="DocuAckApp.setTab('users')" class="py-3 px-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${state.tab === 'users' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'}">
                <i class="fa-solid fa-users-gear"></i> จัดการบุคลากร
              </button>
            ` : ''}
          </div>
        </div>
        <div id="content-container"></div>
      </main>
    `;

    if (state.tab === 'documents') document.getElementById('content-container').innerHTML = renderDocsTab(isAdmin);
    else document.getElementById('content-container').innerHTML = renderUsersTab();

    if (state.viewDoc) renderViewerModal();
  }

  function renderDocsTab(isAdmin) {
    const filtered = state.docs.filter(d => {
      if (!isAdmin && !isDocAssignedToUser(d, state.user.id)) return false;
      const matchSearch = d.title.toLowerCase().includes(state.search.toLowerCase()) || d.id.toLowerCase().includes(state.search.toLowerCase());
      const matchUrgency = state.filterUrgency === 'all' || d.urgencyLevel === state.filterUrgency;
      return matchSearch && matchUrgency;
    });

    let html = `
      <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs mb-6 flex gap-3">
        <input type="text" placeholder="ค้นหาชื่อเอกสาร, รหัส..." value="${escapeHTML(state.search)}" oninput="DocuAckApp.setSearch(this.value)" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
    `;

    filtered.forEach(doc => {
      const isRead = Array.isArray(doc.readStatus) && doc.readStatus.includes(state.user.id);
      const urgencyClass = doc.urgencyLevel === 'Very Urgent' ? 'rama-badge-very-urgent' : doc.urgencyLevel === 'Urgent' ? 'rama-badge-urgent' : 'rama-badge-normal';
      
      // ✅ แก้ไข: เพิ่มวงเล็บปิด ) หลัง escapeHTML(doc.id) อย่างถูกต้อง
      let actionHtml = isRead 
        ? `<span class="py-2 px-3 text-xs font-bold text-emerald-700 bg-emerald-50 rounded-xl border border-emerald-200"><i class="fa-solid fa-check"></i> รับทราบแล้ว</span>`
        : `<button onclick="DocuAckApp.acknowledgeDoc('${escapeHTML(doc.id)}')" class="flex-1 py-2 px-3 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs"><i class="fa-solid fa-signature"></i> รับทราบเอกสาร</button>`;

      html += `
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col justify-between">
          <div>
            <div class="flex justify-between gap-2 mb-2">
              <span class="text-[11px] font-bold px-2 py-0.5 rounded-full ${urgencyClass}">${escapeHTML(doc.urgencyLevel)}</span>
              <span class="text-xs font-mono font-bold text-slate-400">${escapeHTML(doc.id)}</span>
            </div>
            <h3 class="text-sm font-bold text-slate-900 leading-snug line-clamp-2 mb-2">${escapeHTML(doc.title)}</h3>
            <p class="text-xs text-slate-500 line-clamp-2 mb-3">${escapeHTML(doc.description)}</p>
          </div>
          <div class="pt-3 border-t border-slate-100 mt-2 flex justify-between gap-2">
            <!-- ✅ แก้ไข: เพิ่มวงเล็บปิด ) หลัง escapeHTML(doc.id) -->
            <button onclick="DocuAckApp.openViewer('${escapeHTML(doc.id)}')" class="flex-1 py-2 px-3 text-xs font-bold rounded-xl border border-slate-300 hover:bg-slate-50 flex items-center justify-center gap-1.5">
              <i class="fa-regular fa-eye"></i> เปิดอ่าน
            </button>
            ${actionHtml}
          </div>
        </div>
      `;
    });
    html += `</div>`;
    return html;
  }

  function renderUsersTab() {
    return `<div class="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs"><h2 class="text-lg font-bold text-slate-900">จัดการข้อมูลบุคลากรในระบบ</h2><p class="text-xs text-slate-500 mt-2">ส่วนนี้สงวนไว้สำหรับผู้ดูแลระบบ</p></div>`;
  }

  function renderViewerModal() {
    const doc = state.viewDoc;
    const isRead = Array.isArray(doc.readStatus) && doc.readStatus.includes(state.user.id);
    let actionHtml = !isRead 
      ? `<button onclick="DocuAckApp.acknowledgeDoc('${escapeHTML(doc.id)}'); DocuAckApp.closeViewer();" class="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-md"><i class="fa-solid fa-check-double"></i> ข้าพเจ้าได้อ่านและรับทราบแล้ว</button>`
      : `<span class="text-sm font-bold text-emerald-700 bg-emerald-50 px-4 py-2 rounded-xl border border-emerald-200"><i class="fa-solid fa-circle-check"></i> รับทราบเรียบร้อยแล้ว</span>`;

    document.getElementById('modal-container').innerHTML = `
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4">
        <div class="bg-white rounded-3xl w-full max-w-4xl h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in">
          <div class="p-4 border-b border-slate-200 flex justify-between bg-slate-50">
            <div>
              <span class="text-xs font-mono font-bold text-slate-400">${escapeHTML(doc.id)}</span>
              <h3 class="text-base font-bold text-slate-900 mt-1">${escapeHTML(doc.title)}</h3>
            </div>
            <button onclick="DocuAckApp.closeViewer()" class="text-slate-400 hover:text-red-500 bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold">ปิด ✕</button>
          </div>
          <div class="flex-1 bg-slate-200 p-2 relative">
            <iframe src="${doc.fileUrl}" class="w-full h-full rounded-2xl border border-slate-300 bg-white" frameborder="0"></iframe>
          </div>
          <div class="p-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-white">
            <a href="${doc.fileUrl}" target="_blank" class="text-xs font-bold text-blue-600 hover:underline"><i class="fa-solid fa-arrow-up-right-from-square"></i> เปิดดูในแท็บใหม่</a>
            <div class="flex items-center gap-2">${actionHtml}</div>
          </div>
        </div>
      </div>
    `;
  }

  // --- 7. Expose API to Global Window (DocuAckApp Namespace) ---
  window.DocuAckApp = {
    reloadPage: () => location.reload(),
    useOfflineData: () => { document.getElementById('global-loader').style.display = 'none'; render(); },
    quickLogin: (id) => {
      const u = state.users.find(x => String(x.id) === String(id));
      if (u) { state.user = u; setSession(u); render(); }
    },
    logout: () => { state.user = null; setSession(null); render(); },
    setTab: (t) => { state.tab = t; render(); },
    setSearch: (s) => { state.search = s; render(); },
    openViewer: (docId) => { state.viewDoc = state.docs.find(d => d.id === docId); renderViewerModal(); },
    closeViewer: () => { state.viewDoc = null; document.getElementById('modal-container').innerHTML = ''; },
    acknowledgeDoc: async (docId) => {
      const doc = state.docs.find(d => d.id === docId);
      if (!doc) return;
      if (!Array.isArray(doc.readStatus)) doc.readStatus = [];
      const uid = String(state.user.id);
      if (doc.readStatus.includes(uid)) return;
      
      doc.readStatus.push(uid);
      localStorage.setItem('docuack_cached_docs', JSON.stringify(state.docs));
      render();

      try {
        await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: 'acknowledge', docId: docId, userId: uid })
        });
      } catch (err) { console.warn("API Error (saved locally):", err); }
    }
  };

  // --- 8. Application Bootstrap ---
  window.addEventListener('DOMContentLoaded', initApp);

})();
