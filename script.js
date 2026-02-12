// ⚠️ ใส่ URL ที่ได้จากการ Deploy Google Apps Script ตรงนี้ ⚠️
const API_URL = 'https://script.google.com/macros/s/AKfycbwhLHCcqsMc7ZcpDzr-xyUB1q9lwc1WmtixWqdwnWHHQY-uO50nWOuasrO8_6oOIQPD/exec'; 

// ตัวแปรเก็บข้อมูลทั้งหมด (เอาไว้ใช้กรองเดือน โดยไม่ต้องโหลดใหม่)
let allTicketsCache = [];

// ==========================================
// 1. DATA MANAGEMENT (API) - แก้ CORS ตรงนี้
// ==========================================

async function fetchTickets() {
  try {
    const response = await fetch(API_URL);
    const data = await response.json();
    return Array.isArray(data) ? data : []; 
  } catch (error) {
    console.error('Error fetching data:', error);
    return [];
  }
}

async function saveTicketToSheet(ticketData) {
    // ใช้ mode: 'no-cors' เพื่อยิงข้อมูลเข้า Google Sheet โดยไม่สน Response (แก้ตัวแดง)
    await fetch(API_URL, {
        method: 'POST',
        mode: 'no-cors', 
        headers: {
            "Content-Type": "text/plain", 
        },
        body: JSON.stringify({ action: 'create', ...ticketData })
    });
    return true; 
}

async function updateStatusInSheet(id, newStatus) {
    await fetch(API_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
            "Content-Type": "text/plain",
        },
        body: JSON.stringify({ action: 'update', id: id, status: newStatus })
    });
    return true;
}

// ==========================================
// 2. UI LOGIC (User & Admin)
// ==========================================
let currentView = 'user';

document.addEventListener('DOMContentLoaded', () => {
    // 1. ฟังก์ชันจำกัดเบอร์โทร
    const contactInput = document.getElementById('contact');
    if(contactInput) {
        contactInput.addEventListener('input', function() {
            this.value = this.value.replace(/[^0-9]/g, '').slice(0, 10);
        });
    }

    // 2. ฟังก์ชันค้นหาด้วย Enter
    const searchInput = document.getElementById('search-input');
    if(searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') searchTicket();
        });
    }

    // 🟢 3. ตั้งค่า Flatpickr (ส่วนที่เพิ่มเข้ามา)
    flatpickr("#input_date", {
        dateFormat: "Y-m-d",     // รูปแบบที่จะส่งไปเก็บ (เช่น 2026-02-12)
        altInput: true,          // เปิดโหมดแสดงผลแยก
        altFormat: "j F Y",      // รูปแบบที่ตามนุษย์เห็น (เช่น 12 กุมภาพันธ์ 2026)
        minDate: "today",        // ห้ามเลือกย้อนหลัง
        locale: "th",            // ภาษาไทย
        disableMobile: true      // บังคับใช้ UI ของ Flatpickr ตลอด (แก้บั๊กมือถือ)
    });
});
// 🔐 ตั้งรหัสผ่าน Admin ตรงนี้
const ADMIN_PASSWORD = "1234"; // <-- แก้รหัสผ่านที่ต้องการตรงนี้

function checkAdminPassword() {
    // ถ้าหน้าจอปัจจุบันเป็น Admin อยู่แล้ว ไม่ตองถามรหัสซ้ำ
    if (currentView === 'admin') return;

    Swal.fire({
        title: '🔐 ยืนยันตัวตน',
        text: 'กรุณากรอกรหัสผ่านสำหรับ Admin',
        input: 'password',
        inputAttributes: {
            autocapitalize: 'off',
            placeholder: 'รหัสผ่าน...'
        },
        showCancelButton: true,
        confirmButtonText: 'เข้าสู่ระบบ',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#10b981', // สีเขียวตามธีม
        showLoaderOnConfirm: true,
        preConfirm: (password) => {
            if (password !== ADMIN_PASSWORD) {
                Swal.showValidationMessage('❌ รหัสผ่านไม่ถูกต้อง')
            }
            return password === ADMIN_PASSWORD;
        },
        allowOutsideClick: () => !Swal.isLoading()
    }).then((result) => {
        if (result.isConfirmed) {
            // ถ้ารหัสถูก ให้พาไปหน้า Admin
            switchView('admin');
            
            const Toast = Swal.mixin({
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 3000,
                timerProgressBar: true
            });
            Toast.fire({
                icon: 'success',
                title: 'เข้าสู่ระบบเรียบร้อย'
            });
        }
    });
}

