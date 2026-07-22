let tasks = JSON.parse(localStorage.getItem('tasks')) || [];
let currentFilter = 'all';
let settings = JSON.parse(localStorage.getItem('reminderSettings')) || {
    dailyTime: '08:00',
    soundEnabled: true,
    dailyEnabled: true
};
let reminderCheckInterval;

function init() {
    updateDateDisplay();
    renderAll();
    updateStats();
    checkNotificationPermission();
    startReminderChecker();
    startDailyReminder();
    document.getElementById('currentYear').textContent = new Date().getFullYear();
    
    // Enter key to add task
    document.getElementById('taskInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') addTask();
    });
}

// ============ NOTIFICATION ============

function checkNotificationPermission() {
    if ('Notification' in window) {
        if (Notification.permission === 'default') {
            setTimeout(() => {
                document.getElementById('notificationBanner').style.display = 'block';
            }, 2000);
        }
    }
}

function requestNotification() {
    if ('Notification' in window) {
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                showToast('✅ Notifikasi diaktifkan!');
                new Notification('🌸 Aesthetic Planner', {
                    body: 'Kamu akan mendapat reminder untuk tugas-tugasmu!',
                    icon: '🌸'
                });
            }
            hideBanner();
        });
    }
}

function hideBanner() {
    document.getElementById('notificationBanner').style.display = 'none';
}

function showNotification(title, body) {
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, {
            body: body,
            icon: '🌸',
            requireInteraction: true
        });
    }
}

function playSound() {
    if (!settings.soundEnabled) return;
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 800;
        gain.gain.value = 0.1;
        osc.start();
        setTimeout(() => { osc.stop(); ctx.close(); }, 200);
    } catch(e) {}
}

function testReminder() {
    if ('Notification' in window && Notification.permission === 'granted') {
        showNotification('🔔 Tes Reminder', 'Ini adalah contoh notifikasi reminder!');
        playSound();
        showToast('✅ Notifikasi tes dikirim!');
    } else {
        showToast('❌ Izinkan notifikasi terlebih dahulu');
        document.getElementById('notificationBanner').style.display = 'block';
    }
}

// ============ TASK MANAGEMENT ============

function addTask() {
    const text = document.getElementById('taskInput').value.trim();
    const priority = document.getElementById('prioritySelect').value;
    const dueDateTime = document.getElementById('dueDateTime').value;
    const reminderBefore = document.getElementById('reminderSelect').value;

    if (!text) {
        showToast('❌ Isi nama tugas dulu ya!');
        return;
    }

    const task = {
        id: Date.now(),
        text: text,
        priority: priority,
        dueDateTime: dueDateTime || null,
        reminderBefore: reminderBefore !== 'none' ? parseInt(reminderBefore) : null,
        completed: false,
        createdAt: new Date().toISOString(),
        reminderSent: false
    };

    tasks.unshift(task);
    saveTasks();
    renderAll();
    updateStats();
    scheduleReminder(task);
    
    // Clear form
    document.getElementById('taskInput').value = '';
    document.getElementById('dueDateTime').value = '';
    document.getElementById('taskInput').focus();
    
    showToast('✨ Tugas berhasil ditambahkan!');
    playSound();
}

function toggleTask(id) {
    const task = tasks.find(t => t.id === id);
    if (task) {
        task.completed = !task.completed;
        if (task.completed) {
            task.completedAt = new Date().toISOString();
        } else {
            delete task.completedAt;
            task.reminderSent = false;
        }
        saveTasks();
        renderAll();
        updateStats();
    }
}

function deleteTask(id) {
    if (confirm('Yakin hapus tugas ini? 🗑️')) {
        tasks = tasks.filter(t => t.id !== id);
        saveTasks();
        renderAll();
        updateStats();
        showToast('Tugas dihapus');
    }
}

function completeTask(id) {
    const task = tasks.find(t => t.id === id);
    if (task && !task.completed) {
        task.completed = true;
        task.completedAt = new Date().toISOString();
        saveTasks();
        renderAll();
        updateStats();
        showToast('✅ Tugas selesai!');
    }
}

function dismissReminder(id) {
    const task = tasks.find(t => t.id === id);
    if (task) {
        task.reminderSent = true;
        // Reschedule after 10 minutes
        setTimeout(() => {
            task.reminderSent = false;
            saveTasks();
            renderAll();
        }, 10 * 60000);
        saveTasks();
        renderAll();
        showToast('⏰ Reminder ditunda 10 menit');
    }
}

// ============ REMINDER SYSTEM ============

