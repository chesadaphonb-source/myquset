// ==========================================
// 1. CONFIGURATION & API
// ==========================================
// ⚠️ เอาลิงก์ Web App URL จาก Google Apps Script มาวางตรงนี้ครับ ⚠️
const API_URL = 'https://script.google.com/macros/s/AKfycbxnEqQcf9cmLzuzT5i9UW0QnVaNsBFNGfMpqfMcVqETjpUtoH0-Ydy6-t4wkv96KL3t/exec'; 

// ฟังก์ชันโหลดข้อมูลจาก Google Sheets
async function getTickets() {
  try {
    const response = await fetch(API_URL);
    const data = await response.json();
    // เรียงลำดับเอาล่าสุดขึ้นก่อน (Reverse)
    return data.reverse();
  } catch (error) {
    console.error('Error loading tickets:', error);
    Swal.fire('Error', 'ไม่สามารถโหลดข้อมูลได้', 'error');
    return [];
  }
}

// ฟังก์ชันบันทึกข้อมูลลง Google Sheets
async function saveTicket(ticketData) {
  try {
    // ใช้ no-cors เพื่อส่งข้อมูลไป Google Script โดยไม่ติด Browser Block
    // หมายเหตุ: เราจะไม่รู้ว่าส่งสำเร็จไหม 100% แต่ปกติถ้า URL ถูกก็จะเข้า
    const response = await fetch(API_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(ticketData)
    });
    return true;
  } catch (error) {
    console.error('Error saving ticket:', error);
    return false;
  }
}

// เนื่องจาก Google Sheets เป็น Database ธรรมดา การแก้สถานะ (Edit) จะซับซ้อนกว่า
// ในเวอร์ชันพื้นฐานนี้ เราจะทำได้แค่ "เพิ่ม" และ "อ่าน" ก่อนนะครับ
// ถ้าจะทำระบบ Admin แก้ไขสถานะ ต้องเขียน Script ฝั่ง Google เพิ่มอีกเยอะ
// ดังนั้นตอนนี้ปุ่ม Admin จะแสดงผลเฉยๆ แต่กดเปลี่ยนสถานะใน Sheet จริงไม่ได้ (ต้องไปแก้ใน Excel เอา)
function changeStatus(id, newStatus) {
    Swal.fire({
        icon: 'info',
        title: 'แจ้งเตือน',
        text: 'ในเวอร์ชัน Google Sheets พื้นฐาน กรุณาไปเปลี่ยนสถานะที่ไฟล์ Google Sheets โดยตรงครับ (คอลัมน์ J)',
    });
}


// ==========================================
// 2. STATE & UI LOGIC (ส่วนนี้เหมือนเดิม แต่เปลี่ยนเป็น Async)
// ==========================================
let currentView = 'user';
let currentFilter = 'all';
let cachedTickets = []; // เก็บข้อมูลไว้ชั่วคราว

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  await refreshData(); // โหลดข้อมูลครั้งแรก
  const contactInput = document.getElementById('contact');
  if (contactInput) {
      contactInput.addEventListener('input', function() {
        // 1. แทนที่ตัวอักษรแปลกปลอม (ก-ฮ, a-z) ด้วยค่าว่าง (เหลือแค่ตัวเลข)
        this.value = this.value.replace(/[^0-9]/g, '');
        
        // 2. ถ้าเกิน 10 ตัว ให้ตัดทิ้ง
        if (this.value.length > 10) {
            this.value = this.value.slice(0, 10);
        }
      });
  }
  
  document.getElementById('search-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') searchTicket();
  });
});

async function refreshData() {
    // ดึงข้อมูลมาเก็บในตัวแปร
    cachedTickets = await getTickets();
    // อัปเดตตัวเลขสถิติ
    updateStats();
    // ถ้าเปิดหน้า Admin อยู่ ให้แสดงรายการใหม่ทันที
    if(currentView === 'admin') {
        renderAdminList();
    }
}
// View Switcher
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
    refreshData(); // โหลดข้อมูลใหม่ทุกครั้งที่เข้า Admin
  }
}

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
      
        searchTicket();
    }
}

