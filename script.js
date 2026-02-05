// ==========================================
// 1. CONFIGURATION & API
// ==========================================
// ⚠️ อย่าลืมเอา URL จาก Google Apps Script ของคุณมาใส่ตรงนี้ ⚠️
const API_URL = 'https://script.google.com/macros/s/AKfycbya9Ad7Q0PPZOoSKzBPDWpQrSPVgeOHeoPt1QJwDT-neZjNybEHfR24v4Vo1XSUXvQa/exec'; 

// ฟังก์ชันโหลดข้อมูล
async function getTickets() {
  try {
    const response = await fetch(API_URL);
    const data = await response.json();
    return data.reverse(); // เอาล่าสุดขึ้นก่อน
  } catch (error) {
    console.error('Error loading tickets:', error);
    return [];
  }
}

// ฟังก์ชันบันทึกข้อมูล (แจ้งเรื่องใหม่)
async function saveTicket(ticketData) {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create',
        ...ticketData
      })
    });
    
    const result = await response.json();
    
    if (result.status === 'success') {
      return true;
    } else {
      throw new Error(result.message || 'บันทึกไม่สำเร็จ');
    }
  } catch (error) {
    console.error('Error saving ticket:', error);
    Swal.fire('เกิดข้อผิดพลาด', error.message, 'error');
    return false;
  }
}

// ฟังก์ชันอัปเดตสถานะ (Admin กดรับเรื่อง/ปิดงาน)
async function updateStatus(id, newStatus) {
  // 1. เช็คข้อความที่จะถามยืนยัน
  let confirmTitle = 'ยืนยันการเปลี่ยนสถานะ?';
  let confirmText = '';
  let confirmColor = '#4f46e5';

  if (newStatus === 'in_progress') {
      confirmText = "ต้องการรับงานนี้และเริ่มดำเนินการใช่ไหม?";
      confirmColor = '#3B82F6'; // สีฟ้า
  } else if (newStatus === 'completed') {
      confirmText = "งานนี้ดำเนินการเสร็จสิ้นเรียบร้อยแล้วใช่ไหม?";
      confirmColor = '#10B981'; // สีเขียว
  } else if (newStatus === 'cancelled') {
      confirmText = "ต้องการยกเลิกงานนี้ใช่ไหม?";
      confirmColor = '#EF4444'; // สีแดง
  }

  // 2. แสดง Popup ยืนยัน
  const result = await Swal.fire({
    title: confirmTitle,
    text: confirmText,
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: confirmColor,
    cancelButtonColor: '#d33',
    confirmButtonText: 'ยืนยัน',
    cancelButtonText: 'ยกเลิก'
  });

  if (!result.isConfirmed) return;

  // 3. แสดง Loading ระหว่างส่งข้อมูล
  Swal.fire({
      title: 'กำลังบันทึก...',
      text: 'กรุณารอสักครู่',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
  });

  // 4. ส่งข้อมูลไป Google Sheets
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update_status',
        id: id,
        status: newStatus
      })
    });

    const result = await response.json();

    if (result.status !== 'success') {
      throw new Error(result.message || 'อัปเดตไม่สำเร็จ');
    }

    // 5. สำเร็จ! แจ้งเตือนและรีโหลดข้อมูล
    await Swal.fire({
      icon: 'success',
      title: 'บันทึกสำเร็จ!',
      timer: 1500,
      showConfirmButton: false
    });

    refreshData(); 

  } catch (error) {
    console.error(error);
    Swal.fire('Error', 'เกิดข้อผิดพลาดในการเชื่อมต่อ', 'error');
  }
}

// ==========================================
// 2. STATE & UI LOGIC
// ==========================================
let currentView = 'user';
let currentFilter = 'all';
let cachedTickets = []; 

// เมื่อโหลดหน้าเว็บเสร็จ
document.addEventListener('DOMContentLoaded', async () => {
  await refreshData(); 
  
  // ตรวจจับการกรอกเบอร์โทร (ให้พิมพ์ได้แค่ตัวเลข)
  const contactInput = document.getElementById('contact');
  if (contactInput) {
      contactInput.addEventListener('input', function() {
        this.value = this.value.replace(/[^0-9]/g, ''); // ลบตัวอักษรที่ไม่ใช่เลข
        if (this.value.length > 10) this.value = this.value.slice(0, 10); // ห้ามเกิน 10 ตัว
      });
  }
  
  // กด Enter เพื่อค้นหา
  document.getElementById('search-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') searchTicket();
  });
});

