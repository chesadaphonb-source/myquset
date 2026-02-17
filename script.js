// ⚠️ ใส่ URL ที่ได้จากการ Deploy Google Apps Script ตรงนี้ ⚠️
const API_URL = 'https://script.google.com/macros/s/AKfycbxdfmSJqA765cZz4VWfBXQZuRc7md6BgGxLltas7nIIpGPpLh-CCNa-QvIHnHzBjIww/exec'; 

// --- ข้อมูลชั้นของแต่ละอาคาร ---
const buildingData = {
    "อาคาร 1": [
        "ชั้น 1",
        "ชั้นลอย",
        "ชั้น 2 (ห้องเรียน/ห้องประชุม)",
        "ชั้น 3 (ภาควิทย์)",
        "ชั้น 4 (ภาคเทคโน)",
        "ชั้น 5 (ภาคเทคโน)",
        "ชั้น 6 (ภาควิทย์)",
        "ชั้น 7"
    ],
    "อาคาร 2": [
        "ชั้น 1",
        "ชั้น 2",
        "ชั้น 3",
        "ชั้น 4"
    ]
};

// ฟังก์ชันอัปเดตตัวเลือกชั้น (เรียกใช้เมื่อเลือกอาคาร)
function updateFloors() {
    const buildingSelect = document.getElementById("location");
    const floorSelect = document.getElementById("floor");
    const selectedBuilding = buildingSelect.value;

    // เคลียร์ตัวเลือกเก่า
    floorSelect.innerHTML = '<option value="" disabled selected>-- กรุณาเลือกชั้น --</option>';

    if (selectedBuilding && buildingData[selectedBuilding]) {
        // เปิดให้เลือกชั้นได้
        floorSelect.disabled = false;
        floorSelect.classList.remove("bg-gray-50", "cursor-not-allowed");

        // วนลูปสร้างตัวเลือกชั้นตามข้อมูลที่เตรียมไว้
        buildingData[selectedBuilding].forEach(floorName => {
            const option = document.createElement("option");
            option.value = floorName; // ค่าที่จะส่งไป Google Sheet
            option.textContent = floorName; // ข้อความที่แสดงในเว็บ
            floorSelect.appendChild(option);
        });
    } else {
        // ถ้าไม่ได้เลือกอาคาร ให้ปิดช่องเลือกชั้น
        floorSelect.disabled = true;
        floorSelect.classList.add("bg-gray-50", "cursor-not-allowed");
        floorSelect.innerHTML = '<option value="" disabled selected>-- กรุณาเลือกอาคารก่อน --</option>';
    }
}

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

    // 🟢 3. ตั้งค่า Flatpickr (วันที่)
    flatpickr("#input_date", {
        dateFormat: "Y-m-d",     
        altInput: true,          
        altFormat: "j F Y",      
        minDate: "today",        
        locale: "th",            
        disableMobile: true      
    });

    // 🟢 4. ตั้งค่า Flatpickr (เวลา) - จุดที่เคยผิด แก้ให้แล้วครับ ✅
    flatpickr("#input_time", {
      enableTime: true,       
      noCalendar: true,       
      dateFormat: "H:i",      
      time_24hr: true,        
      altInput: true,         
      altFormat: "H:i น.",    
      disableMobile: true     
    }); // <--- ของเดิมน่าจะขาดวงเล็บปิดตรงนี้

    // 🟢 5. เช็คว่าเคย Login ค้างไว้ไหม
    const isLoggedIn = localStorage.getItem('isAdminLoggedIn');
    if (isLoggedIn === 'true') {
        switchView('admin');
    }
});

// 🔐 ตั้งรหัสผ่าน Admin ตรงนี้ (ค่าปัจจุบัน: 1234)
const ENCRYPTED_PASS = "MTIzNA=="; 

