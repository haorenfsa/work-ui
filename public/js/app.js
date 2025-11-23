// API 基础地址
const API_BASE = 'http://localhost:3000/api';

// 全局应用对象
const app = {
    currentView: 'categories',
    currentCategory: null,
    currentWeek: null,
    categories: [],
    tasks: [],

    // 初始化应用
    init() {
        this.setupNavigation();
        this.loadCategories();
        this.currentWeek = this.getCurrentWeekNumber();
        this.setupWeekOptions();
    },

    // 设置导航
    setupNavigation() {
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const view = e.target.dataset.view;
                this.showView(view);
            });
        });
    },

    // 显示指定视图
    showView(viewName) {
        // 更新导航按钮状态
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.view === viewName) {
                btn.classList.add('active');
            }
        });

        // 更新视图显示
        document.querySelectorAll('.view').forEach(view => {
            view.classList.remove('active');
        });

        this.currentView = viewName;

        switch (viewName) {
            case 'categories':
                document.getElementById('categoriesView').classList.add('active');
                this.loadCategories();
                break;
            case 'weekly':
                document.getElementById('weeklyView').classList.add('active');
                this.loadWeeklyView();
                break;
            case 'report':
                document.getElementById('reportView').classList.add('active');
                this.loadWeeklyReport();
                break;
        }
    },

    // ============ 分类管理 ============

    async loadCategories() {
        try {
            const response = await fetch(`${API_BASE}/categories`);
            this.categories = await response.json();
            this.renderCategories();
            this.renderSidebar();
        } catch (error) {
            console.error('加载分类失败:', error);
            alert('加载分类失败');
        }
    },

    renderCategories() {
        const grid = document.getElementById('categoriesGrid');
        grid.innerHTML = this.categories.map(cat => `
            <div class="category-card" onclick="app.showCategoryDetail(${cat.id})">
                <div class="category-card-header">
                    <div class="category-card-title">${cat.name}</div>
                    <button class="category-card-edit" onclick="event.stopPropagation(); app.editCategory(${cat.id})">⚙️</button>
                </div>
                <div class="category-card-description">${cat.description || '暂无描述'}</div>
                <div class="category-card-stats">
                    <div class="category-card-stat">
                        <div class="category-card-stat-value">${cat.task_count || 0}</div>
                        <div class="category-card-stat-label">总任务</div>
                    </div>
                    <div class="category-card-stat">
                        <div class="category-card-stat-value">${cat.done_count || 0}</div>
                        <div class="category-card-stat-label">已完成</div>
                    </div>
                    <div class="category-card-stat">
                        <div class="category-card-stat-value">${cat.task_count > 0 ? Math.round((cat.done_count || 0) / cat.task_count * 100) : 0}%</div>
                        <div class="category-card-stat-label">完成率</div>
                    </div>
                </div>
            </div>
        `).join('');
    },

    renderSidebar() {
        const sidebar = document.getElementById('sidebarCategories');
        sidebar.innerHTML = this.categories.map(cat => `
            <div class="sidebar-item ${this.currentCategory === cat.id ? 'active' : ''}" 
                 onclick="app.showCategoryDetail(${cat.id})">
                <div class="sidebar-item-name">${cat.name}</div>
                <div class="sidebar-item-count">${cat.task_count || 0} 个任务</div>
            </div>
        `).join('');
    },

    showCategoryModal(categoryId = null) {
        const modal = document.getElementById('categoryModal');
        const title = document.getElementById('categoryModalTitle');
        const deleteBtn = document.getElementById('deleteCategoryBtn');

        if (categoryId) {
            const category = this.categories.find(c => c.id === categoryId);
            title.textContent = '编辑分类';
            document.getElementById('categoryId').value = category.id;
            document.getElementById('categoryName').value = category.name;
            document.getElementById('categoryDescription').value = category.description || '';
            deleteBtn.style.display = 'inline-block';
        } else {
            title.textContent = '新建分类';
            document.getElementById('categoryId').value = '';
            document.getElementById('categoryName').value = '';
            document.getElementById('categoryDescription').value = '';
            deleteBtn.style.display = 'none';
        }

        modal.classList.add('active');
    },

    closeCategoryModal() {
        document.getElementById('categoryModal').classList.remove('active');
    },

    editCategory(id) {
        this.showCategoryModal(id);
    },

    async saveCategory() {
        const id = document.getElementById('categoryId').value;
        const name = document.getElementById('categoryName').value.trim();
        const description = document.getElementById('categoryDescription').value.trim();

        if (!name) {
            alert('请输入分类名称');
            return;
        }

        try {
            const url = id ? `${API_BASE}/categories/${id}` : `${API_BASE}/categories`;
            const method = id ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, description })
            });

            if (response.ok) {
                this.closeCategoryModal();
                this.loadCategories();
            } else {
                alert('保存失败');
            }
        } catch (error) {
            console.error('保存分类失败:', error);
            alert('保存失败');
        }
    },

    async deleteCategory() {
        const id = document.getElementById('categoryId').value;
        if (!confirm('确定要删除这个分类吗？分类下的任务不会被删除。')) {
            return;
        }

        try {
            const response = await fetch(`${API_BASE}/categories/${id}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                this.closeCategoryModal();
                this.loadCategories();
            } else {
                alert('删除失败');
            }
        } catch (error) {
            console.error('删除分类失败:', error);
            alert('删除失败');
        }
    },

    // ============ 事项管理 ============

    async showCategoryDetail(categoryId) {
        this.currentCategory = categoryId;
        const category = this.categories.find(c => c.id === categoryId);
        
        document.getElementById('categoryDetailTitle').textContent = category.name;
        document.getElementById('categoryDetailView').classList.add('active');
        document.getElementById('categoriesView').classList.remove('active');

        await this.loadTasks(categoryId);
        this.renderSidebar();
    },

    async loadTasks(categoryId = null) {
        try {
            let url = `${API_BASE}/tasks`;
            if (categoryId) {
                url += `?category_id=${categoryId}`;
            }
            
            const response = await fetch(url);
            this.tasks = await response.json();
            this.renderTasks();
        } catch (error) {
            console.error('加载事项失败:', error);
            alert('加载事项失败');
        }
    },

    renderTasks() {
        const list = document.getElementById('tasksList');
        
        if (this.tasks.length === 0) {
            list.innerHTML = '<div style="text-align:center; padding:2rem; color:#6c757d;">暂无事项</div>';
            return;
        }

        list.innerHTML = this.tasks.map(task => `
            <div class="task-item priority-${task.priority}" onclick="app.editTask(${task.id})">
                <div class="task-item-header">
                    <div class="task-item-title">${task.title}</div>
                    <div class="task-item-meta">
                        <span class="task-badge priority-${task.priority}">${task.priority.toUpperCase()}</span>
                        <span class="task-badge status-${task.status}">${this.getStatusText(task.status)}</span>
                    </div>
                </div>
                ${task.description ? `<div class="task-item-description">${task.description}</div>` : ''}
                <div class="task-item-footer">
                    <div class="task-progress">
                        <div class="task-progress-bar">
                            <div class="task-progress-fill" style="width: ${task.progress}%"></div>
                        </div>
                    </div>
                    <div class="task-week">${task.progress}% ${task.week_number ? `| WK${task.week_number}` : ''}</div>
                </div>
            </div>
        `).join('');
    },

    getStatusText(status) {
        const statusMap = {
            'todo': '待办',
            'doing': '进行中',
            'done': '已完成',
            'backlog': 'Backlog'
        };
        return statusMap[status] || status;
    },

    showTaskModal(taskId = null) {
        const modal = document.getElementById('taskModal');
        const title = document.getElementById('taskModalTitle');
        const deleteBtn = document.getElementById('deleteTaskBtn');

        // 填充分类选项
        const categorySelect = document.getElementById('taskCategory');
        categorySelect.innerHTML = '<option value="">无分类</option>' + 
            this.categories.map(cat => `<option value="${cat.id}">${cat.name}</option>`).join('');

        if (taskId) {
            const task = this.tasks.find(t => t.id === taskId);
            title.textContent = '编辑事项';
            document.getElementById('taskId').value = task.id;
            document.getElementById('taskTitle').value = task.title;
            document.getElementById('taskDescription').value = task.description || '';
            document.getElementById('taskCategory').value = task.category_id || '';
            document.getElementById('taskPriority').value = task.priority;
            document.getElementById('taskStatus').value = task.status;
            document.getElementById('taskProgress').value = task.progress;
            document.getElementById('taskWeek').value = task.week_number || '';
            deleteBtn.style.display = 'inline-block';
        } else {
            title.textContent = '新建事项';
            document.getElementById('taskId').value = '';
            document.getElementById('taskTitle').value = '';
            document.getElementById('taskDescription').value = '';
            document.getElementById('taskCategory').value = this.currentCategory || '';
            document.getElementById('taskPriority').value = 'p2';
            document.getElementById('taskStatus').value = 'todo';
            document.getElementById('taskProgress').value = '0';
            document.getElementById('taskWeek').value = this.currentWeek || '';
            deleteBtn.style.display = 'none';
        }

        modal.classList.add('active');
    },

    closeTaskModal() {
        document.getElementById('taskModal').classList.remove('active');
    },

    editTask(id) {
        this.showTaskModal(id);
    },

    async saveTask() {
        const id = document.getElementById('taskId').value;
        const title = document.getElementById('taskTitle').value.trim();
        const description = document.getElementById('taskDescription').value.trim();
        const category_id = document.getElementById('taskCategory').value || null;
        const priority = document.getElementById('taskPriority').value;
        const status = document.getElementById('taskStatus').value;
        const progress = parseInt(document.getElementById('taskProgress').value) || 0;
        const week_number = parseInt(document.getElementById('taskWeek').value) || null;

        if (!title) {
            alert('请输入事项标题');
            return;
        }

        try {
            const url = id ? `${API_BASE}/tasks/${id}` : `${API_BASE}/tasks`;
            const method = id ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title, description, category_id, priority, status, progress, week_number
                })
            });

            if (response.ok) {
                this.closeTaskModal();
                if (this.currentView === 'categories' && this.currentCategory) {
                    await this.loadTasks(this.currentCategory);
                } else if (this.currentView === 'weekly') {
                    await this.loadWeeklyView();
                }
                this.loadCategories(); // 更新统计
            } else {
                alert('保存失败');
            }
        } catch (error) {
            console.error('保存事项失败:', error);
            alert('保存失败');
        }
    },

    async deleteTask() {
        const id = document.getElementById('taskId').value;
        if (!confirm('确定要删除这个事项吗？')) {
            return;
        }

        try {
            const response = await fetch(`${API_BASE}/tasks/${id}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                this.closeTaskModal();
                if (this.currentCategory) {
                    await this.loadTasks(this.currentCategory);
                }
                this.loadCategories();
            } else {
                alert('删除失败');
            }
        } catch (error) {
            console.error('删除事项失败:', error);
            alert('删除失败');
        }
    },

    // ============ 每周视图 ============

    getCurrentWeekNumber() {
        const now = new Date();
        const start = new Date(now.getFullYear(), 0, 1);
        const diff = now - start;
        const oneWeek = 1000 * 60 * 60 * 24 * 7;
        return Math.ceil(diff / oneWeek);
    },

    async loadWeeklyView() {
        document.getElementById('weekTitle').textContent = `WK${this.currentWeek}`;
        
        try {
            const response = await fetch(`${API_BASE}/tasks/week/${this.currentWeek}`);
            const tasks = await response.json();
            
            this.renderWeekStats(tasks);
            this.renderWeekTasks(tasks);
        } catch (error) {
            console.error('加载每周视图失败:', error);
            alert('加载失败');
        }
    },

    renderWeekStats(tasks) {
        const total = tasks.length;
        const done = tasks.filter(t => t.status === 'done').length;
        const doing = tasks.filter(t => t.status === 'doing').length;
        const completionRate = total > 0 ? Math.round(done / total * 100) : 0;

        document.getElementById('weekStats').innerHTML = `
            <div class="week-stat-card">
                <div class="week-stat-value">${total}</div>
                <div class="week-stat-label">总任务数</div>
            </div>
            <div class="week-stat-card">
                <div class="week-stat-value">${done}</div>
                <div class="week-stat-label">已完成</div>
            </div>
            <div class="week-stat-card">
                <div class="week-stat-value">${doing}</div>
                <div class="week-stat-label">进行中</div>
            </div>
            <div class="week-stat-card">
                <div class="week-stat-value">${completionRate}%</div>
                <div class="week-stat-label">完成率</div>
            </div>
        `;
    },

    renderWeekTasks(tasks) {
        const p0Tasks = tasks.filter(t => t.priority === 'p0');
        const p1Tasks = tasks.filter(t => t.priority === 'p1');
        const p2Tasks = tasks.filter(t => t.priority === 'p2');

        const container = document.getElementById('weekTasks');
        container.innerHTML = '';

        if (p0Tasks.length > 0) {
            container.innerHTML += this.renderPriorityGroup('p0', 'P0 - 最高优先级', p0Tasks);
        }
        if (p1Tasks.length > 0) {
            container.innerHTML += this.renderPriorityGroup('p1', 'P1 - 高优先级', p1Tasks);
        }
        if (p2Tasks.length > 0) {
            container.innerHTML += this.renderPriorityGroup('p2', 'P2 - 普通优先级', p2Tasks);
        }

        if (tasks.length === 0) {
            container.innerHTML = '<div style="text-align:center; padding:2rem; color:#6c757d;">本周暂无任务</div>';
        }
    },

    renderPriorityGroup(priority, title, tasks) {
        return `
            <div class="priority-group">
                <div class="priority-group-header ${priority}">${title}</div>
                <div class="priority-group-tasks">
                    ${tasks.map(task => `
                        <div class="task-item priority-${task.priority}" onclick="app.editTask(${task.id})">
                            <div class="task-item-header">
                                <div class="task-item-title">${task.title}</div>
                                <div class="task-item-meta">
                                    <span class="task-badge status-${task.status}">${this.getStatusText(task.status)}</span>
                                    ${task.category_name ? `<span class="task-badge" style="background:#e9ecef;color:#495057;">${task.category_name}</span>` : ''}
                                </div>
                            </div>
                            ${task.description ? `<div class="task-item-description">${task.description}</div>` : ''}
                            <div class="task-item-footer">
                                <div class="task-progress">
                                    <div class="task-progress-bar">
                                        <div class="task-progress-fill" style="width: ${task.progress}%"></div>
                                    </div>
                                </div>
                                <div class="task-week">${task.progress}%</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    },

    changeWeek(delta) {
        this.currentWeek += delta;
        this.loadWeeklyView();
    },

    // ============ 周报生成 ============

    setupWeekOptions() {
        const select = document.getElementById('reportWeekSelect');
        const currentWeek = this.getCurrentWeekNumber();
        
        // 生成最近10周的选项
        for (let i = 0; i < 10; i++) {
            const week = currentWeek - i;
            const option = document.createElement('option');
            option.value = week;
            option.textContent = `WK${week}`;
            if (i === 0) option.selected = true;
            select.appendChild(option);
        }
    },

    async loadWeeklyReport() {
        const weekNumber = document.getElementById('reportWeekSelect').value;
        
        try {
            const response = await fetch(`${API_BASE}/weekly-report/${weekNumber}`);
            const data = await response.json();
            
            this.renderReport(data);
        } catch (error) {
            console.error('生成周报失败:', error);
            alert('生成周报失败');
        }
    },

    renderReport(data) {
        let markdown = `# WK${data.weekNumber} 周报\n\n`;
        
        // 本周进展
        markdown += `## 本周进展\n\n`;
        
        const doneByCategory = {};
        data.doneTasksByCategory.forEach(task => {
            if (!doneByCategory[task.category_name]) {
                doneByCategory[task.category_name] = [];
            }
            doneByCategory[task.category_name].push(task);
        });
        
        for (const [category, tasks] of Object.entries(doneByCategory)) {
            markdown += `${category}:\n`;
            tasks.forEach(task => {
                markdown += `- ${task.title}`;
                if (task.progress < 100) {
                    markdown += ` [${task.progress}%]`;
                }
                markdown += '\n';
                if (task.description) {
                    markdown += `    - ${task.description}\n`;
                }
            });
            markdown += '\n';
        }
        
        // 本周新增需求
        if (data.addedTasks.length > 0) {
            markdown += `## 本周新增需求 (Added)\n`;
            data.addedTasks.forEach(task => {
                markdown += `- ${task.category_name ? task.category_name + ': ' : ''}${task.title}\n`;
            });
            markdown += '\n';
        }
        
        // 进行中
        if (data.inProgressTasks.length > 0) {
            markdown += `## 进行中 (In Progress)\n`;
            data.inProgressTasks.forEach(task => {
                markdown += `- ${task.title} [${task.progress}%]\n`;
            });
            markdown += '\n';
        }
        
        // Backlog
        if (data.backlogTasks.length > 0) {
            markdown += `## Backlog\n\n`;
            const backlogByCategory = {};
            data.backlogTasks.forEach(task => {
                const cat = task.category_name || '其他';
                if (!backlogByCategory[cat]) {
                    backlogByCategory[cat] = [];
                }
                backlogByCategory[cat].push(task);
            });
            
            for (const [category, tasks] of Object.entries(backlogByCategory)) {
                markdown += `${category}:\n`;
                tasks.forEach(task => {
                    markdown += `- ${task.title}\n`;
                });
                markdown += '\n';
            }
        }
        
        document.getElementById('reportContent').textContent = markdown;
    },

    copyReport() {
        const content = document.getElementById('reportContent').textContent;
        navigator.clipboard.writeText(content).then(() => {
            alert('已复制到剪贴板');
        }).catch(err => {
            console.error('复制失败:', err);
            alert('复制失败');
        });
    },

    downloadReport() {
        const content = document.getElementById('reportContent').textContent;
        const weekNumber = document.getElementById('reportWeekSelect').value;
        const blob = new Blob([content], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `wk${weekNumber}.md`;
        a.click();
        URL.revokeObjectURL(url);
    }
};

// 页面加载完成后初始化应用
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
