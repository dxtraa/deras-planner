class TaskManager {
    constructor() {
        this.tasks = JSON.parse(localStorage.getItem('tasks')) || [];
        this.reminderSettings = JSON.parse(localStorage.getItem('reminderSettings')) || {
            dailyReminderTime: '08:00',
            reminderBeforeDue: '60',
            enableSound: true,
            enableDailyReminder: true
        };
        this.currentFilter = 'all';
        this.notificationPermission = false;
        this.reminderInterval = null;
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.updateDateDisplay();
        this.renderTasks();
        this.renderReminders();
        this.updateStats();
        this.checkNotificationPermission();
        this.startReminderChecker();
        this.startDailyReminder();
        this.requestNotificationOnLoad();
    }

    setupEventListeners() {
        // Filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.currentFilter = e.target.dataset.filter;
                this.renderTasks();
            });
        });

        // Close modals on outside click
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeAllModals();
            }
        });
    }

    // Task Management
    addTaskFromModal() {
        const text = document.getElementById('modalTaskInput').value.trim();
        const priority = document.getElementById('modalPrioritySelect').value;
        const dueDateTime = document.getElementById('modalDueDateTime').value;
        const reminderBefore = document.getElementById('modalReminderSelect').value;
        const repeat = document.getElementById('modalRepeatSelect').value;

        if (!text) {
            this.showNotification('❌ Mohon isi nama tugas!', 'error');
            return;
        }

        const task = {
            id: Date.now(),
            text,
            priority,
            dueDateTime: dueDateTime || null,
            reminderBefore: reminderBefore !== 'none' ? parseInt(reminderBefore) : null,
            repeat: repeat !== 'none' ? repeat : null,
            completed: false,
            createdAt: new Date().toISOString(),
            reminderSent: false
        };

        this.tasks.unshift(task);
        this.saveTasks();
        this.renderTasks();
        this.renderReminders();
        this.updateStats();
        this.closeAddTaskModal();
        this.scheduleReminder(task);
        
        this.showNotification('✨ Tugas berhasil ditambahkan dengan reminder!');
        this.playNotificationSound();
    }

    toggleTask(id) {
        const task = this.tasks.find(t => t.id === id);
        if (task) {
            task.completed = !task.completed;
            if (task.completed) {
                task.completedAt = new Date().toISOString();
                // Cancel reminder for completed task
                this.cancelReminder(task);
            } else {
                delete task.completedAt;
                task.reminderSent = false;
                this.scheduleReminder(task);
            }
            this.saveTasks();
            this.renderTasks();
            this.renderReminders();
            this.updateStats();
        }
    }

    deleteTask(id) {
        const task = this.tasks.find(t => t.id === id);
        if (confirm('Yakin ingin menghapus tugas ini? 🗑️')) {
            this.cancelReminder(task);
            this.tasks = this.tasks.filter(t => t.id !== id);
            this.saveTasks();
            this.renderTasks();
            this.renderReminders();
            this.updateStats();
            this.showNotification('Tugas berhasil dihapus');
        }
    }

    getFilteredTasks() {
        switch(this.currentFilter) {
            case 'active':
                return this.tasks.filter(t => !t.completed);
            case 'completed':
                return this.tasks.filter(t => t.completed);
            case 'high':
                return this.tasks.filter(t => t.priority === 'high' && !t.completed);
            default:
                return this.tasks;
        }
    }

    // Reminder System
    scheduleReminder(task) {
        if (!task.dueDateTime || !task.reminderBefore || task.completed) return;

        const dueDate = new Date(task.dueDateTime);
        const reminderTime = new Date(dueDate.getTime() - task.reminderBefore * 60000);
        const now = new Date();

        if (reminderTime > now) {
            const timeout = reminderTime.getTime() - now.getTime();
            task.reminderTimeout = setTimeout(() => {
                this.sendReminder(task);
            }, timeout);
        }
    }

    cancelReminder(task) {
        if (task.reminderTimeout) {
            clearTimeout(task.reminderTimeout);
            task.reminderTimeout = null;
        }
    }

    sendReminder(task) {
        if (task.completed || task.reminderSent) return;

        task.reminderSent = true;
        this.saveTasks();

        // Browser notification
        if (this.notificationPermission) {
            const notification = new Notification('🔔 Reminder Tugas!', {
                body: `📝 ${task.text}\n🎯 Prioritas: ${this.getPriorityLabel(task.priority)}\n⏰ Tenggat: ${this.formatDateTime(task.dueDateTime)}`,
                icon: 'https://emojicdn.elk.sh/🔔',
                badge: 'https://emojicdn.elk.sh/🌸',
                vibrate: [200, 100, 200],
                requireInteraction: true,
                tag: `task-${task.id}`
            });

            notification.onclick = () => {
                window.focus();
                this.showNotification(`Membuka tugas: ${task.text}`);
            };
        }

        // Sound
        this.playNotificationSound();

        // Visual notification in app
        this.showNotification(`⏰ Reminder: ${task.text}`, 'reminder');
        this.renderReminders();
    }

    checkReminders() {
        const now = new Date();
        let hasChanges = false;

        this.tasks.forEach(task => {
            if (task.completed || task.reminderSent || !task.dueDateTime || !task.reminderBefore) return;

            const dueDate = new Date(task.dueDateTime);
            const reminderTime = new Date(dueDate.getTime() - task.reminderBefore * 60000);

            if (now >= reminderTime && now <= dueDate) {
                this.sendReminder(task);
                hasChanges = true;
            }
        });

        if (hasChanges) {
            this.saveTasks();
            this.renderReminders();
        }
    }

    startReminderChecker() {
        // Check reminders every 30 seconds
        this.reminderInterval = setInterval(() => {
            this.checkReminders();
        }, 30000);

        // Initial check
        this.checkReminders();
    }

    startDailyReminder() {
        // Check daily reminder
        setInterval(() => {
            if (!this.reminderSettings.enableDailyReminder) return;
            
            const now = new Date();
            const [hours, minutes] = this.reminderSettings.dailyReminderTime.split(':');
            
            if (now.getHours() === parseInt(hours) && 
                now.getMinutes() === parseInt(minutes) && 
                now.getSeconds() < 30) {
                this.sendDailyReminder();
            }
        }, 30000);
    }

    sendDailyReminder() {
        const pendingTasks = this.tasks.filter(t => !t.completed);
        
        if (pendingTasks.length === 0) return;

        if (this.notificationPermission) {
            const notification = new Notification('📋 Ringkasan Harian', {
                body: `Kamu memiliki ${pendingTasks.length} tugas yang belum selesai. Ayo selesaikan! 💪`,
                icon: 'https://emojicdn.elk.sh/📋',
                requireInteraction: true
            });
        }

        this.showNotification(`📋 ${pendingTasks.length} tugas menunggu untuk diselesaikan!`);
    }

    // Render Functions
    renderTasks() {
        const taskList = document.getElementById('taskList');
        const emptyState = document.getElementById('emptyState');
        const filteredTasks = this.getFilteredTasks();

        if (filteredTasks.length === 0) {
            taskList.innerHTML = '';
            emptyState.classList.add('show');
        } else {
            emptyState.classList.remove('show');
            taskList.innerHTML = filteredTasks.map(task => this.createTaskHTML(task)).join('');
        }
    }

    createTaskHTML(task) {
        const priorityLabels = {
            high: '🔥 High',
            medium: '⭐ Medium',
            low: '💚 Low'
        };

        const priorityClass = `priority-${task.priority}`;
        const completedClass = task.completed ? 'completed' : '';
        const checkedClass = task.completed ? 'checked' : '';
        
        const dueDateHTML = task.dueDateTime ? `
            <span class="due-date">
                <i class="far fa-calendar-alt"></i>
                ${this.formatDateTime(task.dueDateTime)}
            </span>
        ` : '';

        const reminderHTML = task.reminderBefore && !task.completed ? `
            <span class="task-reminder-indicator ${!task.reminderSent ? 'active' : ''}">
                <i class="fas fa-bell"></i>
                ${task.reminderBefore >= 1440 ? '1 hari sblm' : 
                  task.reminderBefore >= 60 ? `${task.reminderBefore/60} jam sblm` : 
                  `${task.reminderBefore} mnt sblm`}
            </span>
        ` : '';

        const repeatHTML = task.repeat ? `
            <span class="task-reminder-indicator">
                <i class="fas fa-sync-alt"></i>
                ${task.repeat === 'daily' ? 'Harian' : 
                  task.repeat === 'weekly' ? 'Mingguan' : 'Bulanan'}
            </span>
        ` : '';

        return `
            <div class="task-item ${completedClass}" data-id="${task.id}">
                <div class="task-checkbox ${checkedClass}" onclick="taskManager.toggleTask(${task.id})"></div>
                <div class="task-content">
                    <div class="task-text">${task.text}</div>
                    <div class="task-meta">
                        <span class="priority-badge ${priorityClass}">${priorityLabels[task.priority]}</span>
                        ${dueDateHTML}
                        ${reminderHTML}
                        ${repeatHTML}
                    </div>
                </div>
                <div class="task-actions">
                    <button class="delete-btn" onclick="taskManager.deleteTask(${task.id})">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            </div>
        `;
    }

    renderReminders() {
        const remindersList = document.getElementById('remindersList');
        const noReminders = document.getElementById('noReminders');
        const reminderCount = document.getElementById('reminderCount');
        
        const activeReminders = this.tasks.filter(task => 
            task.dueDateTime && 
            task.reminderBefore && 
            !task.completed && 
            !task.reminderSent &&
            new Date(task.dueDateTime) > new Date()
        );

        reminderCount.textContent = activeReminders.length;

        if (activeReminders.length === 0) {
            remindersList.innerHTML = '';
            noReminders.classList.add('show');
        } else {
            noReminders.classList.remove('show');
            remindersList.innerHTML = activeReminders
                .sort((a, b) => new Date(a.dueDateTime) - new Date(b.dueDateTime))
                .slice(0, 5)
                .map(task => this.createReminderHTML(task))
                .join('');
        }
    }

    createReminderHTML(task) {
        const dueDate = new Date(task.dueDateTime);
        const now = new Date();
        const timeUntil = dueDate - now;
        
        let timeText = '';
        if (timeUntil < 3600000) { // < 1 hour
            const minutes = Math.floor(timeUntil / 60000);
            timeText = `${minutes} menit lagi`;
        } else if (timeUntil < 86400000) { // < 24 hours
            const hours = Math.floor(timeUntil / 3600000);
            timeText = `${hours} jam lagi`;
        } else {
            const days = Math.floor(timeUntil / 86400000);
            timeText = `${days} hari lagi`;
        }

        return `
            <div class="reminder-item">
                <div class="reminder-icon">${this.getPriorityEmoji(task.priority)}</div>
                <div class="reminder-info">
                    <div class="reminder-text">${task.text}</div>
                    <div class="reminder-time">
                        <i class="far fa-clock"></i>
                        ${timeText} • ${this.formatDateTime(task.dueDateTime)}
                    </div>
                </div>
                <div class="reminder-actions">
                    <button class="reminder-btn" onclick="taskManager.dismissReminder(${task.id})" title="Tunda">
                        <i class="fas fa-clock"></i>
                    </button>
                    <button class="reminder-btn" onclick="taskManager.completeTask(${task.id})" title="Selesai">
                        <i class="fas fa-check"></i>
                    </button>
                </div>
            </div>
        `;
    }

    dismissReminder(id) {
        const task = this.tasks.find(t => t.id === id);
        if (task) {
            // Snooze for 15 minutes
            task.reminderSent = true;
            setTimeout(() => {
                task.reminderSent = false;
                this.scheduleReminder(task);
                this.saveTasks();
                this.renderReminders();
            }, 15 * 60000);
            
            this.saveTasks();
            this.renderReminders();
            this.showNotification('⏰ Reminder ditunda 15 menit');
        }
    }

    completeTask(id) {
        this.toggleTask(id);
    }

    // Notification System
    checkNotificationPermission() {
        if ('Notification' in window) {
            this.notificationPermission = Notification.permission === 'granted';
        }
    }

    requestNotificationOnLoad() {
        if ('Notification' in window && Notification.permission === 'default') {
            setTimeout(() => {
                document.getElementById('notificationModal').classList.add('show');
            }, 2000);
        }
    }

    async requestNotificationPermission() {
        try {
            const permission = await Notification.requestPermission();
            this.notificationPermission = permission === 'granted';
            this.closeNotificationModal();
            
            if (this.notificationPermission) {
                this.showNotification('✅ Notifikasi berhasil diaktifkan!');
                // Send test notification
                new Notification('🌸 Aesthetic Planner', {
                    body: 'Notifikasi berhasil diaktifkan! Anda akan menerima reminder untuk tugas-tugas.',
                    icon: 'https://emojicdn.elk.sh/🌸'
                });
            }
        } catch (error) {
            console.error('Error requesting notification permission:', error);
        }
    }

    playNotificationSound() {
        if (!this.reminderSettings.enableSound) return;
        
        // Create simple beep sound using AudioContext
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.value = 800;
            oscillator.type = 'sine';
            gainNode.gain.value = 0.3;
            
            oscillator.start();
            
            setTimeout(() => {
                oscillator.stop();
                audioContext.close();
            }, 200);
        } catch (error) {
            console.log('Sound not supported');
        }
    }

    // Modal Management
    openAddTaskModal() {
        document.getElementById('addTaskModal').classList.add('show');
        document.getElementById('modalTaskInput').focus();
    }

    closeAddTaskModal() {
        document.getElementById('addTaskModal').classList.remove('show');
        document.getElementById('modalTaskInput').value = '';
        document.getElementById('modalDueDateTime').value = '';
    }

    openReminderSettings() {
        document.getElementById('reminderSettingsModal').classList.add('show');
        this.loadReminderSettings();
    }

    closeReminderSettings() {
        document.getElementById('reminderSettingsModal').classList.remove('show');
    }

    closeNotificationModal() {
        document.getElementById('notificationModal').classList.remove('show');
    }

    closeAllModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.classList.remove('show');
        });
    }

    loadReminderSettings() {
        document.getElementById('dailyReminderTime').value = this.reminderSettings.dailyReminderTime;
        document.getElementById('reminderBeforeDue').value = this.reminderSettings.reminderBeforeDue;
        document.getElementById('enableSound').checked = this.reminderSettings.enableSound;
        document.getElementById('enableDailyReminder').checked = this.reminderSettings.enableDailyReminder;
    }

    saveReminderSettings() {
        this.reminderSettings = {
            dailyReminderTime: document.getElementById('dailyReminderTime