async function refreshData() {
    // ✨ 1. ถ้าเปิดหน้า Admin อยู่ ให้ยัด HTML Loading เข้าไปก่อนเลย
    if(currentView === 'admin') {
        document.getElementById('tickets-list').innerHTML = `
            <div class="py-12 text-center">
                <div class="inline-block animate-bounce mb-2 text-4xl">⏳</div>
                <p class="text-indigo-500 animate-pulse font-medium">กำลังโหลดข้อมูล...</p>
            </div>
        `;
    }

    // 2. เริ่มโหลดข้อมูลจริง (ช่วงนี้ User จะเห็นข้อความ Loading)
    // ถ้าหน้าเว็บโหลดครั้งแรกแล้ว API พัง ให้ใช้ cachedTickets เป็น Array ว่างเสมอ
    const data = await getTickets();
    
    if(Array.isArray(data)) {
        cachedTickets = data;
    }
    
    // 3. พอข้อมูลมาแล้ว ก็อัปเดตหน้าจอตามปกติ
    updateStats();
    
    // ถ้าอยู่หน้าติดตามสถานะ ให้รีเฟรชผลค้นหาด้วย (ถ้ามี)
    if(document.getElementById('search-input').value) {
        searchTicket();
    }

    // ถ้าอยู่หน้า Admin ให้เรนเดอร์รายการจริง (ซึ่งจะไปทับข้อความ Loading เมื่อกี้)
    if(currentView === 'admin') {
        renderAdminList();
    }
}

// สลับหน้า User / Admin
function switchView(view) {
  currentView = view;
  document.getElementById('user-view').classList.toggle('hidden', view !== 'user');
  document.getElementById('admin-view').classList.toggle('hidden', view !== 'admin');
  
  const btnUser = document.getElementById('btn-user');
  const btnAdmin = document.getElementById('btn-admin');
  
  if (view === 'user') {
    btnUser.classList.add('bg-indigo-600', 'text-white');
    btnUser.classList.remove('bg-white', 'text-gray-600');
    btnAdmin.classList.add('bg-white', 'text-gray-600');
    btnAdmin.classList.remove('bg-indigo-600', 'text-white');
  } else {
    btnAdmin.classList.add('bg-indigo-600', 'text-white');
    btnAdmin.classList.remove('bg-white', 'text-gray-600');
    btnUser.classList.add('bg-white', 'text-gray-600');
    btnUser.classList.remove('bg-indigo-600', 'text-white');
    refreshData(); 
  }
}

// สลับแท็บในหน้า User (แจ้งปัญหา / ติดตาม)
function switchUserTab(tab) {
    document.getElementById('form-section').classList.toggle('hidden', tab !== 'form');
    document.getElementById('track-section').classList.toggle('hidden', tab !== 'track');
    
    const tabForm = document.getElementById('tab-form');
    const tabTrack = document.getElementById('tab-track');
    
    if (tab === 'form') {
        tabForm.classList.add('bg-white', 'text-indigo-600', 'ring-2');
        tabForm.classList.remove('bg-gray-100', 'text-gray-500');
        tabTrack.classList.add('bg-gray-100', 'text-gray-500');
        tabTrack.classList.remove('bg-white', 'text-indigo-600', 'ring-2');
    } else {
        tabTrack.classList.add('bg-white', 'text-indigo-600', 'ring-2');
        tabTrack.classList.remove('bg-gray-100', 'text-gray-500');
        tabForm.classList.add('bg-gray-100', 'text-gray-500');
        tabForm.classList.remove('bg-white', 'text-indigo-600', 'ring-2');
    }
}