function scheduleReminder(task) {
    if (!task.dueDateTime || !task.reminderBefore || task.completed || task.reminderSent) return;

    const dueDate = new Date(task.dueDateTime);
    const reminderTime = new Date(dueDate.getTime() - task.reminderBefore * 60000);
    const now = new Date();

    if (reminderTime > now) {
        const timeout = reminderTime.getTime() - now.getTime();
        setTimeout(() => {
            sendReminder(task);
        }, timeout);
    }
}

function sendReminder(task) {
    if (task.completed || task.reminderSent) return;
    
    task.reminderSent = true;
    saveTasks();
    
    const priorityEmoji = {
        high: '❤️',
        medium: '💛',
        low: '💚'
    };
    
    showNotification('🔔 Reminder Tugas!', 
        `${task.text}\n${priorityEmoji[task.priority]} ${task.priority.toUpperCase()}\n📅 ${formatDateTime(task.dueDateTime)}`
    );
    
    playSound();
    showToast(`⏰ Reminder: ${task.text}`);
    renderAll();
}

function checkReminders() {
    const now = new Date();
    let hasChanges = false;

    tasks.forEach(task => {
        if (task.completed || task.reminderSent || !task.dueDateTime || !task.reminderBefore) return;
        
        const dueDate = new Date(task.dueDateTime);
        const reminderTime = new Date(dueDate.getTime() - task.reminderBefore * 60000);
        
        if (now >= reminderTime && now <= dueDate) {
            sendReminder(task);
            hasChanges = true;
        }
    });

    if (hasChanges) {
        saveTasks();
        renderAll();
    }
}

function startReminderChecker() {
    if (reminderCheckInterval) clearInterval(reminderCheckInterval);
    reminderCheckInterval = setInterval(checkReminders, 30000);
    checkReminders(); // Initial check
}

function startDailyReminder() {
    setInterval(() => {
        if (!settings.dailyEnabled) return;
        
        const now = new Date();
        const [hours, minutes] = settings.dailyTime.split(':');
        
        if (now.getHours() === parseInt(hours) && 
            now.getMinutes() === parseInt(minutes) && 
            now.getSeconds() < 30) {
            
            const pendingCount = tasks.filter(t => !t.completed).length;
            if (pendingCount > 0) {
                showNotification('📋 Ringkasan Harian', 
                    `Kamu punya ${pendingCount} tugas yang belum selesai. Semangat! 💪`
                );
            }
        }
    }, 30000);
}

// ============ RENDERING ============

function renderAll() {
    renderTasks();
    renderReminders();
}

function renderTasks() {
    const taskList = document.getElementById('taskList');
    const emptyState = document.getElementById('emptyState');
    
    let filteredTasks = tasks;
    
    switch(currentFilter) {
        case 'active':
            filteredTasks = tasks.filter(t => !t.completed);
            break;
        case 'completed':
            filteredTasks = tasks.filter(t => t.completed);
            break;
        case 'reminder':
            filteredTasks = tasks.filter(t => t.reminderBefore && !t.completed);
            break;
    }

    if (filteredTasks.length === 0) {
        taskList.innerHTML = '';
        emptyState.classList.add('show');
    } else {
        emptyState.classList.remove('show');
        taskList.innerHTML = filteredTasks.map(task => createTaskHTML(task)).join('');
    }
}

function createTaskHTML(task) {
    const priorityLabels = {
        high: '🔥 High',
        medium: '⭐ Medium',
        low: '💚 Low'
    };
    
    const completedClass = task.completed ? 'completed' : '';
    const checkedClass = task.completed ? 'checked' : '';
    
    const dueHTML = task.dueDateTime ? `
        <span class="due-date">
            <i class="far fa-calendar-alt"></i>
            ${formatDateTime(task.dueDateTime)}
        </span>
    ` : '';
    
    const reminderHTML = task.reminderBefore && !task.completed ? `
        <span class="reminder-badge">
            <i class="fas fa-bell"></i>
            ${task.reminderBefore >= 1440 ? '1 hari sblm' : 
              task.reminderBefore >= 60 ? `${task.reminderBefore/60}j sblm` : 
              `${task.reminderBefore}m sblm`}
        </span>
    ` : '';
    
    return `
        <div class="task-item ${completedClass}" data-id="${task.id}">
            <div class="task-checkbox ${checkedClass}" onclick="toggleTask(${task.id})"></div>
            <div class="task-content">
                <div class="task-text">${task.text}</div>
                <div class="task-meta">
                    <span class="priority-badge priority-${task.priority}">${priorityLabels[task.priority]}</span>
                    ${dueHTML}
                    ${reminderHTML}
                </div>
            </div>
            <button class="delete-btn" onclick="deleteTask(${task.id})">
                <i class="fas fa-trash-alt"></i>
            </button>
        </div>
    `;
}

