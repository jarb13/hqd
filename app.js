/**
 * DocuAck Application Logic (Full Version)
 */
(function() {
  // --- 1. Utility & Security Functions ---
  const escapeHTML = (str) => {
    if (str === null || str === undefined) return '';
    return String(str).replace(/[&<>'"]/g, 
      tag => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
      }[tag] || tag)
    );
  };

  // เปลี่ยนเป็น URL ของ GAS คุณ
  const API_URL = "https://script.google.com/macros/s/AKfycbwh-PvW0UNXCz99CbzZJx9QJxhwL-M13P0fDn_55NTT_r942YryR6OuGhdmZiKlcVW_/exec";

  // --- 2. State Management ---
  let state = {
    user: JSON.parse(localStorage.getItem('docuack_session')) || null,
    users: [], 
    docs: [],  
    tab: 'documents',
    search: '',
    filterUrgency: 'all',
    filterStatus: 'all',
    viewDoc: null,
    trackingDoc: null,
    showCreateModal: false,
    userSearch: '',
    createDocForm: { audienceType: 'All', selectedUserIds: [], filterDept: 'all', searchKeyword: '' }
  };

  // --- 3. API Initialization ---
  async function initApp() {
    const loader = document.getElementById('global-loader');
    
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'getAppData' })
      });
      if (!response.ok) throw new Error("HTTP Status: " + response.status);
      
      const result = await response.json();
      if (result.status === 'success') {
        state.users = result.data.users || [];
        state.docs = result.data.docs || [];
      }
    } catch (error) {
      console.warn("API Error:", error);
      alert("ไม่สามารถเชื่อมต่อฐานข้อมูลได้ โปรดตรวจสอบ Vercel หรือ GAS URL");
    } 
    
    loader.style.display = 'none';
    render();
  }

  // --- 4. Render Layouts ---
  function render() {
    const app = document.getElementById('app');
    if (!state.user) renderLogin(app);
    else renderDashboard(app);
  }

  // 4.1 Login Screen
  function renderLogin(app) {
    app.innerHTML = `
      <div class="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 flex flex-col justify-center py-12 px-4">
        <div class="sm:mx-auto sm:w-full sm:max-w-md bg-white rounded-2xl shadow-2xl p-8">
          <div class="text-center mb-6">
            <div class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 text-white mb-2"><i class="fa-solid fa-file-circle-check text-3xl"></i></div>
            <h1 class="text-2xl font-extrabold text-slate-800">DocuAck Portal</h1>
          </div>
          <form id="loginForm" class="space-y-4">
            <div>
              <label class="block text-xs font-bold text-slate-600 mb-1">รหัสพนักงาน (Employee ID)</label>
              <input type="text" id="loginId" required class="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl" />
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-600 mb-1">รหัสผ่าน (PIN)</label>
              <input type="password" id="loginPin" required class="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl" />
            </div>
            <div id="loginError" class="text-xs text-red-600 hidden text-center bg-red-50 p-2 rounded-xl"></div>
            <button type="submit" class="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold">เข้าสู่ระบบ</button>
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
      localStorage.setItem('docuack_session', JSON.stringify(u));
      render();
    };
  }

  // 4.2 Dashboard Container
  function renderDashboard(app) {
    const isAdmin = (String(state.user.role).trim().toLowerCase() === 'admin');
    
    app.innerHTML = `
      <header class="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div class="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div class="font-bold text-lg"><i class="fa-solid fa-file-circle-check text-blue-600 mr-2"></i>DocuAck</div>
          <div class="flex items-center gap-4 text-sm font-bold">
            <span>${escapeHTML(state.user.name)} (${isAdmin ? 'Admin' : 'User'})</span>
            <button onclick="DocuAckApp.logout()" class="text-red-600 hover:underline">ออกจากระบบ</button>
          </div>
        </div>
      </header>
      <main class="max-w-7xl mx-auto px-4 py-6">
        <div class="flex gap-4 border-b border-slate-200 mb-6">
          <button onclick="DocuAckApp.setTab('documents')" class="py-2 px-4 font-bold ${state.tab === 'documents' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500'}">หน้าเอกสาร</button>
          ${isAdmin ? `<button onclick="DocuAckApp.setTab('users')" class="py-2 px-4 font-bold ${state.tab === 'users' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500'}">จัดการบุคลากร</button>` : ''}
        </div>
        <div id="content-container"></div>
      </main>
    `;

    if (state.tab === 'documents') document.getElementById('content-container').innerHTML = renderDocsTab(isAdmin);
    else document.getElementById('content-container').innerHTML = renderUsersTab();

    if (state.viewDoc) renderViewerModal();
    if (state.showCreateModal) renderCreateDocModal();
    if (state.trackingDoc) renderTrackingModal();
  }

  // 4.3 Documents Tab
  function renderDocsTab(isAdmin) {
    let html = `
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-bold">รายการเอกสารเวียน</h2>
        ${isAdmin ? `<button onclick="DocuAckApp.openCreateDocModal()" class="px-4 py-2 bg-amber-400 text-slate-900 font-bold rounded-xl"><i class="fa-solid fa-plus"></i> สร้างเอกสารใหม่</button>` : ''}
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
    `;

    const filteredDocs = state.docs.filter(d => {
      // ตรวจสอบสิทธิ์ว่าได้รับมอบหมายหรือไม่
      const isAssigned = isAdmin || d.targetAudience === 'All' || d.targetAudience.includes(state.user.id);
      return isAssigned;
    });

    filteredDocs.forEach(doc => {
      const isRead = Array.isArray(doc.readStatus) && doc.readStatus.includes(state.user.id);
      let actionHtml = isRead 
        ? `<span class="px-3 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 rounded-xl"><i class="fa-solid fa-check"></i> รับทราบแล้ว</span>`
        : `<button onclick="DocuAckApp.acknowledgeDoc('${escapeHTML(doc.id)}')" class="px-3 py-2 text-xs font-bold text-white bg-blue-600 rounded-xl">รับทราบเอกสาร</button>`;

      html += `
        <div class="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col justify-between shadow-sm">
          <div>
            <div class="text-xs font-mono text-slate-400 mb-1">${escapeHTML(doc.id)}</div>
            <h3 class="text-sm font-bold text-slate-900 mb-2">${escapeHTML(doc.title)}</h3>
            <p class="text-xs text-slate-500 mb-3">เป้าหมาย: ${doc.targetAudience === 'All' ? 'ทุกคน' : 'ระบุบุคคล'}</p>
          </div>
          <div class="flex justify-between gap-2 border-t pt-3 border-slate-100">
            <button onclick="DocuAckApp.openViewer('${escapeHTML(doc.id)}')" class="flex-1 px-3 py-2 text-xs font-bold border border-slate-300 rounded-xl hover:bg-slate-50"><i class="fa-regular fa-eye"></i> เปิดอ่าน</button>
            ${isAdmin ? `<button onclick="DocuAckApp.openTrackingModal('${escapeHTML(doc.id)}')" class="px-3 py-2 text-xs font-bold bg-purple-50 text-purple-700 rounded-xl border border-purple-200">ตรวจสอบ</button>` : ''}
            ${actionHtml}
          </div>
        </div>
      `;
    });
    html += `</div>`;
    return html;
  }

  // 4.4 Users Tab (ตารางพนักงาน)
  function renderUsersTab() {
    let html = `
      <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h2 class="text-lg font-bold mb-4">ข้อมูลบุคลากรในระบบ (อ้างอิงจาก ชีต Users)</h2>
        <div class="overflow-x-auto">
          <table class="w-full text-left text-sm">
            <thead class="bg-slate-50 border-b border-slate-200">
              <tr>
                <th class="py-3 px-4">รหัสพนักงาน</th>
                <th class="py-3 px-4">ชื่อ-นามสกุล</th>
                <th class="py-3 px-4">แผนก</th>
                <th class="py-3 px-4">Role</th>
                <th class="py-3 px-4">อีเมล (Email)</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
    `;

    state.users.forEach(u => {
      html += `
        <tr class="hover:bg-slate-50">
          <td class="py-3 px-4 font-mono font-bold">${escapeHTML(u.id)}</td>
          <td class="py-3 px-4">${escapeHTML(u.name)}</td>
          <td class="py-3 px-4">${escapeHTML(u.department)}</td>
          <td class="py-3 px-4"><span class="px-2 py-1 rounded bg-slate-100 text-xs">${escapeHTML(u.role)}</span></td>
          <td class="py-3 px-4 text-slate-500">${escapeHTML(u.email || '-')}</td>
        </tr>
      `;
    });

    html += `</tbody></table></div></div>`;
    return html;
  }

  // --- 5. Modals ---

  // 5.1 Create Document Modal (ฟอร์มสร้างเอกสารใหม่)
  function renderCreateDocModal() {
    const today = new Date().toISOString().split('T')[0];
    
    document.getElementById('modal-container').innerHTML = `
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4">
        <div class="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl">
          <div class="flex justify-between items-center mb-4 border-b pb-2">
            <h3 class="font-bold text-lg">สร้างเอกสารเวียนใหม่</h3>
            <button onclick="DocuAckApp.closeCreateDocModal()" class="text-slate-400 font-bold hover:text-red-500">✕ ปิด</button>
          </div>
          <form id="createDocForm" class="space-y-3">
            <div>
              <label class="block text-xs font-bold mb-1">ชื่อเรื่อง</label>
              <input type="text" id="newTitle" required class="w-full px-3 py-2 border rounded-xl" />
            </div>
            <div>
              <label class="block text-xs font-bold mb-1">ลิงก์ไฟล์ (File URL) หรือ แนบไฟล์ลง Drive</label>
              <input type="url" id="newFileUrl" required placeholder="https://drive.google.com/..." class="w-full px-3 py-2 border rounded-xl" />
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-bold mb-1">ความสำคัญ</label>
                <select id="newUrgency" class="w-full px-3 py-2 border rounded-xl">
                  <option value="Normal">ทั่วไป</option>
                  <option value="Urgent">ด่วนมาก</option>
                  <option value="Very Urgent">ด่วนที่สุด</option>
                </select>
              </div>
              <div>
                <label class="block text-xs font-bold mb-1">Deadline</label>
                <input type="date" id="newEndDate" class="w-full px-3 py-2 border rounded-xl" />
              </div>
            </div>
            <button type="submit" id="btnSubmitDoc" class="w-full py-3 bg-blue-600 text-white rounded-xl font-bold mt-4">อัปโหลดเข้าเซิร์ฟเวอร์</button>
          </form>
        </div>
      </div>
    `;

    document.getElementById('createDocForm').onsubmit = async (e) => {
      e.preventDefault();
      const btn = document.getElementById('btnSubmitDoc');
      btn.innerText = "กำลังบันทึก..."; btn.disabled = true;

      const payload = {
        action: 'addDocument',
        data: {
          title: document.getElementById('newTitle').value,
          fileUrl: document.getElementById('newFileUrl').value,
          urgencyLevel: document.getElementById('newUrgency').value,
          startDate: today,
          endDate: document.getElementById('newEndDate').value,
          targetAudience: 'All'
        }
      };

      try {
        await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload)
        });
        alert('สร้างเอกสารเรียบร้อยแล้ว (รีเฟรชหน้าเว็บเพื่อดูข้อมูล)');
        DocuAckApp.closeCreateDocModal();
        location.reload();
      } catch (err) {
        alert("เกิดข้อผิดพลาดในการเชื่อมต่อ: " + err);
        btn.innerText = "ลองอีกครั้ง"; btn.disabled = false;
      }
    };
  }

  // 5.2 Viewer Modal (อ่านเอกสาร)
  function renderViewerModal() {
    const doc = state.viewDoc;
    document.getElementById('modal-container').innerHTML = `
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-4">
        <div class="bg-white rounded-2xl w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden">
          <div class="p-4 border-b flex justify-between bg-slate-50">
            <h3 class="font-bold text-slate-900">${escapeHTML(doc.title)}</h3>
            <button onclick="DocuAckApp.closeViewer()" class="text-slate-400 font-bold">✕ ปิด</button>
          </div>
          <iframe src="${doc.fileUrl}" class="w-full h-full bg-slate-100" frameborder="0"></iframe>
        </div>
      </div>
    `;
  }

  // 5.3 Tracking Modal (ตรวจสอบคนอ่าน)
  function renderTrackingModal() {
    const doc = state.trackingDoc;
    const readers = Array.isArray(doc.readStatus) ? doc.readStatus : [];
    
    // หาเป้าหมาย (ทั้งหมด หรือเฉพาะคน)
    const targets = (doc.targetAudience === 'All') ? state.users : state.users.filter(u => doc.targetAudience.includes(u.id));

    let html = `
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-4">
        <div class="bg-white rounded-2xl w-full max-w-xl max-h-[80vh] flex flex-col">
          <div class="p-4 border-b flex justify-between bg-slate-50">
            <h3 class="font-bold text-slate-900">ตรวจสอบผู้รับทราบ: ${escapeHTML(doc.id)}</h3>
            <button onclick="DocuAckApp.closeTrackingModal()" class="text-slate-400 font-bold">✕ ปิด</button>
          </div>
          <div class="flex-1 overflow-y-auto p-4 space-y-2">
    `;

    targets.forEach(u => {
      const isRead = readers.includes(u.id);
      html += `
        <div class="flex justify-between items-center p-2 border-b border-slate-100">
          <div><span class="font-bold text-sm">${escapeHTML(u.name)}</span> <span class="text-xs text-slate-500">(${escapeHTML(u.id)})</span></div>
          ${isRead ? `<span class="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">รับทราบแล้ว</span>` : `<span class="text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded">ยังไม่อ่าน</span>`}
        </div>
      `;
    });

    html += `</div></div></div>`;
    document.getElementById('modal-container').innerHTML = html;
  }


  // --- 6. Global Window API (DocuAckApp) ---
  window.DocuAckApp = {
    logout: () => { state.user = null; localStorage.removeItem('docuack_session'); render(); },
    setTab: (t) => { state.tab = t; render(); },
    
    openCreateDocModal: () => { state.showCreateModal = true; render(); },
    closeCreateDocModal: () => { state.showCreateModal = false; document.getElementById('modal-container').innerHTML = ''; },
    
    openViewer: (docId) => { state.viewDoc = state.docs.find(d => d.id === docId); renderViewerModal(); },
    closeViewer: () => { state.viewDoc = null; document.getElementById('modal-container').innerHTML = ''; },
    
    openTrackingModal: (docId) => { state.trackingDoc = state.docs.find(d => d.id === docId); renderTrackingModal(); },
    closeTrackingModal: () => { state.trackingDoc = null; document.getElementById('modal-container').innerHTML = ''; },
    
    acknowledgeDoc: async (docId) => {
      const doc = state.docs.find(d => d.id === docId);
      if (!doc || doc.readStatus.includes(state.user.id)) return;
      
      doc.readStatus.push(state.user.id);
      render(); // อัปเดต UI ทันที

      try {
        await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: 'acknowledge', docId: docId, userId: state.user.id })
        });
      } catch (err) { console.error("API Update Error", err); }
    }
  };

  // เริ่มทำงานเมื่อเบราว์เซอร์โหลดเสร็จ
  window.addEventListener('DOMContentLoaded', initApp);

})();