// เมื่อกดส่งฟอร์ม
document.getElementById('report-form').addEventListener('submit', async function(e) {
  e.preventDefault();
  
  Swal.fire({
      title: 'กำลังส่งข้อมูล...',
      text: 'กรุณารอสักครู่',
      allowOutsideClick: false,
      didOpen: () => { Swal.showLoading(); }
  });

  // สร้าง ID แบบสุ่ม (เช่น TK839201)
  const ticketId = 'TK' + Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
  
  const newTicket = {
    id: ticketId,
    full_name: document.getElementById('full-name').value,
    contact: document.getElementById('contact').value,
    location: document.getElementById('location').value,
    floor: document.getElementById('floor').value,
    room: document.getElementById('room').value,
    problem: document.getElementById('problem').value,
    details: document.getElementById('details').value
  };

  const isSaved = await saveTicket(newTicket);

  if (isSaved) { 
    Swal.fire({
      icon: 'success',
      title: 'ส่งแจ้งปัญหาสำเร็จ!',
      html: `รหัสติดตามของคุณคือ: <b class="text-indigo-600 text-xl">${ticketId}</b><br><span class="text-sm text-gray-500">แคปหน้าจอนี้ไว้เพื่อติดตามสถานะ</span>`,
      confirmButtonText: 'ตกลง',
      confirmButtonColor: '#4f46e5'
    }).then(() => {
      document.getElementById('report-form').reset();
      refreshData();
    });
  } else {
    // ถ้าบันทึกไม่สำเร็จ (saveTicket จะแสดง error popup เองแล้ว)
    Swal.close();
  }
});

// ฟังก์ชันค้นหา
async function searchTicket() {
  const query = document.getElementById('search-input').value.toLowerCase().trim();
  const resultsDiv = document.getElementById('search-results');
  
  resultsDiv.innerHTML = `
      <div class="col-span-1 md:col-span-2 text-center text-indigo-500 mt-8 animate-pulse">
          ⏳ กำลังค้นหาข้อมูล...
      </div>`;
  
  const data = await getTickets();
  if(Array.isArray(data)) cachedTickets = data;
  
  let found = cachedTickets;

  if (query) {
    found = cachedTickets.filter(t => 
      String(t.id).toLowerCase().includes(query) || 
      String(t.full_name).toLowerCase().includes(query) ||
      String(t.location).toLowerCase().includes(query)
    );
  }

  if (found.length === 0) {
    resultsDiv.innerHTML = `
        <div class="col-span-1 md:col-span-2 text-center py-12">
            <span class="text-4xl">❌</span>
            <p class="text-gray-500 mt-2">ไม่พบข้อมูลรายการแจ้งปัญหา</p>
        </div>`;
    return;
  }

  // ส่วนแสดงผลลัพธ์
  resultsDiv.innerHTML = found.map(t => `
    <div class="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition-all h-full flex flex-col">
        <div class="flex justify-between items-start mb-4">
            <div class="flex gap-4">
                <div class="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-2xl shrink-0">
                    ${getIcon(t.problem)}
                </div>
                <div>
                    <div class="flex items-center gap-2 flex-wrap mb-1">
                        <h4 class="font-bold text-gray-800 text-lg">${t.problem}</h4>
                        <span class="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-500 border font-mono">#${t.id}</span>
                    </div>
                    <div class="text-sm text-gray-600 space-y-0.5">
                        <p>📍 ${t.location} ชั้น ${t.floor}</p>
                        <p class="text-xs text-gray-400">📅 ${formatDate(t.timestamp)}</p>
                    </div>
                </div>
            </div>
            <div class="shrink-0">
                ${getStatusBadge(t.status)}
            </div>
        </div>
        ${t.details ? `
            <div class="mt-auto pt-4 border-t border-gray-50">
                <p class="text-sm text-gray-500 italic">"${t.details}"</p>
            </div>
        ` : ''}
    </div>
  `).join('');
}

