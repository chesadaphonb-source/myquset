// ใส่ URL ที่ได้จากการ Deploy Google Apps Script ตรงนี้
const API_URL = 'https://script.google.com/macros/s/AKfycbz_P5SWoY2oXPheGM2AJA5XgipQZbr6Qq3LWUbBNEOL4v_-suRmjCk-Fg11nrmf9TXS/exec'; 

// ==========================================
// 1. DATA MANAGEMENT (API)
// ==========================================

// โหลดข้อมูลทั้งหมดจาก Google Sheets
async function fetchTickets() {
  try {
    const response = await fetch(API_URL);
    const data = await response.json();
    return Array.isArray(data) ? data : []; // ตรวจสอบว่าเป็น Array หรือไม่
  } catch (error) {
    console.error('Error fetching data:', error);
    Swal.fire('ข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อกับฐานข้อมูลได้', 'error');
    return [];
  }
}

// บันทึกข้อมูลใหม่
async function saveTicketToSheet(ticketData) {
  try {
    // ใช้ no-cors หรือ fetch แบบปกติ ขึ้นอยู่กับการตั้งค่า แต่ส่งเป็น Stringify ชัวร์สุด
    const response = await fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'create', ...ticketData }) // ส่งข้อมูลไปแบบ Text
    });
    // เนื่องจาก Google Script บางทีส่งค่ากลับมาแล้ว Browser บล็อก response (Opaque)
    // ให้สมมติว่าถ้าไม่ Error คือผ่าน (หรือรอผลถ้าตั้งค่า CORS สมบูรณ์)
    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error saving:', error);
    throw error;
  }
}

// อัปเดตสถานะ
async function updateStatusInSheet(id, newStatus) {
    await fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'update', id: id, status: newStatus })
    });
}


// ==========================================
// 2. UI LOGIC
// ==========================================
let currentView = 'user';

// เริ่มทำงานเมื่อเว็บโหลดเสร็จ
document.addEventListener('DOMContentLoaded', () => {
    // กด Enter เพื่อค้นหา
    const searchInput = document.getElementById('search-input');
    if(searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') searchTicket();
        });
    }
});