function switchView(view) {
    currentView = view;
    document.getElementById('user-view').classList.toggle('hidden', view !== 'user');
    document.getElementById('admin-view').classList.toggle('hidden', view !== 'admin');
    
    const btnUser = document.getElementById('btn-user');
    const btnAdmin = document.getElementById('btn-admin');
    
    if (view === 'user') {
        btnUser.classList.add('bg-emerald-600', 'text-white');
        btnUser.classList.remove('bg-white', 'text-gray-600');
        btnAdmin.classList.add('bg-white', 'text-gray-600');
        btnAdmin.classList.remove('bg-emerald-600', 'text-white');
    } else {
        btnAdmin.classList.add('bg-emerald-600', 'text-white');
        btnAdmin.classList.remove('bg-white', 'text-gray-600');
        btnUser.classList.add('bg-white', 'text-gray-600');
        btnUser.classList.remove('bg-emerald-600', 'text-white');
        
        // ✅ เปลี่ยนมาเรียกฟังก์ชันใหม่ (ที่มีระบบกรองเดือน)
        renderAdminView(); 
    }
}

function switchUserTab(tab) {
    // ซ่อนทุกหน้าก่อน
    document.getElementById('form-section').classList.add('hidden');
    document.getElementById('track-section').classList.add('hidden');
    document.getElementById('calendar-section').classList.add('hidden');

    // รีเซ็ตปุ่มทั้งหมดเป็นสีเทา
    const tabs = ['form', 'track', 'calendar'];
    tabs.forEach(t => {
        const btn = document.getElementById('tab-' + t);
        if(btn) {
            btn.classList.remove('bg-white', 'text-emerald-600', 'ring-2');
            btn.classList.add('bg-gray-100', 'text-gray-500');
        }
    });

    // เปิดหน้าที่เลือก และทำปุ่มให้เด่น
    const activeSection = document.getElementById(tab + '-section');
    const activeBtn = document.getElementById('tab-' + tab);
    
    if (activeSection) activeSection.classList.remove('hidden');
    if (activeBtn) {
        activeBtn.classList.remove('bg-gray-100', 'text-gray-500');
        activeBtn.classList.add('bg-white', 'text-emerald-600', 'ring-2');
    }

    // ถ้ากดมาหน้าปฏิทิน ให้โหลดข้อมูลทันที
    if (tab === 'calendar') {
        renderPublicCalendar();
    }
}

// --- ส่วนจัดการฟอร์ม ---
document.getElementById('report-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    Swal.fire({
        title: 'กำลังส่งข้อมูล...',
        text: 'กรุณารอสักครู่ ระบบกำลังบันทึกข้อมูล',
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); }
    });

    const ticketId = 'TK' + Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
    
const formData = {
        id: ticketId,
        full_name: document.getElementById('full-name').value,
        contact: document.getElementById('contact').value,
        location: document.getElementById('location').value,
        floor: document.getElementById('floor').value,
        room: document.getElementById('room').value,
        problem: document.getElementById('problem').value,
        details: document.getElementById('details').value,
        
        // ส่วนที่เพิ่มเข้ามา: รวมวัน+เวลา เป็นก้อนเดียว
        appointment_date: (function() {
            const date = document.getElementById('input_date').value;
            const time = document.getElementById('input_time').value;
            if (date && time) {
                return `${date} ${time}`; 
            }
            return ''; 
        })()
    };

    try {
        await saveTicketToSheet(formData);
        
        Swal.fire({
            icon: 'success',
            title: 'ส่งแจ้งปัญหาสำเร็จ!',
            html: `รหัสติดตามของคุณคือ: <br><b class="text-emerald-600 text-3xl">${ticketId}</b><br><span class="text-sm text-gray-500">แคปหน้าจอนี้ไว้ตรวจสอบสถานะ</span>`,
            confirmButtonText: 'ตกลง',
            confirmButtonColor: '#4f46e5'
        }).then(() => {
            this.reset();
        });
    } catch (err) {
        console.error(err);
        Swal.fire({
            icon: 'error', 
            title: 'เกิดข้อผิดพลาด', 
            text: 'ไม่สามารถส่งข้อมูลได้ กรุณาลองใหม่อีกครั้ง'
        });
    }
});