// ฟังก์ชันแสดงรายการในหน้า Admin
function renderAdminList() {
  const listDiv = document.getElementById('tickets-list');
  let tickets = cachedTickets;

  if (currentFilter !== 'all') {
    tickets = tickets.filter(t => t.status === currentFilter);
  }

  // ปิด Loading
  document.getElementById('loading-state').classList.add('hidden');

  if (tickets.length === 0) {
    listDiv.innerHTML = `<div class="p-12 text-center text-gray-400"><span class="text-4xl block mb-2">📭</span>ไม่มีรายการ</div>`;
    return;
  }

  listDiv.innerHTML = tickets.map(t => `
    <div class="p-5 bg-white hover:bg-gray-50 border-b border-gray-100 transition-all">
        <div class="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
            
            <div class="flex items-start gap-4">
                <div class="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center text-xl shadow-sm border border-indigo-100">
                    ${getIcon(t.problem)}
                </div>
                <div>
                    <div class="flex items-center gap-2 mb-1">
                        <span class="font-bold text-gray-800 text-lg">${t.problem}</span>
                        <span class="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-500 border">#${t.id}</span>
                    </div>
                    <p class="text-sm text-gray-600">📍 ${t.location} ชั้น ${t.floor} ห้อง ${t.room || '-'} | 👤 ${t.full_name}</p>
                    <p class="text-xs text-gray-400 mt-1">📅 ${formatDate(t.timestamp)}</p>
                    ${t.details ? `<p class="mt-2 text-sm text-gray-500 bg-gray-50 p-2 rounded italic">"${t.details}"</p>` : ''}
                </div>
            </div>
            
            <div class="flex flex-col items-end gap-3 w-full sm:w-auto mt-2 sm:mt-0 pl-16 sm:pl-0">
                 ${getStatusBadge(t.status)}
                 
                 <div class="flex gap-2">
                    
                    ${t.status === 'pending' ? `
                    <button onclick="updateStatus('${t.id}', 'in_progress')" class="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold rounded shadow-sm transition-all flex items-center gap-1">
                        🛠️ รับเรื่อง
                    </button>
                    <button onclick="updateStatus('${t.id}', 'cancelled')" class="px-3 py-1.5 bg-white border border-red-200 text-red-500 hover:bg-red-50 text-xs font-bold rounded shadow-sm transition-all flex items-center gap-1">
                        ❌ ยกเลิก
                    </button>
                    ` : ''}

                    ${t.status === 'in_progress' ? `
                    <button onclick="updateStatus('${t.id}', 'completed')" class="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded shadow-sm transition-all flex items-center gap-1">
                        ✅ เสร็จสิ้น
                    </button>
                    ` : ''}

                 </div>
            </div>

        </div>
    </div>
  `).join('');
}

function filterTickets(status) {
    currentFilter = status;
    // แสดง Loading หลอกๆ เพื่อความสมูท
    document.getElementById('tickets-list').innerHTML = '';
    document.getElementById('loading-state').classList.remove('hidden');
    
    setTimeout(() => {
        renderAdminList();
    }, 300);
}

function clearAllData() {
    Swal.fire({
        icon: 'info',
        title: 'วิธีล้างข้อมูล',
        text: 'เนื่องจากเหตุผลด้านความปลอดภัย กรุณาไปลบแถวข้อมูลในไฟล์ Google Sheets โดยตรงครับ',
        confirmButtonText: 'เข้าใจแล้ว'
    });
}

// ==========================================
// 3. UTILITIES (ฟังก์ชันตัวช่วย)
// ==========================================

function updateStats() {
  const tickets = cachedTickets;
  if(!Array.isArray(tickets)) return; // ป้องกัน error ถ้าข้อมูลไม่มา
  
  document.getElementById('stat-total').innerText = tickets.length;
  document.getElementById('stat-pending').innerText = tickets.filter(t => t.status === 'pending').length;
  document.getElementById('stat-completed').innerText = tickets.filter(t => t.status === 'completed').length;
  document.getElementById('stat-cancelled').innerText = tickets.filter(t => t.status === 'cancelled').length;
}

function getStatusBadge(status) {
  if (status === 'pending') return '<span class="px-3 py-1 bg-amber-50 text-amber-600 rounded-full text-xs font-bold border border-amber-100 shadow-sm">⏳ รอดำเนินการ</span>';
  if (status === 'in_progress') return '<span class="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-xs font-bold border border-blue-100 shadow-sm">🛠️ กำลังดำเนินการ</span>';
  if (status === 'completed') return '<span class="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-xs font-bold border border-emerald-100 shadow-sm">✅ เสร็จสิ้น</span>';
  return '<span class="px-3 py-1 bg-red-50 text-red-600 rounded-full text-xs font-bold border border-red-100 shadow-sm">❌ ยกเลิก</span>';
}

function getIcon(problem) {
    const icons = { 'ไฟฟ้า': '💡', 'ประปา': '🚿', 'แอร์': '❄️', 'อุปกรณ์ IT': '💻', 'อาคารสถานที่': '🏢', 'ความสะอาด': '🧹' };
    return icons[problem] || '📦';
}

function formatDate(isoString) {
    if(!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleString('th-TH', {
        year: '2-digit', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}

