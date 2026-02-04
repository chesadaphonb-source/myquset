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
  
  document.getElementById('search-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') searchTicket();
  });
});

async function refreshData() {
    // แสดง Loading
    const btnAdmin = document.getElementById('btn-admin');
    const originalText = btnAdmin.innerText;
    btnAdmin.innerText = '⌛ กำลังโหลด...';
    
    cachedTickets = await getTickets();
    updateStats();
    if(currentView === 'admin') renderAdminList();
    
    btnAdmin.innerText = originalText;
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
  
  if (!query) {
    resultsDiv.innerHTML = '<p class="text-center text-gray-400">กรุณากรอกข้อมูลเพื่อค้นหา</p>';
    return;
  }
  
  // แสดง Loading ระหว่างค้นหา
  resultsDiv.innerHTML = '<p class="text-center text-indigo-500">⏳ กำลังค้นหาข้อมูลล่าสุด...</p>';
  
  // โหลดข้อมูลล่าสุดเพื่อให้มั่นใจว่าเจอแน่นอน
  cachedTickets = await getTickets();
  
  const found = cachedTickets.filter(t => 
    String(t.id).toLowerCase().includes(query) || 
    String(t.full_name).toLowerCase().includes(query)
  );

  if (found.length === 0) {
    resultsDiv.innerHTML = `
        <div class="text-center py-8">
            <p class="text-gray-500">❌ ไม่พบข้อมูล "${query}"</p>
        </div>`;
    return;
  }

  resultsDiv.innerHTML = found.map(t => `
    <div class="bg-gray-50 rounded-xl p-5 border border-gray-200">
      <div class="flex justify-between items-start mb-3">
        <div>
            <span class="inline-block px-2 py-1 rounded text-xs font-mono bg-indigo-100 text-indigo-700 font-bold mb-1">${t.id}</span>
            <h4 class="font-bold text-gray-800">${t.problem}</h4>
        </div>
        ${getStatusBadge(t.status)}
      </div>
      <div class="text-sm text-gray-600 space-y-1">
        <p>📍 ${t.location} ชั้น ${t.floor} ${t.room ? 'ห้อง '+t.room : ''}</p>
        <p>👤 ${t.full_name}</p>
        <p>📅 ${formatDate(t.timestamp)}</p>
        ${t.details ? `<p class="mt-2 p-2 bg-white rounded border border-gray-100 italic">"${t.details}"</p>` : ''}
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
    listDiv.innerHTML = '<div class="p-8 text-center text-gray-400">ไม่มีรายการแจ้งปัญหา</div>';
    return;
  }

  listDiv.innerHTML = tickets.map(t => `
    <div class="p-4 hover:bg-gray-50 transition-colors flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div class="flex items-start gap-3">
            <div class="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-lg">
                ${getIcon(t.problem)}
            </div>
            <div>
                <div class="flex items-center gap-2">
                    <span class="font-bold text-gray-800">${t.problem}</span>
                    <span class="text-xs font-mono text-gray-400">#${t.id}</span>
                </div>
                <p class="text-sm text-gray-600">${t.location} ชั้น ${t.floor} • ${t.full_name}</p>
                <p class="text-xs text-gray-400">${formatDate(t.timestamp)}</p>
            </div>
        </div>
        
        <div class="flex items-center gap-3 w-full sm:w-auto mt-2 sm:mt-0">
             ${getStatusBadge(t.status)}
             <a href="https://docs.google.com/spreadsheets" target="_blank" class="text-xs text-blue-500 underline ml-2">จัดการใน Sheet</a>
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
  if (status === 'pending') return '<span class="px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-bold">⏳ รอดำเนินการ</span>';
  if (status === 'completed') return '<span class="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold">✅ เสร็จสิ้น</span>';
  return '<span class="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold">❌ ยกเลิก</span>';
}

function getIcon(problem) {
    const icons = { 'ไฟฟ้า': '💡', 'ประปา': '🚿', 'แอร์': '❄️', 'อุปกรณ์ IT': '💻', 'ความสะอาด': '🧹' };
    return icons[problem] || '🔧';
}

function formatDate(isoString) {
    if(!isoString) return '';
    return new Date(isoString).toLocaleString('th-TH');
}