// Form Handler
document.getElementById('report-form').addEventListener('submit', async function(e) {
  e.preventDefault();
  
  // Show Loading
  Swal.fire({
      title: 'กำลังส่งข้อมูล...',
      text: 'กรุณารอสักครู่',
      allowOutsideClick: false,
      didOpen: () => { Swal.showLoading(); }
  });

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

  await saveTicket(newTicket);

  // Success Alert
  Swal.fire({
    icon: 'success',
    title: 'ส่งแจ้งปัญหาสำเร็จ!',
    html: `รหัสติดตามของคุณคือ: <b class="text-indigo-600 text-xl">${ticketId}</b><br><span class="text-sm text-gray-500">บันทึกข้อมูลลงระบบเรียบร้อยแล้ว</span>`,
    confirmButtonText: 'ตกลง',
    confirmButtonColor: '#4f46e5'
  }).then(() => {
    this.reset();
    refreshData(); // โหลดข้อมูลใหม่หลังส่ง
  });
});

// Search Logic
async function searchTicket() {
  const query = document.getElementById('search-input').value.toLowerCase().trim();
  const resultsDiv = document.getElementById('search-results');
  
  // แสดง Loading
  resultsDiv.innerHTML = '<p class="text-center text-indigo-500 mt-4">⏳ กำลังโหลดข้อมูล...</p>';
  
  // โหลดข้อมูลล่าสุดเสมอ
  cachedTickets = await getTickets();
  
  let found = cachedTickets;

  // ถ้ามีการพิมพ์ค้นหา ให้กรองข้อมูล (ถ้าไม่พิมพ์ ก็โชว์ทั้งหมดเลย)
  if (query) {
    found = cachedTickets.filter(t => 
      String(t.id).toLowerCase().includes(query) || 
      String(t.full_name).toLowerCase().includes(query) ||
      String(t.location).toLowerCase().includes(query) // เพิ่มให้ค้นหาจากสถานที่ได้ด้วย
    );
  }

  // กรณีไม่เจอข้อมูลเลย
  if (found.length === 0) {
    resultsDiv.innerHTML = `
        <div class="text-center py-8">
            <p class="text-gray-500">❌ ไม่พบข้อมูลรายการแจ้งปัญหา</p>
        </div>`;
    return;
  }

  // วาดรายการออกมา (หน้าตาคล้าย Admin แต่ไม่มีปุ่มกด)
  resultsDiv.innerHTML = found.map(t => `
    <div class="bg-white rounded-xl p-4 border border-gray-200 shadow-sm mb-3 hover:shadow-md transition-shadow">
      <div class="flex justify-between items-start">
        
        <div class="flex gap-3">
             <div class="mt-1 w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center text-lg shrink-0">
                ${getIcon(t.problem)}
            </div>

            <div>
                <div class="flex items-center gap-2 flex-wrap">
                    <h4 class="font-bold text-gray-800 text-base">${t.problem}</h4>
                    <span class="px-2 py-0.5 rounded text-[10px] bg-gray-100 text-gray-500 border font-mono">#${t.id}</span>
                </div>
                
                <div class="text-sm text-gray-600 mt-1 space-y-1">
                    <p>📍 ${t.location} ชั้น ${t.floor} ${t.room ? 'ห้อง '+t.room : ''}</p>
                    <p class="text-xs text-gray-400">👤 แจ้งโดย: ${t.full_name} • 📅 ${formatDate(t.timestamp)}</p>
                </div>

                ${t.details ? `<p class="mt-2 text-sm text-gray-500 bg-gray-50 p-2 rounded border border-gray-100 italic">"${t.details}"</p>` : ''}
            </div>
        </div>

        <div class="shrink-0 ml-2">
            ${getStatusBadge(t.status)}
        </div>

      </div>
    </div>
  `).join('');
}