function checkAdminPassword() {
    // ถ้าหน้าจอปัจจุบันเป็น Admin อยู่แล้ว ไม่ต้องถามรหัสซ้ำ
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
            // 🔥 จุดสำคัญ: แปลงรหัสที่พิมพ์มาเป็น Base64 ก่อนเทียบ
            const inputEncrypted = btoa(password); 

            if (inputEncrypted !== ENCRYPTED_PASS) {
                Swal.showValidationMessage('❌ รหัสผ่านไม่ถูกต้อง')
            }
            return inputEncrypted === ENCRYPTED_PASS;
        },
        allowOutsideClick: () => !Swal.isLoading()
    }).then((result) => {
        if (result.isConfirmed) {
            localStorage.setItem('isAdminLoggedIn', 'true');
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
    
    // ฟังก์ชันสำหรับเริ่มสร้างปฏิทิน (แยกออกมาเพื่อให้เรียกใช้ได้ทั้งใน if และ else)
    const startCalendar = (data) => {
        setTimeout(() => {
            // 🔥 ป้องกันปฏิทินซ้อนกัน: ถ้ามีปฏิทินเก่าอยู่ ให้ทำลายทิ้งก่อน
            if (typeof calendar !== 'undefined' && calendar) {
                calendar.destroy();
            }
            
            // สร้างใหม่ด้วยข้อมูลล่าสุด
            initCalendar(data); 
        }, 100);
    };

    // เช็คข้อมูลและเรียกใช้ฟังก์ชันด้านบน
    if (allTicketsCache.length > 0) {
        startCalendar(allTicketsCache);
    } else {
        fetchTickets().then(data => {
            allTicketsCache = data;
            startCalendar(allTicketsCache);
        });
    }
  }
}

// --- ส่วนจัดการฟอร์ม ---
document.getElementById('report-form').addEventListener('submit', async function(e) {
    e.preventDefault();

    // เช็คค่า Input ก่อนส่ง (เพื่อความชัวร์)
    const nameInput = document.getElementById('full-name');
    const contactInput = document.getElementById('contact');
    const locationInput = document.getElementById('location');
    const floorInput = document.getElementById('floor'); // ใน HTML ต้องมี id="floor"
    const problemInput = document.getElementById('problem');
    const detailsInput = document.getElementById('details');
    
    // วันที่และเวลา
    const dateInput = document.getElementById('input_date');
    const timeInput = document.getElementById('input_time');

    // ถ้าหา input ตัวไหนไม่เจอ ให้หยุดทำงานและแจ้งเตือน (ป้องกัน Error จอขาว)
    if (!nameInput || !problemInput) {
        console.error("หา Input ไม่เจอ! กรุณาเช็ค id ในไฟล์ HTML");
        return; 
    }

    Swal.fire({
        title: 'กำลังส่งข้อมูล...',
        text: 'กรุณารอสักครู่ ระบบกำลังบันทึกข้อมูล',
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); }
    });

    const ticketId = 'TK' + Math.floor(Math.random() * 1000000).toString().padStart(6, '0');

    const formData = {
        id: ticketId,
        full_name: nameInput.value,
        contact: contactInput ? contactInput.value : '-',
        location: locationInput ? locationInput.value : '-',
        floor: floorInput ? floorInput.value : '-',
        // ❌ ลบบรรทัด room ทิ้งไปแล้ว เพราะใน HTML ไม่มี
        problem: problemInput.value,
        details: detailsInput ? detailsInput.value : '-',

        // รวมวัน+เวลา
        appointment_date: (function() {
            if (dateInput && timeInput && dateInput.value && timeInput.value) {
                return `${dateInput.value} ${timeInput.value}`; 
            }
            return ''; 
        })()
    };

    try {
        // ส่งข้อมูล (สมมติว่าฟังก์ชัน saveTicketToSheet คุณเขียนไว้ถูกต้องแล้ว)
        await saveTicketToSheet(formData);

        Swal.fire({
            icon: 'success',
            title: 'ส่งแจ้งปัญหาสำเร็จ!',
            html: `รหัสติดตามของคุณคือ: <br><b class="text-emerald-600 text-3xl">${ticketId}</b><br><span class="text-sm text-gray-500">แคปหน้าจอนี้ไว้ตรวจสอบสถานะ</span>`,
            confirmButtonText: 'ตกลง',
            confirmButtonColor: '#4f46e5'
        }).then(() => {
            // รีเซ็ตฟอร์ม
            document.getElementById('report-form').reset();
            if (typeof clearAppointment === 'function') {
                clearAppointment(); 
            }
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
        <div class="bg-white rounded-xl p-4 border border-gray-200 mb-4 shadow-sm relative overflow-hidden">
            
            <div class="flex justify-between items-center mb-3 pb-2 border-b border-gray-50">
                <span class="font-mono text-xs font-bold text-gray-400 tracking-wider">#${t.id}</span>
                ${getStatusBadge(t.status)}
            </div>

            <div class="flex gap-3">
                <div class="flex-shrink-0 w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center text-xl border border-gray-100 shadow-sm">
                    ${getIcon(t.problem)}
                </div>

                <div class="flex-1 min-w-0">
                    <h4 class="font-bold text-gray-800 text-base mb-1">${t.problem}</h4>
                    
                    <div class="text-sm text-gray-600 space-y-1">
                        <p class="flex items-start gap-1.5">
                            <span class="text-gray-400 mt-0.5 text-xs">📍</span> 
                            <span class="leading-snug">${t.location} <span class="text-gray-300">|</span> ชั้น ${t.floor}</span>
                        </p>
                        <p class="flex items-start gap-1.5">
                            <span class="text-gray-400 mt-0.5 text-xs">👤</span> 
                            <span class="leading-snug">${t.full_name}</span>
                        </p>
                    </div>
                </div>
            </div>

            <div class="mt-3 pl-14"> <p class="text-xs text-gray-400 mb-2">แจ้งเมื่อ: ${formatDate(t.date)}</p>
                 
                 ${t.details ? `
                 <div class="text-xs text-gray-500 bg-gray-50 p-2 rounded border border-gray-100 italic mb-2">
                    "${t.details}"
                 </div>` : ''}

                 ${t.appointment_date ? `
                 <div class="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-3 py-2 rounded-lg text-sm font-semibold border border-emerald-100 shadow-sm">
                    📅 นัดซ่อม: ${formatDate(t.appointment_date)}
                 </div>
                 ` : ''}
            </div>

        </div>
    `).join('');
}


// ==========================================
// 3. ADMIN & FILTER LOGIC (อัปเกรดใหม่)
// ==========================================

async function renderAdminView() {
    document.getElementById('tickets-list').innerHTML = '<div class="text-center py-12"><div class="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600 mx-auto"></div><p class="mt-4 text-gray-500">กำลังโหลดข้อมูล...</p></div>';

    allTicketsCache = await fetchTickets();

    setupMonthFilter(allTicketsCache);
    setupTypeFilter(allTicketsCache);

    applyFilters();
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

// ✅ ฟังก์ชันกรองข้อมูลรวม
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
            <div class="flex items-start gap-3 w-full sm:w-2/3"> <div class="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-lg border border-emerald-100 flex-shrink-0">${getIcon(t.problem)}</div>
                <div class="flex-1">
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

                    ${t.details ? `
                        <div class="mt-2 text-sm text-gray-600 bg-gray-100 p-2 rounded border border-gray-200 italic">
                            "${t.details}"
                        </div>
                    ` : ''}
                    <p class="text-xs text-gray-400 mt-1">แจ้งเมื่อ: ${formatDate(t.date)}</p>
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
            applyFilters(); 
            Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 }).fire({ icon: 'success', title: 'เรียบร้อย' });
        }, 1500); 
    } catch (error) { Swal.close(); renderAdminView(); }
}

function getStatusBadge(status) {
    if (status === 'pending') return '<span class="px-2 py-1 bg-amber-100 text-amber-700 rounded-lg text-xs font-bold border border-amber-200 whitespace-nowrap">⏳ รอดำเนินการ</span>';
    if (status === 'in_progress') return '<span class="px-2 py-1 bg-blue-100 text-blue-700 rounded-lg text-xs font-bold border border-blue-200 whitespace-nowrap">🛠️ กำลังดำเนินการ</span>';
    if (status === 'completed') return '<span class="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold border border-emerald-200 whitespace-nowrap">✅ เสร็จสิ้น</span>';
    return '<span class="px-2 py-1 bg-red-100 text-red-700 rounded-lg text-xs font-bold border border-red-200 whitespace-nowrap">❌ ยกเลิก</span>';
}

function getIcon(problem) {
    const icons = {
        'Hardware': '🖥️',   
        'Software': '💿',   
        'Network': '🌐',    
        'Printer': '🖨️',    
        'Account': '🔑',    
        'Peripheral': '🖱️', 
        'Other': '📦'       
    };
    return icons[problem] || '💻';
}

function formatDate(dateString) {
    if(!dateString) return '-';
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

    let tickets = allTicketsCache.length > 0 ? allTicketsCache : await fetchTickets();

    const upcoming = tickets.filter(t => 
        t.status !== 'cancelled' && t.status !== 'completed'
    ).sort((a, b) => {
        const dateA = new Date(a.appointment_date || a.date);
        const dateB = new Date(b.appointment_date || b.date);
        return dateA - dateB;
    });

    if (upcoming.length === 0) {
        container.innerHTML = '<div class="col-span-full text-center py-10 bg-gray-50 rounded-xl border border-dashed border-gray-300 text-gray-400">📅 ไม่มีคิวงานเร็วๆ นี้</div>';
        return;
    }

    container.innerHTML = upcoming.map(t => {
        const isAppointment = !!t.appointment_date;
        const showDate = t.appointment_date || t.date;
        const dateObj = new Date(showDate.replace(" ", "T"));

        const day = dateObj.getDate();
        const month = dateObj.toLocaleString('th-TH', { month: 'short' });
        const time = dateObj.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
        const timeLabel = isAppointment ? "เวลานัด" : "เวลาแจ้ง";
        const timeLabelColor = isAppointment ? "text-emerald-600" : "text-gray-400";

        return `
        <div class="relative bg-white p-4 rounded-xl border ${isAppointment ? 'border-emerald-200 bg-emerald-50/30' : 'border-blue-100 bg-blue-50/30'} shadow-sm hover:shadow-md transition-all">
            <div class="flex items-start gap-3">
                
                <div class="flex flex-col items-center justify-center bg-white border border-gray-200 rounded-lg p-1 min-w-[70px] h-[85px]">
                    <span class="text-xs text-gray-500 -mb-1">${month}</span>
                    <span class="text-2xl font-bold ${isAppointment ? 'text-emerald-600' : 'text-blue-600'}">${day}</span>
                    
                    <div class="flex flex-col items-center mt-1 w-full border-t border-gray-100 pt-1">
                        <span class="text-[9px] ${timeLabelColor} leading-none mb-0.5">${timeLabel}</span>
                        <span class="text-xs font-bold text-gray-700 leading-none">${time} น.</span>
                    </div>
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

function clearAppointment() {
    const dateInput = document.getElementById('input_date');
    const timeInput = document.getElementById('input_time');

    if (dateInput && dateInput._flatpickr) {
        dateInput._flatpickr.clear();
    }
    if (timeInput && timeInput._flatpickr) {
        timeInput._flatpickr.clear();
    }

    const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 2000,
        timerProgressBar: true
    });
     
    Toast.fire({
        icon: 'info',
        title: 'ล้างค่าวันนัดหมายแล้ว'
    });
}

function adminLogout() {
    Swal.fire({
        title: 'ออกจากระบบ?',
        text: "คุณต้องการออกจากโหมด Admin ใช่หรือไม่",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'ใช่, ออกเลย',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#d33'
    }).then((result) => {
        if (result.isConfirmed) {
            // ✅ ลบความจำ Browser
            localStorage.removeItem('isAdminLoggedIn');
            
            // รีโหลดหน้าเว็บใหม่
            location.reload();
        }
    });
}

// ==========================================
// 📅 ส่วนจัดการปฏิทิน (FullCalendar) - แก้ไข Syntax Error
// ==========================================
let calendar; 

function initCalendar(tickets) {
    const calendarEl = document.getElementById('calendar');
    
    // 1. แปลงข้อมูล Ticket
    const events = tickets.map(ticket => {
        let dateStr = ticket.appointment_date;
        if (!dateStr || dateStr.length < 10) return null; 

        let color = '#10b981'; // สีเขียว
        if (ticket.status === 'pending') color = '#f59e0b'; // สีส้ม
        
        return {
            title: `${ticket.room} - ${ticket.problem}`, 
            start: dateStr, 
            backgroundColor: color,
            borderColor: color,
            textColor: '#fff',
            extendedProps: { ...ticket } 
        };
    }).filter(e => e !== null);

    // 2. สร้างปฏิทิน
    // ⚠️ ตรวจสอบว่าในไฟล์ index.html ของคุณมีการใส่ Script ของ FullCalendar หรือยัง
    if (typeof FullCalendar === 'undefined') {
        console.error('❌ ยังไม่ได้ติดตั้ง FullCalendar Library');
        Swal.fire('Error', 'ไม่พบไลบรารี FullCalendar กรุณาติดตั้งก่อน', 'error');
        return;
    }

    calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        locale: 'th',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,listMonth'
        },
        buttonText: {
            today: 'วันนี้',
            month: 'เดือน',
            list: 'รายการ'
        },
        events: events,
        
        // ⭐ ส่วนแสดง Pop-up (แยกตัวแปรออกมาเพื่อป้องกัน Error)
        eventClick: function(info) {
            var props = info.event.extendedProps;
            
            // จัดรูปแบบวันที่
            var dateObj = new Date(info.event.start);
            var dateStr = dateObj.toLocaleDateString('th-TH', { 
                day: 'numeric', month: 'long', year: 'numeric', 
                hour: '2-digit', minute:'2-digit' 
            });

            // ไอคอน
            let iconStr = '💻';
            if(props.problem === 'Printer') iconStr = '🖨️';
            if(props.problem === 'Network') iconStr = '🌐';
            
            // สร้าง HTML ใส่ตัวแปรก่อน (แก้ปัญหาสัญลักษณ์กวนกัน)
            let htmlContent = `
                <div class="text-left space-y-3 p-1">
                    <div class="bg-emerald-50 p-3 rounded-lg border border-emerald-100 mb-3">
                        <p class="text-xs text-gray-500">ปัญหาที่แจ้ง</p>
                        <div class="flex items-center gap-2">
                            <span class="text-2xl">${iconStr}</span>
                            <span class="font-bold text-lg text-emerald-800">${props.problem}</span>
                        </div>
                        <p class="text-emerald-600 text-sm font-medium mt-1">📅 นัดหมาย: ${dateStr} น.</p>
                    </div>

                    <div class="grid grid-cols-2 gap-3 text-sm">
                        <div>
                            <p class="text-xs text-gray-400">👤 ผู้แจ้ง</p>
                            <p class="font-semibold text-gray-700 truncate">${props.full_name}</p>
                            <p class="text-xs text-gray-500">📞 ${props.contact}</p>
                        </div>
                        <div>
                            <p class="text-xs text-gray-400">🏢 สถานที่</p>
                            <p class="font-semibold text-gray-700">${props.location}</p>
                            <p class="text-xs text-gray-500">ชั้น ${props.floor} ห้อง ${props.room}</p>
                        </div>
                    </div>

                    <div class="mt-2 pt-2 border-t border-gray-100">
                        <p class="text-xs text-gray-400 mb-1">📝 รายละเอียดเพิ่มเติม</p>
                        <p class="text-gray-600 bg-gray-50 border border-gray-200 p-2 rounded text-sm leading-relaxed">
                            "${props.details || '-'}"
                        </p>
                    </div>
                    
                    <div class="mt-2 text-right">
                         <span class="px-2 py-1 rounded text-xs font-bold ${props.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}">
                            สถานะ: ${props.status === 'pending' ? '⏳ รอดำเนินการ' : '✅ เสร็จสิ้น'}
                         </span>
                    </div>
                </div>
            `;

            Swal.fire({
                title: '📋 รายละเอียดงานซ่อม',
                html: htmlContent,
                showConfirmButton: true,
                confirmButtonText: 'ปิดหน้าต่าง',
                confirmButtonColor: '#10b981',
                width: '400px',
                customClass: { popup: 'rounded-xl shadow-xl' }
            });
        },
        
        eventMouseEnter: function(mouseEnterInfo) {
            mouseEnterInfo.el.style.cursor = 'pointer';
        },

        height: 'auto'
    });

    calendar.render();
}