function switchView(view) {
    currentView = view;
    document.getElementById('user-view').classList.toggle('hidden', view !== 'user');
    document.getElementById('admin-view').classList.toggle('hidden', view !== 'admin');
    
    // ปรับสีปุ่ม
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
        
        // โหลดข้อมูล Admin ทันทีที่กดเข้ามา
        renderAdminList(); 
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

// --- ส่วนจัดการฟอร์ม ---
document.getElementById('report-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const submitBtn = document.getElementById('submit-btn');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '⏳ กำลังส่งข้อมูล...';
    submitBtn.disabled = true;

    const ticketId = 'TK' + Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
    
    const formData = {
        id: ticketId,
        full_name: document.getElementById('full-name').value,
        contact: document.getElementById('contact').value,
        location: document.getElementById('location').value,
        floor: document.getElementById('floor').value,
        room: document.getElementById('room').value,
        problem: document.getElementById('problem').value,
        details: document.getElementById('details').value
    };

    try {
        await saveTicketToSheet(formData);
        
        Swal.fire({
            icon: 'success',
            title: 'ส่งแจ้งปัญหาสำเร็จ!',
            html: `รหัสติดตามของคุณคือ: <br><b class="text-indigo-600 text-3xl">${ticketId}</b><br><span class="text-sm text-gray-500">แคปหน้าจอนี้ไว้ตรวจสอบสถานะ</span>`,
            confirmButtonText: 'ตกลง',
            confirmButtonColor: '#4f46e5'
        }).then(() => {
            this.reset();
        });
    } catch (err) {
        Swal.fire('Error', 'เกิดข้อผิดพลาดในการบันทึก กรุณาลองใหม่', 'error');
    } finally {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
});

// --- ส่วนค้นหาและติดตามสถานะ ---
async function searchTicket() {
    const query = document.getElementById('search-input').value.toLowerCase().trim();
    const resultsDiv = document.getElementById('search-results');
    
    resultsDiv.innerHTML = '<div class="text-center py-8"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div><p class="mt-2 text-gray-500">กำลังค้นหา...</p></div>';

    if (!query) {
        // ถ้าไม่พิมพ์อะไร ให้โหลด 5 รายการล่าสุดมาโชว์ (ตามที่ขอ)
        const allTickets = await fetchTickets();
        if(allTickets.length > 0) {
            renderSearchResults(allTickets.slice(0, 5), resultsDiv); // โชว์ 5 อันล่าสุด
        } else {
             resultsDiv.innerHTML = '<p class="text-center text-gray-400">ยังไม่มีข้อมูลในระบบ</p>';
        }
        return;
    }

    const tickets = await fetchTickets();
    const found = tickets.filter(t => 
        String(t.id).toLowerCase().includes(query) || 
        String(t.full_name).toLowerCase().includes(query)
    );

    renderSearchResults(found, resultsDiv);
}

function renderSearchResults(tickets, container) {
    if (tickets.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8">
                <p class="text-gray-500">❌ ไม่พบข้อมูล</p>
            </div>`;
        return;
    }

    container.innerHTML = tickets.map(t => `
        <div class="bg-gray-50 rounded-xl p-5 border border-gray-200 mb-3 hover:shadow-md transition-all">
            <div class="flex justify-between items-start mb-3">
                <div class="flex items-center gap-3">
                     <div class="w-12 h-12 bg-white rounded-full flex items-center justify-center text-2xl shadow-sm border border-gray-100">
                        ${getIcon(t.problem)}
                     </div>
                     <div>
                        <span class="inline-block px-2 py-1 rounded text-xs font-mono bg-indigo-100 text-indigo-700 font-bold mb-1">${t.id}</span>
                        <h4 class="font-bold text-gray-800">${t.problem}</h4>
                     </div>
                </div>
                ${getStatusBadge(t.status)}
            </div>
            <div class="text-sm text-gray-600 space-y-1 pl-16">
                <p>📍 ${t.location} ชั้น ${t.floor} ${t.room ? 'ห้อง '+t.room : ''}</p>
                <p>👤 ${t.full_name} <span class="text-gray-400">|</span> 📅 ${formatDate(t.date)}</p>
                ${t.details ? `<p class="mt-2 p-2 bg-white rounded border border-gray-100 italic">"${t.details}"</p>` : ''}
            </div>
        </div>
    `).join('');
}


// --- ส่วน Admin ---
async function renderAdminList() {
    const listDiv = document.getElementById('tickets-list');
    listDiv.innerHTML = '<div class="text-center py-12"><div class="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto"></div><p class="mt-4 text-gray-500">กำลังโหลดข้อมูล...</p></div>';

    const tickets = await fetchTickets();
    
    // อัปเดตตัวเลขสถิติ
    document.getElementById('stat-total').innerText = tickets.length;
    document.getElementById('stat-pending').innerText = tickets.filter(t => t.status === 'pending').length;
    document.getElementById('stat-completed').innerText = tickets.filter(t => t.status === 'completed').length;
    document.getElementById('stat-cancelled').innerText = tickets.filter(t => t.status === 'cancelled').length;

    if (tickets.length === 0) {
        listDiv.innerHTML = '<div class="p-8 text-center text-gray-400">ไม่มีรายการแจ้งปัญหา</div>';
        return;
    }

    listDiv.innerHTML = tickets.map(t => `
        <div class="p-4 hover:bg-gray-50 transition-colors flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center border-b border-gray-100 last:border-0">
            <div class="flex items-start gap-3">
                <div class="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-lg border border-indigo-100">
                    ${getIcon(t.problem)}
                </div>
                <div>
                    <div class="flex items-center gap-2">
                        <span class="font-bold text-gray-800">${t.problem}</span>
                        <span class="text-xs font-mono text-gray-400">#${t.id}</span>
                    </div>
                    <p class="text-sm text-gray-600">${t.location} ชั้น ${t.floor} • ${t.full_name}</p>
                    <p class="text-xs text-gray-400">${formatDate(t.date)}</p>
                </div>
            </div>
            
            <div class="flex items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                ${t.status === 'pending' ? `
                    <button onclick="changeStatus('${t.id}', 'completed')" class="px-3 py-1.5 bg-emerald-100 text-emerald-700 text-xs rounded-lg hover:bg-emerald-200 font-bold">✅ เสร็จสิ้น</button>
                    <button onclick="changeStatus('${t.id}', 'cancelled')" class="px-3 py-1.5 bg-red-100 text-red-700 text-xs rounded-lg hover:bg-red-200 font-bold">❌ ยกเลิก</button>
                ` : getStatusBadge(t.status)}
            </div>
        </div>
    `).join('');
}

async function changeStatus(id, newStatus) {
    Swal.fire({
        title: 'กำลังอัปเดต...',
        didOpen: () => Swal.showLoading()
    });
    
    await updateStatusInSheet(id, newStatus);
    
    Swal.close();
    renderAdminList(); // รีโหลดข้อมูล
}

// --- Utilities (เครื่องมือช่วย) ---

function getStatusBadge(status) {
  if (status === 'pending') return '<span class="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-bold border border-amber-200">⏳ รอดำเนินการ</span>';
  if (status === 'completed') return '<span class="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold border border-emerald-200">✅ เสร็จสิ้น</span>';
  return '<span class="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold border border-red-200">❌ ยกเลิก</span>';
}

function getIcon(problem) {
    // Mapping ชื่อปัญหาจาก Dropdown ให้ตรงกับ Emoji
    const icons = {
        'ไฟฟ้า': '💡',
        'ประปา': '🚿',
        'แอร์': '❄️',
        'อุปกรณ์ IT': '💻',
        'อาคารสถานที่': '🏢',
        'ความสะอาด': '🧹',
        'อื่นๆ': '📦'
    };
    // ถ้าหาไม่เจอ ให้ใช้รูปประแจ 🔧
    return icons[problem] || '🔧';
}

function formatDate(dateString) {
    if(!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('th-TH', { 
        day: '2-digit', month: 'short', hour: '2-digit', minute:'2-digit' 
    });
}
