/**
 * DocuAck Application Logic
 * โครงสร้างแยกไฟล์ (Separation of Concerns) สำหรับ GitHub + Vercel
 */
(function() {
  // ----------------------------------------------------
  // 1. Security & Utility Functions
  // ----------------------------------------------------
  const escapeHTML = (str) => {
    if (!str) return '';
    return String(str).replace(/[&<>'"]/g, tag => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'}[tag] || tag));
  };

  const API_URL = "https://script.google.com/macros/s/AKfycbwh-PvW0UNXCz99CbzZJx9QJxhwL-M13P0fDn_55NTT_r942YryR6OuGhdmZiKlcVW_/exec";

  // ----------------------------------------------------
  // 2. State Management (Local Cache & Session)
  // ----------------------------------------------------
  let state = {
    user: JSON.parse(localStorage.getItem('docuack_session')) || null,
    users: JSON.parse(localStorage.getItem('docuack_cached_users')) || [],
    docs: JSON.parse(localStorage.getItem('docuack_cached_docs')) || [],
    tab: 'documents', // เริ่มต้นที่หน้าเอกสารเสมอ
    search: '',
    filterUrgency: 'all',
    viewDoc: null,
    trackingDoc: null,
    showCreateModal: false,
    showAddUserModal: false,
    editUserModal: null,
    createDocForm: { audienceType: 'All', selectedUserIds: [] }
  };

  // ----------------------------------------------------
  // 3. Core Logic & API Fetching (Optimistic Loading)
  // ----------------------------------------------------
  async function initApp() {
    const loader = document.getElementById('global-loader');
    const hasCache = state.users.length > 0 && state.docs.length > 0;
    
    if (hasCache) {
      // โชว์ UI ทันทีหากมี Cache แล้วแอบอัปเดตเบื้องหลัง
      loader.style.display = 'none';
      render();
      fetchDataFromGAS(false); 
    } else {
      // หากไม่มี Cache ต้องรอข้อมูลก่อน
      await fetchDataFromGAS(true);
      loader.style.display = 'none';
    }
  }

  async function fetchDataFromGAS(forceRender) {
    try {
      const response = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'getAppData' }) });
      const result = await response.json();
      if (result.status === 'success') {
        state.users = result.data.users || [];
        state.docs = result.data.docs || [];
        localStorage.setItem('docuack_cached_users', JSON.stringify(state.users));
        localStorage.setItem('docuack_cached_docs', JSON.stringify(state.docs));
        if (forceRender) render(); 
      }
    } catch (error) {
      console.error("API Error:", error);
    }
  }

  function isDocAssignedToUser(doc, userId) {
    if (!doc) return false;
    const audience = String(doc.targetAudience || 'All').trim();
    if (audience === 'All') return true;
    return audience.split(',').includes(String(userId));
  }

  // ----------------------------------------------------
  // 4. Rendering Logic (UI Views)
  // ----------------------------------------------------
  function render() {
    const root = document.getElementById('docuack-app-root');
    if (!state.user) renderLogin(root);
    else renderDashboard(root);
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
            <h2 class="text-base font-bold text-slate-800 mb-4 text-center">เข้าสู่ระบบด้วยรหัสพนักงาน</h2>
            <form id="loginForm" class="space-y-4">
              <div>
                <label class="block text-xs font-bold text-slate-600 uppercase mb-1">รหัสพนักงาน</label>
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
          </div>
        </div>
      </div>
    `;

    document.getElementById('loginForm').onsubmit = (e) => {
      e.preventDefault();
      const id = document.getElementById('loginId').value.trim().toUpperCase();
      const pin = document.getElementById('loginPin').value.trim();
      const err = document.getElementById('loginError');
      
      const u = state.users.find(x => String(x.id).toUpperCase() === id);
      if (!u || pin !== u.pin) {
        err.innerText = 'รหัสพนักงาน หรือ PIN ไม่ถูกต้อง';
        err.classList.remove('hidden');
        return;
      }
      
      state.user = u;
      state.tab = 'documents'; // บังคับเข้าแท็บเอกสาร
      localStorage.setItem('docuack_session', JSON.stringify(u));
      render();
    };
  }

  function renderDashboard(app) {
    const isAdmin = (String(state.user.role).trim().toLowerCase() === 'admin');
    const badgeClass = isAdmin ? 'bg-indigo-100 text-indigo-800 border-indigo-200' : 'bg-emerald-100 text-emerald-800 border-emerald-200';
    
    const adminHeroHtml = isAdmin ? `
      <div class="mb-8 p-6 sm:p-7 rounded-3xl bg-gradient-to-r from-blue-700 via-indigo-600 to-indigo-800 text-white shadow-xl relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6">
        <div class="relative z-10 max-w-2xl">
          <h2 class="text-2xl font-black tracking-tight text-white mb-1.5">พื้นที่ผู้ดูแลระบบ (Admin)</h2>
          <p class="text-xs sm:text-sm text-blue-100 leading-relaxed">ออกประกาศ นโยบาย แนบไฟล์ มอบหมายทั้งองค์กรหรือเจาะจงรายบุคคล</p>
        </div>
        <div class="relative z-10 shrink-0">
          <button onclick="DocuAckApp.openCreateDocModal()" class="px-6 py-3.5 bg-amber-400 hover:bg-amber-300 text-slate-900 font-extrabold text-sm rounded-2xl shadow-lg transition-all flex items-center gap-2 cursor-pointer">
            <i class="fa-solid fa-circle-plus text-base"></i><span>+ สร้างเอกสารเวียนใหม่</span>
          </button>
        </div>
      </div>
    ` : '';

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
          <div class="flex items-center gap-3">
            <div class="text-right hidden md:block pl-2 border-l border-slate-200">
              <div class="text-xs font-bold text-slate-900">${escapeHTML(state.user.name)}</div>
              <div class="text-2xs text-slate-500">${escapeHTML(state.user.id)} • ${escapeHTML(state.user.department)}</div>
            </div>
            <span class="text-xs font-bold px-2.5 py-1 rounded-xl border ${badgeClass}">${isAdmin ? 'Admin' : 'User'}</span>
            <button onclick="DocuAckApp.logout()" class="px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-xl font-bold transition-colors flex items-center gap-1.5 cursor-pointer">
              <i class="fa-solid fa-arrow-right-from-bracket"></i> <span class="hidden sm:inline">ออก</span>
            </button>
          </div>
        </div>
      </header>
      
      <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        ${adminHeroHtml}
        <div class="flex items-center gap-2 border-b border-slate-200 mb-6">
          <button onclick="DocuAckApp.setTab('documents')" class="py-3 px-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 cursor-pointer ${state.tab === 'documents' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}">
            <i class="fa-regular fa-folder-open"></i> เอกสารเวียน
          </button>
          ${isAdmin ? `
            <button onclick="DocuAckApp.setTab('users')" class="py-3 px-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 cursor-pointer ${state.tab === 'users' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}">
              <i class="fa-solid fa-users-gear"></i> จัดการบุคลากร
            </button>
          ` : ''}
        </div>
        <div id="content-container"></div>
      </main>
    `;

    if (state.tab === 'documents') document.getElementById('content-container').innerHTML = renderDocsTab(isAdmin);
    else if (state.tab === 'users' && isAdmin) document.getElementById('content-container').innerHTML = renderUsersTab();

    // เรนเดอร์ Modals
    if (state.viewDoc) renderViewerModal();
    if (state.showCreateModal) renderCreateDocModal();
    if (state.trackingDoc) renderTrackingModal();
    if (state.showAddUserModal) renderAddUserModal();
    if (state.editUserModal) renderEditUserModal();
  }

  function renderDocsTab(isAdmin) {
    const filtered = state.docs.filter(d => {
      if (!isAdmin && !isDocAssignedToUser(d, state.user.id)) return false;
      const matchSearch = d.title.toLowerCase().includes(state.search.toLowerCase()) || d.id.toLowerCase().includes(state.search.toLowerCase());
      const matchUrgency = state.filterUrgency === 'all' || d.urgencyLevel === state.filterUrgency;
      return matchSearch && matchUrgency;
    });

    let html = `
      <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs mb-6 flex flex-col md:flex-row gap-3 justify-between">
        <div class="w-full md:w-80 relative">
          <input type="text" placeholder="ค้นหาชื่อเอกสาร, รหัส..." value="${escapeHTML(state.search)}" oninput="DocuAckApp.setSearch(this.value)" class="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <i class="fa-solid fa-magnifying-glass absolute left-3 top-2.5 text-slate-400 text-xs"></i>
        </div>
        <select onchange="DocuAckApp.setFilterUrgency(this.value)" class="text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 font-semibold cursor-pointer">
          <option value="all" ${state.filterUrgency === 'all' ? 'selected' : ''}>ทุกระดับความเร่งด่วน</option>
          <option value="Very Urgent" ${state.filterUrgency === 'Very Urgent' ? 'selected' : ''}>🔴 ด่วนที่สุด</option>
          <option value="Urgent" ${state.filterUrgency === 'Urgent' ? 'selected' : ''}>🟠 ด่วนมาก</option>
          <option value="Normal" ${state.filterUrgency === 'Normal' ? 'selected' : ''}>🟢 ทั่วไป</option>
        </select>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
    `;

    if (filtered.length === 0) return html + `</div><div class="text-center py-12 text-slate-400 text-sm bg-white rounded-2xl border">ไม่พบเอกสารตามเงื่อนไข</div>`;

    filtered.forEach(doc => {
      const isRead = Array.isArray(doc.readStatus) && doc.readStatus.includes(state.user.id);
      const urgencyClass = doc.urgencyLevel === 'Very Urgent' ? 'rama-badge-very-urgent' : doc.urgencyLevel === 'Urgent' ? 'rama-badge-urgent' : 'rama-badge-normal';
      
      let actionHtml = isRead 
        ? `<span class="py-2 px-3 text-xs font-bold text-emerald-700 bg-emerald-50 rounded-xl border border-emerald-200 flex-1 text-center"><i class="fa-solid fa-check"></i> รับทราบแล้ว</span>`
        : `<button onclick="DocuAckApp.acknowledgeDoc('${escapeHTML(doc.id)}')" class="flex-1 py-2 px-3 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs cursor-pointer"><i class="fa-solid fa-signature"></i> รับทราบ</button>`;

      html += `
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between gap-2 mb-2">
              <span class="text-[11px] font-bold px-2 py-0.5 rounded-full ${urgencyClass}">${escapeHTML(doc.urgencyLevel)}</span>
              <span class="text-xs font-mono font-bold text-slate-400">${escapeHTML(doc.id)}</span>
            </div>
            <h3 class="text-sm font-bold text-slate-900 leading-snug line-clamp-2 mb-2">${escapeHTML(doc.title)}</h3>
            <div class="text-2xs text-slate-500 mb-3"><i class="fa-solid fa-users text-slate-400"></i> เป้าหมาย: ${doc.targetAudience === 'All' ? 'ทุกคน' : 'ระบุเฉพาะบุคคล'}</div>
          </div>
          <div class="pt-3 border-t border-slate-100 mt-2 flex items-center justify-between gap-2">
            <button onclick="DocuAckApp.openViewer('${escapeHTML(doc.id)}')" class="flex-1 py-2 px-3 text-xs font-bold rounded-xl border border-slate-300 hover:bg-slate-50 flex items-center justify-center gap-1.5 cursor-pointer">
              <i class="fa-regular fa-eye"></i> อ่าน
            </button>
            ${isAdmin ? `<button onclick="DocuAckApp.openTrackingModal('${escapeHTML(doc.id)}')" class="py-2 px-3 text-xs font-bold rounded-xl border border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 cursor-pointer" title="ตรวจสอบ"><i class="fa-solid fa-list-check"></i></button>` : ''}
            ${actionHtml}
          </div>
        </div>
      `;
    });
    return html + `</div>`;
  }

  function renderUsersTab() {
    let html = `
      <div class="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 class="text-lg font-bold text-slate-900">จัดการข้อมูลบุคลากรในระบบ</h2>
            <p class="text-xs text-slate-500">ซิงค์ข้อมูลกับ Google Sheets แบบ 2 ทาง (Two-Way Sync)</p>
          </div>
          <button onclick="DocuAckApp.openAddUserModal()" class="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer">
            <i class="fa-solid fa-user-plus"></i> เพิ่มผู้ใช้งาน
          </button>
        </div>
        <div class="overflow-x-auto border-t border-slate-100 pt-4">
          <table class="w-full text-left text-xs">
            <thead class="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th class="py-3 px-4">รหัสพนักงาน</th><th class="py-3 px-4">ชื่อ - นามสกุล</th>
                <th class="py-3 px-4">แผนก</th><th class="py-3 px-4">Role</th><th class="py-3 px-4 text-right">การจัดการ</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
    `;

    state.users.forEach(u => {
      html += `
        <tr class="hover:bg-slate-50 transition-colors">
          <td class="py-3 px-4 font-mono font-bold text-slate-900">${escapeHTML(u.id)}</td>
          <td class="py-3 px-4 font-bold text-slate-800">${escapeHTML(u.name)}</td>
          <td class="py-3 px-4 text-slate-600">${escapeHTML(u.department)}</td>
          <td class="py-3 px-4"><span class="px-2 py-0.5 rounded-full font-bold text-[10px] ${u.role === 'admin' ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-100 text-slate-700'}">${escapeHTML(u.role)}</span></td>
          <td class="py-3 px-4 text-right space-x-1">
            <button onclick="DocuAckApp.openEditUserModal('${escapeHTML(u.id)}')" class="px-2.5 py-1 text-xs font-bold text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer"><i class="fa-solid fa-pen"></i> แก้ไข</button>
            <button onclick="DocuAckApp.deleteUser('${escapeHTML(u.id)}')" class="px-2.5 py-1 text-xs font-bold text-red-600 hover:bg-red-50 rounded-lg cursor-pointer"><i class="fa-solid fa-trash"></i> ลบ</button>
          </td>
        </tr>
      `;
    });
    return html + `</tbody></table></div></div>`;
  }

  // ----------------------------------------------------
  // 5. Modal Windows
  // ----------------------------------------------------
  function renderCreateDocModal() {
    const today = new Date().toISOString().split('T')[0];
    const form = state.createDocForm;
    
    // Checkbox สำหรับเจาะจงบุคคล (ออกแบบกว้างและสวยงาม)
    let userCheckboxes = '<div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">';
    state.users.forEach(u => {
      const isChecked = form.selectedUserIds.includes(u.id) ? 'checked' : '';
      userCheckboxes += `
        <label class="flex items-start gap-2 p-2.5 border rounded-xl cursor-pointer transition-all ${isChecked ? 'bg-blue-50 border-blue-300' : 'bg-white hover:bg-slate-50 border-slate-200'}">
          <input type="checkbox" value="${u.id}" ${isChecked} onchange="DocuAckApp.toggleAudience('${u.id}')" class="mt-0.5 text-blue-600 rounded cursor-pointer" />
          <div class="overflow-hidden">
            <div class="text-xs font-bold text-slate-800 truncate">${escapeHTML(u.name)}</div>
            <div class="text-3xs text-slate-500 truncate">${escapeHTML(u.department)}</div>
          </div>
        </label>
      `;
    });
    userCheckboxes += '</div>';

    document.getElementById('docuack-modal-root').innerHTML = `
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4">
        <div class="bg-white rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in">
          <div class="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
            <h3 class="text-base font-bold text-slate-900"><i class="fa-solid fa-cloud-arrow-up text-blue-600 mr-2"></i>สร้างและแนบเอกสารเวียน</h3>
            <button onclick="DocuAckApp.closeCreateDocModal()" class="text-slate-400 hover:text-red-500 text-sm font-bold cursor-pointer">✕ ปิด</button>
          </div>
          
          <div class="flex-1 overflow-y-auto p-6">
            <form id="createDocForm" class="space-y-5 text-sm">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class="block font-bold text-slate-700 mb-1 text-xs">ชื่อเรื่อง / ประกาศ</label>
                  <input type="text" id="newTitle" required class="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label class="block font-bold text-slate-700 mb-1 text-xs">แนบไฟล์ (PDF หรือ รูปภาพ)</label>
                  <input type="file" id="newFile" accept="image/*,application/pdf" required class="w-full text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:font-bold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer" />
                </div>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-slate-100 pt-4">
                <div>
                  <label class="block font-bold text-slate-700 mb-1 text-xs">ระดับความเร่งด่วน</label>
                  <select id="newUrgency" class="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold">
                    <option value="Very Urgent">🔴 ด่วนที่สุด</option>
                    <option value="Urgent">🟠 ด่วนมาก</option>
                    <option value="Normal" selected>🟢 ทั่วไป</option>
                  </select>
                </div>
                <div>
                  <label class="block font-bold text-slate-700 mb-1 text-xs">วันที่เริ่มสื่อสาร (Start Date)</label>
                  <input type="date" id="newStartDate" value="${today}" required class="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl" />
                </div>
                <div>
                  <label class="block font-bold text-slate-700 mb-1 text-xs">วันครบกำหนด (Deadline)</label>
                  <input type="date" id="newEndDate" required class="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl" />
                </div>
              </div>

              <div class="border rounded-2xl bg-slate-50 p-4">
                <label class="block font-bold text-slate-900 mb-2">กลุ่มเป้าหมายผู้รับเอกสาร <span class="text-red-500">*</span></label>
                <div class="flex gap-4 mb-4">
                  <label class="flex items-center gap-1.5 cursor-pointer font-bold text-sm">
                    <input type="radio" name="audience" value="All" ${form.audienceType === 'All' ? 'checked' : ''} onchange="DocuAckApp.setAudienceType('All')" class="text-blue-600 w-4 h-4"/> 
                    ส่งทุกคนในองค์กร
                  </label>
                  <label class="flex items-center gap-1.5 cursor-pointer font-bold text-sm">
                    <input type="radio" name="audience" value="Specific" ${form.audienceType === 'Specific' ? 'checked' : ''} onchange="DocuAckApp.setAudienceType('Specific')" class="text-blue-600 w-4 h-4"/> 
                    ระบุรายบุคคล (ติ๊กเฉพาะคนที่ไม่ต้องการออก)
                  </label>
                </div>
                ${form.audienceType === 'Specific' ? `
                  <div class="bg-white border border-slate-200 rounded-xl p-3 max-h-60 overflow-y-auto shadow-inner">
                    ${userCheckboxes}
                  </div>
                ` : ''}
              </div>

              <div class="pt-4 flex justify-end gap-3">
                <button type="button" onclick="DocuAckApp.closeCreateDocModal()" class="px-5 py-2.5 font-bold text-slate-600 hover:bg-slate-200 rounded-xl cursor-pointer">ยกเลิก</button>
                <button type="submit" id="btnSubmitDoc" class="px-6 py-2.5 font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md cursor-pointer">อัปโหลดและเผยแพร่</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;

    document.getElementById('createDocForm').onsubmit = (e) => {
      e.preventDefault();
      if (form.audienceType === 'Specific' && form.selectedUserIds.length === 0) return alert('กรุณาเลือกผู้รับอย่างน้อย 1 ท่าน');
      
      const file = document.getElementById('newFile').files[0];
      const reader = new FileReader();
      const btn = document.getElementById('btnSubmitDoc');
      btn.innerText = "กำลังอัปโหลด..."; btn.disabled = true;

      reader.onload = async (event) => {
        const payload = {
          action: 'addDocument',
          data: {
            title: document.getElementById('newTitle').value, fileBase64: event.target.result, fileName: file.name,
            urgencyLevel: document.getElementById('newUrgency').value, startDate: document.getElementById('newStartDate').value, endDate: document.getElementById('newEndDate').value,
            targetAudience: form.audienceType === 'All' ? 'All' : form.selectedUserIds.join(',')
          }
        };

        try {
          await fetch(API_URL, { method: 'POST', body: JSON.stringify(payload) });
          alert('อัปโหลดเอกสารสำเร็จ!');
          location.reload();
        } catch (err) {
          alert("คำขอถูกส่งไปแล้ว โปรดรีเฟรชหน้าเว็บเพื่อตรวจสอบ");
          location.reload();
        }
      };
      reader.readAsDataURL(file);
    };
  }

  function renderAddUserModal() {
    document.getElementById('docuack-modal-root').innerHTML = `
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4">
        <form id="addUserForm" class="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl animate-in fade-in">
          <div class="flex justify-between items-center mb-4 border-b pb-3">
            <h3 class="font-bold text-lg text-slate-900">เพิ่มบุคลากรใหม่</h3>
            <button type="button" onclick="DocuAckApp.closeAddUserModal()" class="text-slate-400 hover:text-red-500 font-bold cursor-pointer">✕</button>
          </div>
          <div class="space-y-3 text-sm">
            <div><label class="block font-bold mb-1">รหัสพนักงาน *</label><input type="text" id="addId" required class="w-full p-2.5 border rounded-xl bg-slate-50 uppercase"/></div>
            <div><label class="block font-bold mb-1">รหัส PIN *</label><input type="text" id="addPin" required class="w-full p-2.5 border rounded-xl bg-slate-50"/></div>
            <div><label class="block font-bold mb-1">ชื่อ-นามสกุล *</label><input type="text" id="addName" required class="w-full p-2.5 border rounded-xl bg-slate-50"/></div>
            <div><label class="block font-bold mb-1">แผนก</label><input type="text" id="addDept" class="w-full p-2.5 border rounded-xl bg-slate-50"/></div>
            <div><label class="block font-bold mb-1">อีเมล</label><input type="email" id="addEmail" class="w-full p-2.5 border rounded-xl bg-slate-50"/></div>
            <div><label class="block font-bold mb-1">สิทธิ์ (Role)</label><select id="addRole" class="w-full p-2.5 border rounded-xl bg-slate-50 font-bold"><option value="user">User</option><option value="admin">Admin</option></select></div>
          </div>
          <div class="flex gap-3 mt-5">
            <button type="button" onclick="DocuAckApp.closeAddUserModal()" class="flex-1 p-2.5 bg-slate-200 text-slate-700 rounded-xl font-bold cursor-pointer">ยกเลิก</button>
            <button type="submit" class="flex-1 p-2.5 bg-blue-600 text-white rounded-xl font-bold cursor-pointer">บันทึกข้อมูล</button>
          </div>
        </form>
      </div>`;
    
    document.getElementById('addUserForm').onsubmit = async (e) => {
      e.preventDefault();
      const payload = { action: 'addUser', data: {
        id: document.getElementById('addId').value.toUpperCase(), pin: document.getElementById('addPin').value,
        name: document.getElementById('addName').value, department: document.getElementById('addDept').value,
        role: document.getElementById('addRole').value, email: document.getElementById('addEmail').value
      }};
      DocuAckApp.closeAddUserModal();
      try { await fetch(API_URL, { method: 'POST', body: JSON.stringify(payload) }); } catch(err){}
      location.reload();
    };
  }

  function renderEditUserModal() {
    const u = state.editUserModal;
    document.getElementById('docuack-modal-root').innerHTML = `
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4">
        <form id="editUserForm" class="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl animate-in fade-in">
          <div class="flex justify-between items-center mb-4 border-b pb-3">
            <h3 class="font-bold text-lg text-slate-900">แก้ไขข้อมูล: ${escapeHTML(u.id)}</h3>
            <button type="button" onclick="DocuAckApp.closeEditUserModal()" class="text-slate-400 hover:text-red-500 font-bold cursor-pointer">✕</button>
          </div>
          <div class="space-y-3 text-sm">
            <div><label class="block font-bold mb-1">รหัส PIN *</label><input type="text" id="editPin" value="${escapeHTML(u.pin)}" required class="w-full p-2.5 border rounded-xl bg-slate-50"/></div>
            <div><label class="block font-bold mb-1">ชื่อ-นามสกุล *</label><input type="text" id="editName" value="${escapeHTML(u.name)}" required class="w-full p-2.5 border rounded-xl bg-slate-50"/></div>
            <div><label class="block font-bold mb-1">แผนก</label><input type="text" id="editDept" value="${escapeHTML(u.department)}" class="w-full p-2.5 border rounded-xl bg-slate-50"/></div>
            <div><label class="block font-bold mb-1">อีเมล</label><input type="email" id="editEmail" value="${escapeHTML(u.email)}" class="w-full p-2.5 border rounded-xl bg-slate-50"/></div>
            <div><label class="block font-bold mb-1">สิทธิ์ (Role)</label><select id="editRole" class="w-full p-2.5 border rounded-xl bg-slate-50 font-bold"><option value="user" ${u.role==='user'?'selected':''}>User</option><option value="admin" ${u.role==='admin'?'selected':''}>Admin</option></select></div>
          </div>
          <div class="flex gap-3 mt-5">
            <button type="button" onclick="DocuAckApp.closeEditUserModal()" class="flex-1 p-2.5 bg-slate-200 text-slate-700 rounded-xl font-bold cursor-pointer">ยกเลิก</button>
            <button type="submit" class="flex-1 p-2.5 bg-blue-600 text-white rounded-xl font-bold cursor-pointer">บันทึกการแก้ไข</button>
          </div>
        </form>
      </div>`;
    
    document.getElementById('editUserForm').onsubmit = async (e) => {
      e.preventDefault();
      const payload = { action: 'editUser', data: {
        id: u.id, pin: document.getElementById('editPin').value, name: document.getElementById('editName').value, 
        department: document.getElementById('editDept').value, role: document.getElementById('editRole').value, email: document.getElementById('editEmail').value
      }};
      DocuAckApp.closeEditUserModal();
      try { await fetch(API_URL, { method: 'POST', body: JSON.stringify(payload) }); } catch(err){}
      location.reload();
    };
  }

  function renderViewerModal() {
    const doc = state.viewDoc;
    document.getElementById('docuack-modal-root').innerHTML = `
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-4">
        <div class="bg-white rounded-3xl w-full max-w-4xl h-[92vh] flex flex-col overflow-hidden animate-in fade-in">
          <div class="p-4 border-b flex justify-between bg-slate-50">
            <h3 class="font-bold text-slate-900">${escapeHTML(doc.title)}</h3>
            <button onclick="DocuAckApp.closeViewer()" class="text-slate-400 hover:text-red-500 font-bold cursor-pointer">✕ ปิด</button>
          </div>
          <iframe src="${doc.fileUrl}" class="w-full h-full bg-slate-200" frameborder="0"></iframe>
        </div>
      </div>
    `;
  }

  function renderTrackingModal() {
    const doc = state.trackingDoc;
    const readers = Array.isArray(doc.readStatus) ? doc.readStatus : [];
    const targets = (doc.targetAudience === 'All') ? state.users : state.users.filter(u => doc.targetAudience.includes(u.id));

    let html = `
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-4">
        <div class="bg-white rounded-3xl w-full max-w-xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in">
          <div class="p-5 border-b flex justify-between bg-slate-50">
            <div><span class="text-2xs text-slate-400 font-mono">${escapeHTML(doc.id)}</span><h3 class="font-bold text-slate-900">ตรวจสอบผู้รับทราบ</h3></div>
            <button onclick="DocuAckApp.closeTrackingModal()" class="text-slate-400 hover:text-red-500 font-bold cursor-pointer">✕ ปิด</button>
          </div>
          <div class="flex-1 overflow-y-auto p-4 divide-y divide-slate-100">
    `;
    targets.forEach(u => {
      const isRead = readers.includes(u.id);
      html += `
        <div class="flex justify-between items-center py-2.5">
          <div><div class="font-bold text-sm">${escapeHTML(u.name)} <span class="text-slate-400 font-normal font-mono text-xs">(${escapeHTML(u.id)})</span></div></div>
          ${isRead ? `<span class="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-1 rounded-full">รับทราบแล้ว</span>` : `<span class="text-xs font-bold text-rose-700 bg-rose-50 px-2 py-1 rounded-full">ยังไม่อ่าน</span>`}
        </div>
      `;
    });
    html += `</div></div></div>`;
    document.getElementById('docuack-modal-root').innerHTML = html;
  }

  // ----------------------------------------------------
  // 6. Global API (Exposed to Window)
  // ----------------------------------------------------
  window.DocuAckApp = {
    logout: () => { state.user = null; localStorage.removeItem('docuack_session'); render(); },
    setTab: (t) => { state.tab = t; render(); },
    setSearch: (s) => { state.search = s; render(); },
    setFilterUrgency: (u) => { state.filterUrgency = u; render(); },
    
    // User Modals
    openAddUserModal: () => { state.showAddUserModal = true; renderAddUserModal(); },
    closeAddUserModal: () => { state.showAddUserModal = false; document.getElementById('docuack-modal-root').innerHTML = ''; },
    openEditUserModal: (id) => { state.editUserModal = state.users.find(u => u.id === id); renderEditUserModal(); },
    closeEditUserModal: () => { state.editUserModal = null; document.getElementById('docuack-modal-root').innerHTML = ''; },
    deleteUser: async (id) => {
      if(confirm('ยืนยันการลบผู้ใช้รหัส '+id+' ใช่หรือไม่?')) {
        try { await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'deleteUser', userId: id }) }); } catch(e){}
        location.reload();
      }
    },
    
    // Create Document Modals
    openCreateDocModal: () => { 
      state.showCreateModal = true; 
      state.createDocForm.audienceType = 'All'; 
      // เลือกล่วงหน้าทุกคน เพื่อให้แอดมินแค่ติ๊กคนที่ไม่อยากให้อ่านออก
      state.createDocForm.selectedUserIds = state.users.map(u => String(u.id)); 
      renderCreateDocModal(); 
    },
    closeCreateDocModal: () => { state.showCreateModal = false; document.getElementById('docuack-modal-root').innerHTML = ''; },
    setAudienceType: (type) => { state.createDocForm.audienceType = type; renderCreateDocModal(); },
    toggleAudience: (uid) => {
      const arr = state.createDocForm.selectedUserIds;
      if (arr.includes(uid)) arr.splice(arr.indexOf(uid), 1); else arr.push(uid);
      renderCreateDocModal();
    },
    
    // View & Acknowledge
    openViewer: (docId) => { state.viewDoc = state.docs.find(d => d.id === docId); renderViewerModal(); },
    closeViewer: () => { state.viewDoc = null; document.getElementById('docuack-modal-root').innerHTML = ''; },
    openTrackingModal: (docId) => { state.trackingDoc = state.docs.find(d => d.id === docId); renderTrackingModal(); },
    closeTrackingModal: () => { state.trackingDoc = null; document.getElementById('docuack-modal-root').innerHTML = ''; },
    acknowledgeDoc: async (docId) => {
      const doc = state.docs.find(d => d.id === docId);
      if (!doc || doc.readStatus.includes(state.user.id)) return;
      doc.readStatus.push(state.user.id);
      render(); 
      try { await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'acknowledge', docId: docId, userId: state.user.id }) }); } catch(err) {}
    }
  };

  // ----------------------------------------------------
  // 7. Initialization
  // ----------------------------------------------------
  window.addEventListener('DOMContentLoaded', initApp);
})();
</script>
