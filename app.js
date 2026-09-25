/**
 * DocuAck Application Logic
 * Clean Code & Single Page Application (SPA)
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
  // 2. State Management (Local Cache)
  // ----------------------------------------------------
  let state = {
    user: JSON.parse(localStorage.getItem('docuack_session')) || null,
    users: JSON.parse(localStorage.getItem('docuack_cached_users')) || [],
    docs: JSON.parse(localStorage.getItem('docuack_cached_docs')) || [],
    tab: 'documents', 
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
  // 3. Core Logic & Background Sync
  // ----------------------------------------------------
  async function initApp() {
    const loader = document.getElementById('global-loader');
    const hasCache = state.users.length > 0 && state.docs.length > 0;
    
    if (hasCache) {
      if (loader) loader.style.display = 'none';
      render(); // โชว์ของเก่าให้ใช้งานได้ทันที (โหลด 0 วิ)
      await fetchDataFromGAS(); // แอบอัปเดตข้อมูลเบื้องหลัง
    } else {
      await fetchDataFromGAS();
      if (loader) loader.style.display = 'none';
    }
  }

  // ✅ แก้ไข: สั่ง Render เสมอเมื่อได้ข้อมูลใหม่จาก Google Sheets
  async function fetchDataFromGAS() {
    try {
      const response = await fetch(API_URL, { 
        method: 'POST', 
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'getAppData' }) 
      });
      const result = await response.json();
      if (result.status === 'success') {
        state.users = result.data.users || [];
        state.docs = result.data.docs || [];
        localStorage.setItem('docuack_cached_users', JSON.stringify(state.users));
        localStorage.setItem('docuack_cached_docs', JSON.stringify(state.docs));
        
        render(); // <--- เพิ่มคำสั่งนี้ เพื่อให้หน้าจอวาดใหม่เสมอเมื่อได้ข้อมูลอัปเดต
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
      <div class="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 flex flex-col justify-center py-12 px-4">
        <div class="sm:mx-auto sm:w-full sm:max-w-md bg-white rounded-2xl shadow-2xl p-8 border border-slate-200">
          <div class="text-center mb-6">
            <div class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 text-white shadow-xl mb-4">
              <i class="fa-solid fa-file-circle-check text-3xl"></i>
            </div>
            <h1 class="text-3xl font-extrabold text-slate-800">DocuAck</h1>
            <p class="text-sm text-slate-500 mt-1">ระบบรับทราบเอกสารองค์กร</p>
          </div>
          <form id="loginForm" class="space-y-4">
            <div>
              <label class="block text-xs font-bold text-slate-600 uppercase mb-1">รหัสพนักงาน</label>
              <input type="text" id="loginId" required placeholder="เช่น 020482" class="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl font-bold uppercase" />
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-600 uppercase mb-1">รหัสผ่าน (PIN)</label>
              <input type="password" id="loginPin" required placeholder="กรอกรหัสผ่าน" class="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl font-bold" />
            </div>
            <div id="loginError" class="text-xs text-red-600 hidden font-bold text-center bg-red-50 p-3 rounded-xl border border-red-200"></div>
            <button type="submit" class="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md cursor-pointer">เข้าสู่ระบบ</button>
          </form>
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
      state.tab = 'documents'; // บังคับเข้าแท็บเอกสารเสมอ ป้องกันบั๊กสลับแท็บ
      localStorage.setItem('docuack_session', JSON.stringify(u));
      render();
    };
  }

  function renderDashboard(app) {
    const isAdmin = (String(state.user.role).trim().toLowerCase() === 'admin');
    
    app.innerHTML = `
      <header class="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
        <div class="max-w-7xl mx-auto px-4 flex items-center justify-between h-16">
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center"><i class="fa-solid fa-file-circle-check"></i></div>
            <div class="font-bold text-lg text-slate-900">DocuAck</div>
          </div>
          <div class="flex items-center gap-3">
            <div class="text-right hidden sm:block">
              <div class="text-xs font-bold text-slate-900">${escapeHTML(state.user.name)}</div>
              <div class="text-2xs text-slate-500">${escapeHTML(state.user.department)}</div>
            </div>
            <span class="text-xs font-bold px-2.5 py-1 rounded-lg ${isAdmin ? 'bg-indigo-100 text-indigo-800' : 'bg-emerald-100 text-emerald-800'}">${isAdmin ? 'Admin' : 'User'}</span>
            <button onclick="DocuAckApp.logout()" class="text-xs text-red-600 hover:bg-red-50 px-2 py-1 rounded-lg font-bold cursor-pointer"><i class="fa-solid fa-arrow-right-from-bracket"></i> ออก</button>
          </div>
        </div>
      </header>
      
      <main class="max-w-7xl mx-auto px-4 py-6">
        <div class="flex gap-2 border-b border-slate-200 mb-6">
          <button onclick="DocuAckApp.setTab('documents')" class="py-3 px-4 text-sm font-bold border-b-2 cursor-pointer ${state.tab === 'documents' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'}">
            <i class="fa-regular fa-folder-open mr-1"></i> เอกสารเวียน
          </button>
          ${isAdmin ? `
            <button onclick="DocuAckApp.setTab('users')" class="py-3 px-4 text-sm font-bold border-b-2 cursor-pointer ${state.tab === 'users' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'}">
              <i class="fa-solid fa-users-gear mr-1"></i> จัดการบุคลากร
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
      <div class="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
        <div class="flex gap-2 w-full md:w-auto">
          <input type="text" placeholder="ค้นหาชื่อเอกสาร, รหัส..." value="${escapeHTML(state.search)}" oninput="DocuAckApp.setSearch(this.value)" class="w-full md:w-64 px-4 py-2 border rounded-xl text-sm" />
          <select onchange="DocuAckApp.setFilterUrgency(this.value)" class="px-3 py-2 border rounded-xl text-sm bg-white cursor-pointer">
            <option value="all" ${state.filterUrgency === 'all' ? 'selected' : ''}>ทุกระดับ</option>
            <option value="Very Urgent" ${state.filterUrgency === 'Very Urgent' ? 'selected' : ''}>🔴 ด่วนที่สุด</option>
            <option value="Urgent" ${state.filterUrgency === 'Urgent' ? 'selected' : ''}>🟠 ด่วนมาก</option>
            <option value="Normal" ${state.filterUrgency === 'Normal' ? 'selected' : ''}>🟢 ทั่วไป</option>
          </select>
        </div>
        ${isAdmin ? `<button onclick="DocuAckApp.openCreateDocModal()" class="w-full md:w-auto px-5 py-2.5 bg-amber-400 text-slate-900 font-bold rounded-xl shadow-md cursor-pointer"><i class="fa-solid fa-plus mr-1"></i> สร้างเอกสารใหม่</button>` : ''}
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
    `;

    if (filtered.length === 0) return html + `</div><div class="text-center py-12 text-slate-400 bg-white rounded-2xl border">ไม่พบเอกสาร</div>`;

    filtered.forEach(doc => {
      const isRead = Array.isArray(doc.readStatus) && doc.readStatus.includes(state.user.id);
      const urgencyClass = doc.urgencyLevel === 'Very Urgent' ? 'rama-badge-very-urgent' : doc.urgencyLevel === 'Urgent' ? 'rama-badge-urgent' : 'rama-badge-normal';
      
      let actionHtml = isRead 
        ? `<span class="py-2 px-3 text-xs font-bold text-emerald-700 bg-emerald-50 rounded-xl border border-emerald-200 flex-1 text-center"><i class="fa-solid fa-check"></i> รับทราบแล้ว</span>`
        : `<button onclick="DocuAckApp.acknowledgeDoc('${escapeHTML(doc.id)}')" class="flex-1 py-2 px-3 text-xs font-bold text-white bg-blue-600 rounded-xl shadow-xs cursor-pointer"><i class="fa-solid fa-signature"></i> รับทราบ</button>`;

      html += `
        <div class="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col justify-between shadow-sm">
          <div>
            <div class="flex justify-between items-center mb-2">
              <span class="text-[11px] font-bold px-2 py-0.5 rounded-full ${urgencyClass}">${escapeHTML(doc.urgencyLevel)}</span>
              <span class="text-xs font-mono text-slate-400">${escapeHTML(doc.id)}</span>
            </div>
            <h3 class="text-sm font-bold text-slate-900 line-clamp-2 mb-2">${escapeHTML(doc.title)}</h3>
            <div class="text-xs text-slate-500 mb-3"><i class="fa-solid fa-users"></i> ${doc.targetAudience === 'All' ? 'ทุกคน' : 'ระบุบุคคล'}</div>
          </div>
          <div class="pt-3 border-t flex justify-between gap-2">
            <button onclick="DocuAckApp.openViewer('${escapeHTML(doc.id)}')" class="flex-1 py-2 px-3 text-xs font-bold border rounded-xl hover:bg-slate-50 cursor-pointer"><i class="fa-regular fa-eye"></i> อ่าน</button>
            ${isAdmin ? `<button onclick="DocuAckApp.openTrackingModal('${escapeHTML(doc.id)}')" class="py-2 px-3 text-xs font-bold border border-purple-200 bg-purple-50 text-purple-700 rounded-xl cursor-pointer"><i class="fa-solid fa-list-check"></i></button>` : ''}
            ${actionHtml}
          </div>
        </div>
      `;
    });
    return html + `</div>`;
  }

  function renderUsersTab() {
    let html = `
      <div class="bg-white rounded-2xl border p-6 shadow-sm">
        <div class="flex justify-between items-center mb-6">
          <h2 class="text-lg font-bold">จัดการบุคลากร</h2>
          <button onclick="DocuAckApp.openAddUserModal()" class="px-4 py-2 bg-blue-600 text-white font-bold rounded-xl text-sm cursor-pointer"><i class="fa-solid fa-plus"></i> เพิ่มผู้ใช้งาน</button>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left text-sm">
            <thead class="bg-slate-50 border-b">
              <tr><th class="p-3">รหัส</th><th class="p-3">ชื่อ</th><th class="p-3">แผนก</th><th class="p-3">Role</th><th class="p-3 text-right">จัดการ</th></tr>
            </thead>
            <tbody class="divide-y">
    `;
    state.users.forEach(u => {
      html += `
        <tr class="hover:bg-slate-50">
          <td class="p-3 font-mono">${escapeHTML(u.id)}</td><td class="p-3 font-bold">${escapeHTML(u.name)}</td>
          <td class="p-3 text-slate-600">${escapeHTML(u.department)}</td><td class="p-3"><span class="px-2 py-1 bg-slate-200 rounded text-xs">${escapeHTML(u.role)}</span></td>
          <td class="p-3 text-right">
            <button onclick="DocuAckApp.openEditUserModal('${escapeHTML(u.id)}')" class="text-blue-600 font-bold px-2 cursor-pointer">แก้ไข</button>
            <button onclick="DocuAckApp.deleteUser('${escapeHTML(u.id)}')" class="text-red-600 font-bold px-2 cursor-pointer">ลบ</button>
          </td>
        </tr>`;
    });
    return html + `</tbody></table></div></div>`;
  }

  // ----------------------------------------------------
  // 5. Modal Windows
  // ----------------------------------------------------
  function renderCreateDocModal() {
    const today = new Date().toISOString().split('T')[0];
    const form = state.createDocForm;
    
    // สร้าง Checkbox ระบุตัวบุคคล (เริ่มต้นติ๊กถูกทุกคน แอดมินแค่ติ๊กออกคนที่ไม่อยากให้อ่าน)
    let userCheckboxes = '<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">';
    state.users.forEach(u => {
      const isChecked = form.selectedUserIds.includes(u.id) ? 'checked' : '';
      userCheckboxes += `
        <label class="flex items-start gap-2 p-2.5 border rounded-xl cursor-pointer ${isChecked ? 'bg-blue-50 border-blue-300' : 'bg-white'}">
          <input type="checkbox" value="${u.id}" ${isChecked} onchange="DocuAckApp.toggleAudience('${u.id}')" class="mt-0.5 text-blue-600 cursor-pointer" />
          <div class="overflow-hidden">
            <div class="text-xs font-bold truncate">${escapeHTML(u.name)}</div>
            <div class="text-[10px] text-slate-500 truncate">${escapeHTML(u.department)}</div>
          </div>
        </label>
      `;
    });
    userCheckboxes += '</div>';

    document.getElementById('docuack-modal-root').innerHTML = `
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4">
        <div class="bg-white rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
          <div class="p-5 border-b flex items-center justify-between bg-slate-50">
            <h3 class="font-bold text-slate-900"><i class="fa-solid fa-cloud-arrow-up text-blue-600 mr-2"></i>สร้างเอกสารเวียน</h3>
            <button onclick="DocuAckApp.closeCreateDocModal()" class="text-slate-400 font-bold cursor-pointer">✕ ปิด</button>
          </div>
          <div class="flex-1 overflow-y-auto p-6">
            <form id="createDocForm" class="space-y-4">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label class="block font-bold text-xs mb-1">ชื่อเรื่อง / ประกาศ</label><input type="text" id="newTitle" required class="w-full px-3 py-2 border rounded-xl" /></div>
                <div><label class="block font-bold text-xs mb-1">แนบไฟล์ (PDF หรือ รูปภาพ)</label><input type="file" id="newFile" accept="image/*,application/pdf" required class="w-full text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:bg-blue-600 file:text-white cursor-pointer" /></div>
              </div>
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4 border-t pt-4">
                <div><label class="block font-bold text-xs mb-1">ระดับความเร่งด่วน</label>
                  <select id="newUrgency" class="w-full px-3 py-2 border rounded-xl font-bold cursor-pointer"><option value="Very Urgent">🔴 ด่วนที่สุด</option><option value="Urgent">🟠 ด่วนมาก</option><option value="Normal" selected>🟢 ทั่วไป</option></select>
                </div>
                <div><label class="block font-bold text-xs mb-1">เริ่มสื่อสาร (Start Date)</label><input type="date" id="newStartDate" value="${today}" required class="w-full px-3 py-2 border rounded-xl" /></div>
                <div><label class="block font-bold text-xs mb-1">ครบกำหนด (Deadline)</label><input type="date" id="newEndDate" required class="w-full px-3 py-2 border rounded-xl" /></div>
              </div>
              <div class="border rounded-xl bg-slate-50 p-4">
                <label class="block font-bold mb-2">กลุ่มเป้าหมายผู้รับเอกสาร</label>
                <div class="flex gap-4 mb-4">
                  <label class="flex items-center gap-1.5 font-bold text-sm cursor-pointer"><input type="radio" name="audience" value="All" ${form.audienceType === 'All' ? 'checked' : ''} onchange="DocuAckApp.setAudienceType('All')"/> ส่งทุกคน</label>
                  <label class="flex items-center gap-1.5 font-bold text-sm cursor-pointer"><input type="radio" name="audience" value="Specific" ${form.audienceType === 'Specific' ? 'checked' : ''} onchange="DocuAckApp.setAudienceType('Specific')"/> ระบุรายบุคคล</label>
                </div>
                ${form.audienceType === 'Specific' ? `<div class="bg-white border rounded-xl p-3 max-h-60 overflow-y-auto">${userCheckboxes}</div>` : ''}
              </div>
              <div class="pt-2 flex justify-end gap-3">
                <button type="submit" id="btnSubmitDoc" class="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold shadow-md cursor-pointer">อัปโหลดและเผยแพร่</button>
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
            urgencyLevel: document.getElementById('newUrgency').value, startDate: document.getElementById('newStartDate').value, 
            endDate: document.getElementById('newEndDate').value, targetAudience: form.audienceType === 'All' ? 'All' : form.selectedUserIds.join(',')
          }
        };

        // ✅ แก้ไข: ใช้ fetchDataFromGAS() โหลดข้อมูลใหม่แทน location.reload() เพื่อไม่ให้จอกระพริบ
        try {
          await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) });
        } catch (err) { console.log("Ignore CORS redirect error"); }
        
        DocuAckApp.closeCreateDocModal();
        let loader = document.getElementById('global-loader');
        if (loader) { loader.style.display = 'flex'; loader.querySelector('h2').innerText = 'กำลังอัปเดตระบบ...'; }
        await fetchDataFromGAS();
        if (loader) loader.style.display = 'none';
        alert('อัปโหลดเอกสารเรียบร้อยแล้ว!');
      };
      reader.readAsDataURL(file);
    };
  }

  function renderAddUserModal() {
    document.getElementById('docuack-modal-root').innerHTML = `
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4">
        <form id="addUserForm" class="bg-white rounded-3xl p-6 w-full max-w-md shadow-xl">
          <div class="flex justify-between items-center mb-4 border-b pb-3"><h3 class="font-bold text-lg">เพิ่มบุคลากร</h3><button type="button" onclick="DocuAckApp.closeAddUserModal()" class="text-slate-400 font-bold cursor-pointer">✕</button></div>
          <div class="space-y-3 text-sm">
            <input type="text" id="addId" required placeholder="รหัสพนักงาน *" class="w-full p-2.5 border rounded-xl uppercase"/>
            <input type="text" id="addPin" required placeholder="รหัส PIN *" class="w-full p-2.5 border rounded-xl"/>
            <input type="text" id="addName" required placeholder="ชื่อ-นามสกุล *" class="w-full p-2.5 border rounded-xl"/>
            <input type="text" id="addDept" placeholder="แผนก" class="w-full p-2.5 border rounded-xl"/>
            <input type="email" id="addEmail" placeholder="อีเมล" class="w-full p-2.5 border rounded-xl"/>
            <select id="addRole" class="w-full p-2.5 border rounded-xl font-bold"><option value="user">User</option><option value="admin">Admin</option></select>
          </div>
          <button type="submit" class="w-full mt-5 p-3 bg-blue-600 text-white rounded-xl font-bold cursor-pointer">บันทึกข้อมูล</button>
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
      document.getElementById('global-loader').style.display = 'flex';
      try { await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) }); } catch(err){}
      await fetchDataFromGAS();
      document.getElementById('global-loader').style.display = 'none';
    };
  }

  function renderEditUserModal() {
    const u = state.editUserModal;
    document.getElementById('docuack-modal-root').innerHTML = `
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4">
        <form id="editUserForm" class="bg-white rounded-3xl p-6 w-full max-w-md shadow-xl">
          <div class="flex justify-between items-center mb-4 border-b pb-3"><h3 class="font-bold text-lg">แก้ไข: ${escapeHTML(u.id)}</h3><button type="button" onclick="DocuAckApp.closeEditUserModal()" class="text-slate-400 font-bold cursor-pointer">✕</button></div>
          <div class="space-y-3 text-sm">
            <input type="text" id="editPin" value="${escapeHTML(u.pin)}" required class="w-full p-2.5 border rounded-xl"/>
            <input type="text" id="editName" value="${escapeHTML(u.name)}" required class="w-full p-2.5 border rounded-xl"/>
            <input type="text" id="editDept" value="${escapeHTML(u.department)}" class="w-full p-2.5 border rounded-xl"/>
            <input type="email" id="editEmail" value="${escapeHTML(u.email)}" class="w-full p-2.5 border rounded-xl"/>
            <select id="editRole" class="w-full p-2.5 border rounded-xl font-bold"><option value="user" ${u.role==='user'?'selected':''}>User</option><option value="admin" ${u.role==='admin'?'selected':''}>Admin</option></select>
          </div>
          <button type="submit" class="w-full mt-5 p-3 bg-blue-600 text-white rounded-xl font-bold cursor-pointer">บันทึกการแก้ไข</button>
        </form>
      </div>`;
    
    document.getElementById('editUserForm').onsubmit = async (e) => {
      e.preventDefault();
      const payload = { action: 'editUser', data: {
        id: u.id, pin: document.getElementById('editPin').value, name: document.getElementById('editName').value, 
        department: document.getElementById('editDept').value, role: document.getElementById('editRole').value, email: document.getElementById('editEmail').value
      }};
      DocuAckApp.closeEditUserModal();
      document.getElementById('global-loader').style.display = 'flex';
      try { await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) }); } catch(err){}
      await fetchDataFromGAS();
      document.getElementById('global-loader').style.display = 'none';
    };
  }

  function renderViewerModal() {
    const doc = state.viewDoc;
    document.getElementById('docuack-modal-root').innerHTML = `
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-4">
        <div class="bg-white rounded-3xl w-full max-w-4xl h-[92vh] flex flex-col overflow-hidden">
          <div class="p-4 border-b flex justify-between bg-slate-50"><h3 class="font-bold">${escapeHTML(doc.title)}</h3><button onclick="DocuAckApp.closeViewer()" class="text-slate-400 font-bold cursor-pointer">✕ ปิด</button></div>
          <iframe src="${doc.fileUrl}" class="w-full h-full bg-slate-200" frameborder="0"></iframe>
        </div>
      </div>`;
  }

  function renderTrackingModal() {
    const doc = state.trackingDoc;
    const readers = Array.isArray(doc.readStatus) ? doc.readStatus : [];
    const targets = (doc.targetAudience === 'All') ? state.users : state.users.filter(u => doc.targetAudience.includes(u.id));

    let html = `
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-4">
        <div class="bg-white rounded-3xl w-full max-w-xl max-h-[85vh] flex flex-col overflow-hidden">
          <div class="p-5 border-b flex justify-between bg-slate-50"><div><span class="text-2xs text-slate-400 font-mono">${escapeHTML(doc.id)}</span><h3 class="font-bold">ตรวจสอบผู้รับทราบ</h3></div><button onclick="DocuAckApp.closeTrackingModal()" class="text-slate-400 font-bold cursor-pointer">✕ ปิด</button></div>
          <div class="flex-1 overflow-y-auto p-4 divide-y divide-slate-100">
    `;
    targets.forEach(u => {
      const isRead = readers.includes(u.id);
      html += `
        <div class="flex justify-between items-center py-2.5">
          <div><div class="font-bold text-sm">${escapeHTML(u.name)} <span class="text-slate-400 font-normal font-mono text-xs">(${escapeHTML(u.id)})</span></div></div>
          ${isRead ? `<span class="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-1 rounded-full">รับทราบแล้ว</span>` : `<span class="text-xs font-bold text-rose-700 bg-rose-50 px-2 py-1 rounded-full">ยังไม่อ่าน</span>`}
        </div>`;
    });
    document.getElementById('docuack-modal-root').innerHTML = html + `</div></div></div>`;
  }

  // ----------------------------------------------------
  // 6. Global API
  // ----------------------------------------------------
  window.DocuAckApp = {
    logout: () => { state.user = null; localStorage.removeItem('docuack_session'); render(); },
    setTab: (t) => { state.tab = t; render(); },
    setSearch: (s) => { state.search = s; render(); },
    setFilterUrgency: (u) => { state.filterUrgency = u; render(); },
    
    openAddUserModal: () => { state.showAddUserModal = true; renderAddUserModal(); },
    closeAddUserModal: () => { state.showAddUserModal = false; document.getElementById('docuack-modal-root').innerHTML = ''; },
    openEditUserModal: (id) => { state.editUserModal = state.users.find(u => u.id === id); renderEditUserModal(); },
    closeEditUserModal: () => { state.editUserModal = null; document.getElementById('docuack-modal-root').innerHTML = ''; },
    deleteUser: async (id) => {
      if(confirm('ยืนยันการลบผู้ใช้รหัส '+id+' ใช่หรือไม่?')) {
        document.getElementById('global-loader').style.display = 'flex';
        try { await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: 'deleteUser', userId: id }) }); } catch(e){}
        await fetchDataFromGAS();
        document.getElementById('global-loader').style.display = 'none';
      }
    },
    
    openCreateDocModal: () => { 
      state.showCreateModal = true; 
      state.createDocForm.audienceType = 'All'; 
      state.createDocForm.selectedUserIds = state.users.map(u => String(u.id)); // ติ๊กล่วงหน้าให้ทุกคน แอดมินแค่กดยกเลิก
      renderCreateDocModal(); 
    },
    closeCreateDocModal: () => { state.showCreateModal = false; document.getElementById('docuack-modal-root').innerHTML = ''; },
    setAudienceType: (type) => { state.createDocForm.audienceType = type; renderCreateDocModal(); },
    toggleAudience: (uid) => {
      const arr = state.createDocForm.selectedUserIds;
      if (arr.includes(uid)) arr.splice(arr.indexOf(uid), 1); else arr.push(uid);
      renderCreateDocModal();
    },
    
    openViewer: (docId) => { state.viewDoc = state.docs.find(d => d.id === docId); renderViewerModal(); },
    closeViewer: () => { state.viewDoc = null; document.getElementById('docuack-modal-root').innerHTML = ''; },
    openTrackingModal: (docId) => { state.trackingDoc = state.docs.find(d => d.id === docId); renderTrackingModal(); },
    closeTrackingModal: () => { state.trackingDoc = null; document.getElementById('docuack-modal-root').innerHTML = ''; },
    
    acknowledgeDoc: async (docId) => {
      const doc = state.docs.find(d => d.id === docId);
      if (!doc || doc.readStatus.includes(state.user.id)) return;
      doc.readStatus.push(state.user.id);
      render(); // อัปเดต UI หน้าบ้านให้ปุ่มเขียวทันทีโดยไม่ต้องรอโหลด
      try { await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: 'acknowledge', docId: docId, userId: state.user.id }) }); } catch(err) {}
    }
  };

  window.addEventListener('DOMContentLoaded', initApp);
})();