function renderReminders() {
    const section = document.getElementById('remindersSection');
    const list = document.getElementById('remindersList');
    
    const activeReminders = tasks.filter(t => 
        t.dueDateTime && 
        t.reminderBefore && 
        !t.completed && 
        !t.reminderSent &&
        new Date(t.dueDateTime) > new Date()
    ).sort((a, b) => new Date(a.dueDateTime) - new Date(b.dueDateTime));
    
    if (activeReminders.length === 0) {
        section.style.display = 'none';
    } else {
        section.style.display = 'block';
        list.innerHTML = activeReminders.slice(0, 5).map(task => {
            const due = new Date(task.dueDateTime);
            const timeUntil = due - new Date();
            let timeText = '';
            
            if (timeUntil < 3600000) {
                timeText = `${Math.floor(timeUntil / 60000)} menit lagi`;
            } else if (timeUntil < 86400000) {
                timeText = `${Math.floor(timeUntil / 3600000)} jam lagi`;
            } else {
                timeText = `${Math.floor(timeUntil / 86400000)} hari lagi`;
            }
            
            const priorityEmoji = { high: '❤️', medium: '💛', low: '💚' };
            
            return `
                <div class="reminder-item">
                    <div class="reminder-icon">${priorityEmoji[task.priority]}</div>
                    <div class="reminder-info">
                        <div class="reminder-text">${task.text}</div>
                        <div class="reminder-time">
                            <i class="far fa-clock"></i> ${timeText} • ${formatDateTime(task.dueDateTime)}
                        </div>
                    </div>
                    <div class="reminder-actions">
                        <button onclick="dismissReminder(${task.id})" title="Tunda">
                            <i class="fas fa-clock"></i>
                        </button>
                        <button onclick="completeTask(${task.id})" title="Selesai">
                            <i class="fas fa-check"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }
}

function updateStats() {
    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const pending = total - completed;
    const productivity = total > 0 ? Math.round((completed / total) * 100) : 0;

    document.getElementById('totalCount').textContent = total;
    document.getElementById('completedCount').textContent = completed;
    document.getElementById('pendingCount').textContent = pending;
    document.getElementById('productivityScore').textContent = `${productivity}%`;
}

// ============ FILTERS ============

function filterTasks(filter) {
    currentFilter = filter;
    
    // Update active button
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.closest('.filter-btn').classList.add('active');
    
    renderTasks();
}

// ============ SETTINGS ============

function openReminderSettings() {
    document.getElementById('settingsModal').style.display = 'flex';
    document.getElementById('dailyTime').value = settings.dailyTime;
    document.getElementById('soundEnabled').checked = settings.soundEnabled;
    document.getElementById('dailyEnabled').checked = settings.dailyEnabled;
}

function closeSettings() {
    document.getElementById('settingsModal').style.display = 'none';
}

function saveSettings() {
    settings = {
        dailyTime: document.getElementById('dailyTime').value,
        soundEnabled: document.getElementById('soundEnabled').checked,
        dailyEnabled: document.getElementById('dailyEnabled').checked
    };
    
    localStorage.setItem('reminderSettings', JSON.stringify(settings));
    closeSettings();
    showToast('✅ Pengaturan disimpan!');
}

// ============ UTILITIES ============

function saveTasks() {
    localStorage.setItem('tasks', JSON.stringify(tasks));
}

function updateDateDisplay() {
    const now = new Date();
    const options = { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    };
    document.getElementById('dateDisplay').textContent = now.toLocaleDateString('id-ID', options);
}

function formatDateTime(dateTimeStr) {
    if (!dateTimeStr) return '';
    const date = new Date(dateTimeStr);
    const options = { 
        day: 'numeric', 
        month: 'short', 
        hour: '2-digit', 
        minute: '2-digit' 
    };
    return date.toLocaleDateString('id-ID', options);
}

function showToast(message) {
    // Remove existing toast
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
    
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        bottom: 30px;
        left: 50%;
        transform: translateX(-50%);
        background: white;
        padding: 12px 25px;
        border-radius: 25px;
        box-shadow: 0 5px 20px rgba(0,0,0,0.2);
        z-index: 2000;
        animation: slideUp 0.3s ease;
        font-weight: 500;
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideDown 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Add animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideUp {
        from { transform: translateX(-50%) translateY(100px); opacity: 0; }
        to { transform: translateX(-50%) translateY(0); opacity: 1; }
    }
    @keyframes slideDown {
        from { transform: translateX(-50%) translateY(0); opacity: 1; }
        to { transform: translateX(-50%) translateY(100px); opacity: 0; }
    }
`;
document.head.appendChild(style);

// Close modal on outside click
window.onclick = function(event) {
    if (event.target.id === 'settingsModal') {
        closeSettings();
    }
};

// ============ START APP ============
init();