// --- ส่วนค้นหา ---
async function searchTicket() {
    const query = document.getElementById('search-input').value.toLowerCase().trim();
    const resultsDiv = document.getElementById('search-results');
    
    resultsDiv.innerHTML = '<div class="text-center py-8"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mx-auto"></div><p class="mt-2 text-gray-500">กำลังค้นหา...</p></div>';

    const allTickets = await fetchTickets();

    if (!query) {
        if(allTickets.length > 0) {
            renderSearchResults(allTickets.slice(0, 5), resultsDiv);
        } else {
             resultsDiv.innerHTML = '<p class="text-center text-gray-400 py-8">ยังไม่มีข้อมูลในระบบ</p>';
        }
        return;
    }

    const found = allTickets.filter(t => 
        String(t.id).toLowerCase().includes(query) || 
        String(t.full_name).toLowerCase().includes(query)
    );

    renderSearchResults(found, resultsDiv);
}

function renderSearchResults(tickets, container) {
    if (tickets.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8">
                <p class="text-gray-500">❌ ไม่พบข้อมูลที่ค้นหา</p>
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
                         <span class="inline-block px-2 py-1 rounded text-xs font-mono bg-emerald-100 text-emerald-700 font-bold mb-1">${t.id}</span>
                         <h4 class="font-bold text-gray-800">${t.problem}</h4>
                      </div>
                </div>
                ${getStatusBadge(t.status)}
            </div>
            <div class="text-sm text-gray-600 space-y-1 pl-16">
              <p>📍 ${t.location} ชั้น ${t.floor} ${t.room ? 'ห้อง '+t.room : ''}</p>
              <p>👤 ${t.full_name} <span class="text-gray-400">|</span> 📅 แจ้งเมื่อ: ${formatDate(t.date)}</p>
    
          ${t.appointment_date ? `
          <div class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 text-xs font-bold my-1">
             📅 นัดซ่อม: ${formatDate(t.appointment_date)}
          </div>
          ` : ''}
    ${t.details ? `<p class="mt-2 p-2 bg-white rounded border border-gray-100 italic">"${t.details}"</p>` : ''}
</div>
        </div>
    `).join('');
}


// ==========================================
// 3. ADMIN & FILTER LOGIC (อัปเกรดใหม่ 2 ตัวกรอง)
// ==========================================

async function renderAdminView() {
    document.getElementById('tickets-list').innerHTML = '<div class="text-center py-12"><div class="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600 mx-auto"></div><p class="mt-4 text-gray-500">กำลังโหลดข้อมูล...</p></div>';

    allTicketsCache = await fetchTickets();
    
    setupMonthFilter(allTicketsCache);
    setupTypeFilter(allTicketsCache); // ✅ เพิ่มฟังก์ชันสร้าง Dropdown ประเภท
    
    applyFilters(); // ✅ เปลี่ยนชื่อเป็นฟังก์ชันรวม
}

// สร้าง Dropdown เดือน
function setupMonthFilter(data) {
    const filterSelect = document.getElementById('monthFilter');
    if (!filterSelect) return;
    filterSelect.innerHTML = '<option value="all">📅 ทั้งหมด</option>';
    if (data.length === 0) return;

    const months = new Set();
    data.forEach(ticket => {
        if(ticket.date) months.add(ticket.date.substring(0, 7));
    });

    const sortedMonths = Array.from(months).sort().reverse();
    const thaiMonthNames = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];

    sortedMonths.forEach(ym => {
        const [year, month] = ym.split('-');
        if(year && month) {
            const thaiYear = parseInt(year) + 543;
            const monthName = thaiMonthNames[parseInt(month) - 1];
            const option = document.createElement('option');
            option.value = ym;
            option.text = `${monthName} ${thaiYear}`;
            filterSelect.appendChild(option);
        }
    });
}

// ✅ สร้าง Dropdown ประเภทงาน (ดึงจากข้อมูลจริง)
function setupTypeFilter(data) {
    const typeSelect = document.getElementById('typeFilter');
    if (!typeSelect) return;
    typeSelect.innerHTML = '<option value="all">🔧 ทุกประเภท</option>';
    
    if (data.length === 0) return;

    // ดึงประเภทงานทั้งหมดออกมา แล้วลบตัวซ้ำ
    const types = new Set();
    data.forEach(ticket => {
        if(ticket.problem) types.add(ticket.problem);
    });

    // เรียงตามตัวอักษร
    const sortedTypes = Array.from(types).sort();

    sortedTypes.forEach(type => {
        const option = document.createElement('option');
        option.value = type;
        option.text = `${getIcon(type)} ${type}`; // ใส่ไอคอนหน้าชื่อด้วย
        typeSelect.appendChild(option);
    });
}

// ✅ ฟังก์ชันกรองข้อมูลรวม (พระเอกของเรา)
function applyFilters() {
    const monthVal = document.getElementById('monthFilter') ? document.getElementById('monthFilter').value : 'all';
    const typeVal = document.getElementById('typeFilter') ? document.getElementById('typeFilter').value : 'all';

    let filteredData = allTicketsCache;

    // 1. กรองเดือน
    if (monthVal !== 'all') {
        filteredData = filteredData.filter(t => t.date && t.date.startsWith(monthVal));
    }

    // 2. กรองประเภทงาน
    if (typeVal !== 'all') {
        filteredData = filteredData.filter(t => t.problem === typeVal);
    }

    updateDashboardStats(filteredData);
    renderTicketList(filteredData);
}

function updateDashboardStats(data) {
    document.getElementById('stat-total').innerText = data.length;
    document.getElementById('stat-pending').innerText = data.filter(t => t.status === 'pending').length;
    document.getElementById('stat-completed').innerText = data.filter(t => t.status === 'completed').length;
    document.getElementById('stat-cancelled').innerText = data.filter(t => t.status === 'cancelled').length;
}

function renderTicketList(tickets) {
    const listDiv = document.getElementById('tickets-list');
    if (tickets.length === 0) {
        listDiv.innerHTML = '<div class="p-8 text-center text-gray-400">ไม่มีรายการในช่วงเวลานี้</div>';
        return;
    }
    listDiv.innerHTML = tickets.map(t => `
        <div class="p-4 hover:bg-gray-50 transition-colors flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center border-b border-gray-100 last:border-0">
            <div class="flex items-start gap-3">
                <div class="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-lg border border-emerald-100">${getIcon(t.problem)}</div>
                <div>
                    <div class="flex items-center gap-2">
                        <span class="font-bold text-gray-800">${t.problem}</span>
                        <span class="text-xs font-mono text-gray-400">#${t.id}</span>
                    </div>
                    
                    ${t.appointment_date ? `
                        <div class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 text-xs font-bold my-1">
                            📅 นัดหมาย: ${formatDate(t.appointment_date)}
                        </div>
                    ` : ''}
                    
                    <p class="text-sm text-gray-600">${t.location} ชั้น ${t.floor} • ${t.full_name}</p>
                    <p class="text-xs text-gray-400">แจ้งเมื่อ: ${formatDate(t.date)}</p>
                </div>
            </div>
            <div class="flex flex-col sm:flex-row gap-2 w-full sm:w-auto mt-2 sm:mt-0 items-end">
                <div class="mb-2 sm:mb-0">${getStatusBadge(t.status)}</div>
                <div class="flex gap-1">
                    ${t.status === 'pending' ? `
                        <button onclick="changeStatus('${t.id}', 'in_progress')" class="px-3 py-1.5 bg-blue-500 text-white text-xs rounded shadow hover:bg-blue-600">🛠️ รับเรื่อง</button>
                        <button onclick="changeStatus('${t.id}', 'cancelled')" class="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs rounded shadow hover:bg-gray-200">❌ ยกเลิก</button>
                    ` : ''}
                    ${t.status === 'in_progress' ? `
                        <button onclick="changeStatus('${t.id}', 'completed')" class="px-3 py-1.5 bg-emerald-500 text-white text-xs rounded shadow hover:bg-emerald-600">✅ เสร็จสิ้น</button>
                    ` : ''}
                </div>
            </div>
        </div>
    `).join('');
}

async function changeStatus(id, newStatus) {
    Swal.fire({ title: 'กำลังอัปเดต...', didOpen: () => Swal.showLoading() });
    try {
        await updateStatusInSheet(id, newStatus);
        setTimeout(async () => {
            Swal.close();
            allTicketsCache = await fetchTickets();
            applyFilters(); // เรียก applyFilters แทน เพื่อคงค่าตัวเลือกเดิมไว้
            Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 }).fire({ icon: 'success', title: 'เรียบร้อย' });
        }, 1500); 
    } catch (error) { Swal.close(); renderAdminView(); }
}

function getStatusBadge(status) {
  if (status === 'pending') return '<span class="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-bold border border-amber-200">⏳ รอดำเนินการ</span>';
  if (status === 'in_progress') return '<span class="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold border border-blue-200">🛠️ กำลังดำเนินการ</span>';
  if (status === 'completed') return '<span class="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold border border-emerald-200">✅ เสร็จสิ้น</span>';
  return '<span class="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold border border-red-200">❌ ยกเลิก</span>';
}

function getIcon(problem) {
    const icons = {
        'Hardware': '🖥️',   // ฮาร์ดแวร์
        'Software': '💿',   // ซอฟต์แวร์
        'Network': '🌐',    // อินเทอร์เน็ต/Network
        'Printer': '🖨️',    // ปริ้นเตอร์
        'Account': '🔑',    // ลืมรหัส/Account
        'Peripheral': '🖱️', // เมาส์/คีย์บอร์ด
        'Other': '📦'       // อื่นๆ
    };
    // ถ้าหาไม่เจอ ให้คืนค่าเป็นรูปโน้ตบุ๊ค (💻) แทนประแจ
    return icons[problem] || '💻';
}

function formatDate(dateString) {
    if(!dateString) return '-';
    // เพิ่ม year: 'numeric' เพื่อให้โชว์ปีด้วย
    return new Date(dateString).toLocaleString('th-TH', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric', 
        hour: '2-digit', 
        minute:'2-digit' 
    }) + ' น.';  
}

async function renderPublicCalendar() {
    const container = document.getElementById('calendar-grid');
    container.innerHTML = '<div class="col-span-full text-center py-12"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mx-auto"></div><p class="mt-2 text-gray-500">กำลังดึงตารางงาน...</p></div>';

    // ดึงข้อมูลใหม่ (หรือใช้ cache ถ้ามี)
    let tickets = allTicketsCache.length > 0 ? allTicketsCache : await fetchTickets();
    
    // กรองเฉพาะงานที่ยังไม่เสร็จ และ มีวันที่นัดหมาย หรือ วันที่แจ้ง
    const upcoming = tickets.filter(t => 
        t.status !== 'cancelled' && t.status !== 'completed'
    ).sort((a, b) => {
        // เรียงตามวันที่นัดหมาย (ถ้าไม่มีใช้วันแจ้ง)
        const dateA = new Date(a.appointment_date || a.date);
        const dateB = new Date(b.appointment_date || b.date);
        return dateA - dateB;
    });

    if (upcoming.length === 0) {
        container.innerHTML = '<div class="col-span-full text-center py-10 bg-gray-50 rounded-xl border border-dashed border-gray-300 text-gray-400">📅 ไม่มีคิวงานเร็วๆ นี้</div>';
        return;
    }

    // สร้างการ์ดแสดงรายการ
    container.innerHTML = upcoming.map(t => {
        // เช็คว่าเป็นงานนัดหมาย หรือ งานแจ้งปกติ
        const isAppointment = !!t.appointment_date;
        const showDate = t.appointment_date || t.date;
        const dateObj = new Date(showDate);
        
        // จัดรูปแบบวัน
        const day = dateObj.getDate();
        const month = dateObj.toLocaleString('th-TH', { month: 'short' });
        const time = dateObj.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

        return `
        <div class="relative bg-white p-4 rounded-xl border ${isAppointment ? 'border-emerald-200 bg-emerald-50/30' : 'border-blue-100 bg-blue-50/30'} shadow-sm hover:shadow-md transition-all">
            <div class="flex items-start gap-3">
                <div class="flex flex-col items-center justify-center bg-white border border-gray-200 rounded-lg p-2 min-w-[60px]">
                    <span class="text-xs text-gray-500">${month}</span>
                    <span class="text-2xl font-bold ${isAppointment ? 'text-emerald-600' : 'text-blue-600'}">${day}</span>
                    <span class="text-xs font-bold text-gray-400">${time}</span>
                </div>
                <div>
                    <div class="flex items-center gap-2 mb-1">
                        <span class="text-xl">${getIcon(t.problem)}</span>
                        <span class="font-bold text-gray-800 line-clamp-1">${t.problem}</span>
                    </div>
                    <p class="text-sm text-gray-600 line-clamp-1">📍 ${t.location} ชั้น ${t.floor}</p>
                    <p class="text-xs text-gray-400 mt-1">แจ้งโดย: ${t.full_name}</p>
                    ${isAppointment 
                        ? '<span class="absolute top-2 right-2 w-2 h-2 rounded-full bg-emerald-500"></span>' 
                        : '<span class="absolute top-2 right-2 w-2 h-2 rounded-full bg-blue-400"></span>'
                    }
                </div>
            </div>
        </div>
        `;
    }).join('');
}