// Admin List Logic
function renderAdminList() {
  const listDiv = document.getElementById('tickets-list');
  let tickets = cachedTickets;

  if (currentFilter !== 'all') {
    tickets = tickets.filter(t => t.status === currentFilter);
  }

  if (tickets.length === 0) {
    listDiv.innerHTML = `<div class="p-12 text-center text-gray-400">📭 ไม่มีรายการ</div>`;
    return;
  }

  listDiv.innerHTML = tickets.map(t => `
    <div class="p-4 bg-white hover:bg-gray-50 border-b border-gray-100 transition-all">
        <div class="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
            
            <div class="flex items-start gap-4">
                <div class="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center text-xl shadow-sm">
                    ${getIcon(t.problem)}
                </div>
                <div>
                    <div class="flex items-center gap-2 mb-1">
                        <span class="font-bold text-gray-800 text-lg">${t.problem}</span>
                        <span class="px-2 py-0.5 rounded text-[10px] bg-gray-100 text-gray-500 border">#${t.id}</span>
                    </div>
                    <p class="text-sm text-gray-600">📍 ${t.location} ชั้น ${t.floor} ห้อง ${t.room || '-'} | 👤 ${t.full_name}</p>
                    <p class="text-xs text-gray-400 mt-1">📅 ${formatDate(t.timestamp)}</p>
                    ${t.details ? `<p class="mt-2 text-sm text-gray-500 bg-gray-50 p-2 rounded italic">"${t.details}"</p>` : ''}
                </div>
            </div>
            
            <div class="flex flex-col items-end gap-2 w-full sm:w-auto mt-2 sm:mt-0 pl-16 sm:pl-0">
                 ${getStatusBadge(t.status)}
                 
                 <div class="flex gap-2 mt-1">
                    
                    ${t.status === 'pending' ? `
                    <button onclick="updateStatus('${t.id}', 'in_progress')" class="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold rounded shadow-sm transition-all">
                        🛠️ รับเรื่อง
                    </button>
                    <button onclick="updateStatus('${t.id}', 'cancelled')" class="px-3 py-1.5 bg-white border border-red-200 text-red-500 hover:bg-red-50 text-xs font-bold rounded shadow-sm transition-all">
                        ❌ ยกเลิก
                    </button>
                    ` : ''}

                    ${t.status === 'in_progress' ? `
                    <button onclick="updateStatus('${t.id}', 'completed')" class="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded shadow-sm transition-all">
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
    renderAdminList();
}

function clearAllData() {
    Swal.fire('Info', 'กรุณาลบข้อมูลใน Google Sheets โดยตรงครับ', 'info');
}

// Utilities
function updateStats() {
  const tickets = cachedTickets;
  document.getElementById('stat-total').innerText = tickets.length;
  document.getElementById('stat-pending').innerText = tickets.filter(t => t.status === 'pending').length;
  document.getElementById('stat-completed').innerText = tickets.filter(t => t.status === 'completed').length;
  document.getElementById('stat-cancelled').innerText = tickets.filter(t => t.status === 'cancelled').length;
}

function getStatusBadge(status) {
  if (status === 'pending') {
    return '<span class="px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-bold border border-amber-200">⏳ รอดำเนินการ</span>';
  }
  if (status === 'in_progress') {
    // ✨ สถานะใหม่: สีฟ้า
    return '<span class="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold border border-blue-200">🛠️ กำลังดำเนินการ</span>';
  }
  if (status === 'completed') {
    return '<span class="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold border border-emerald-200">✅ เสร็จสิ้น</span>';
  }
  return '<span class="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold border border-red-200">❌ ยกเลิก</span>';
}

function getIcon(problem) {
    const icons = { 'ไฟฟ้า': '💡', 'ประปา': '🚿', 'แอร์': '❄️', 'อุปกรณ์ IT': '💻', 'ความสะอาด': '🧹' };
    return icons[problem] || '🔧';
}

function formatDate(isoString) {
    if(!isoString) return '';
    return new Date(isoString).toLocaleString('th-TH');
}

// ฟังก์ชันส่งคำสั่งอัปเดตสถานะไป Google Sheets
async function updateStatus(id, newStatus) {
  let confirmTitle = 'ยืนยันการเปลี่ยนสถานะ?';
  let confirmText = '';
  let confirmColor = '#4f46e5';

  // กำหนดข้อความตามสถานะที่จะเปลี่ยน
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

  const confirmResult = await Swal.fire({
    title: confirmTitle,
    text: confirmText,
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: confirmColor,
    confirmButtonText: 'ยืนยัน',
    cancelButtonText: 'ถอยกลับ'
  });

  if (!confirmResult.isConfirmed) return;

  // ... (ส่วนที่เหลือเหมือนเดิมเป๊ะ)
  Swal.fire({ title: 'กำลังบันทึก...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

  try {
    await fetch(API_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update_status',
        id: id,
        status: newStatus
      })
    });

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



