// ==========================================
// 1. DATA MANAGEMENT (LocalStorage Replacement)
// ==========================================
const DB_KEY = 'service_desk_tickets';

function getTickets() {
  const data = localStorage.getItem(DB_KEY);
  return data ? JSON.parse(data) : [];
}

function saveTicket(ticket) {
  const tickets = getTickets();
  tickets.unshift(ticket); // Add new to top
  localStorage.setItem(DB_KEY, JSON.stringify(tickets));
  return true;
}

function updateTicketStatus(id, status) {
  const tickets = getTickets();
  const index = tickets.findIndex(t => t.id === id);
  if (index !== -1) {
    tickets[index].status = status;
    tickets[index].updated_at = new Date().toISOString();
    localStorage.setItem(DB_KEY, JSON.stringify(tickets));
    return true;
  }
  return false;
}

function clearAllData() {
    if(confirm('คุณแน่ใจหรือไม่ที่จะลบข้อมูลทั้งหมด?')) {
        localStorage.removeItem(DB_KEY);
        location.reload();
    }
}

// ==========================================
// 2. STATE & UI LOGIC
// ==========================================
let currentView = 'user';
let currentFilter = 'all';

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  updateStats();
  // Auto-search on enter
  document.getElementById('search-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') searchTicket();
  });
});

// View Switcher
function switchView(view) {
  currentView = view;
  document.getElementById('user-view').classList.toggle('hidden', view !== 'user');
  document.getElementById('admin-view').classList.toggle('hidden', view !== 'admin');
  
  // Update Buttons
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
    renderAdminList(); // Refresh admin list
    updateStats();
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
document.getElementById('report-form').addEventListener('submit', function(e) {
  e.preventDefault();
  
  const ticketId = 'TK' + Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
  const now = new Date().toISOString();
  
  const newTicket = {
    id: ticketId,
    full_name: document.getElementById('full-name').value,
    contact: document.getElementById('contact').value,
    location: document.getElementById('location').value,
    floor: document.getElementById('floor').value,
    room: document.getElementById('room').value,
    problem: document.getElementById('problem').value,
    details: document.getElementById('details').value,
    status: 'pending',
    created_at: now,
    updated_at: now
  };

  saveTicket(newTicket);

  // Success Alert
  Swal.fire({
    icon: 'success',
    title: 'ส่งแจ้งปัญหาสำเร็จ!',
    html: `รหัสติดตามของคุณคือ: <b class="text-indigo-600 text-xl">${ticketId}</b><br><span class="text-sm text-gray-500">กรุณาบันทึกไว้เพื่อตรวจสอบสถานะ</span>`,
    confirmButtonText: 'ตกลง',
    confirmButtonColor: '#4f46e5'
  }).then(() => {
    this.reset();
    updateStats();
  });
});

// Search Logic
function searchTicket() {
  const query = document.getElementById('search-input').value.toLowerCase().trim();
  const resultsDiv = document.getElementById('search-results');
  
  if (!query) {
    resultsDiv.innerHTML = '<p class="text-center text-gray-400">กรุณากรอกข้อมูลเพื่อค้นหา</p>';
    return;
  }

  const tickets = getTickets();
  const found = tickets.filter(t => 
    t.id.toLowerCase().includes(query) || 
    t.full_name.toLowerCase().includes(query)
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
        <p>📅 ${new Date(t.created_at).toLocaleString('th-TH')}</p>
        ${t.details ? `<p class="mt-2 p-2 bg-white rounded border border-gray-100 italic">"${t.details}"</p>` : ''}
      </div>
    </div>
  `).join('');
}

// Admin List Logic
function renderAdminList() {
  const listDiv = document.getElementById('tickets-list');
  let tickets = getTickets();

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
                <p class="text-xs text-gray-400">${new Date(t.created_at).toLocaleString('th-TH')}</p>
            </div>
        </div>
        
        <div class="flex items-center gap-3 w-full sm:w-auto mt-2 sm:mt-0">
            ${t.status === 'pending' ? `
                <button onclick="changeStatus('${t.id}', 'completed')" class="flex-1 sm:flex-none px-3 py-1.5 bg-emerald-500 text-white text-xs rounded-lg hover:bg-emerald-600 shadow-sm">✅ เสร็จสิ้น</button>
                <button onclick="changeStatus('${t.id}', 'cancelled')" class="flex-1 sm:flex-none px-3 py-1.5 bg-red-500 text-white text-xs rounded-lg hover:bg-red-600 shadow-sm">❌ ยกเลิก</button>
            ` : getStatusBadge(t.status)}
        </div>
    </div>
  `).join('');
}

function changeStatus(id, newStatus) {
    updateTicketStatus(id, newStatus);
    renderAdminList();
    updateStats();
    
    const Toast = Swal.mixin({
        toast: true, position: 'top-end', showConfirmButton: false, timer: 2000
    });
    Toast.fire({ icon: 'success', title: 'อัปเดตสถานะเรียบร้อย' });
}

function filterTickets(status) {
    currentFilter = status;
    renderAdminList();
}

// Utilities
function updateStats() {
  const tickets = getTickets();
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