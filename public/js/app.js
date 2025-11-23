// API 基础地址
const API_BASE = 'http://localhost:3000/api';

// 全局应用对象
const app = {
    currentView: 'categories',
    currentCategory: null,
    currentProject: null,
    currentWeek: null,
    currentTab: 'projects',
    categories: [],
    projects: [],
    tasks: [],
    allProjects: [],
    quickAddPriority: 'p2',    // 初始化应用
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

    // ============ Tab 切换 ============
    
    switchTab(tabName) {
        this.currentTab = tabName;
        
        // 更新tab按钮状态
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.tab === tabName) {
                btn.classList.add('active');
            }
        });
        
        // 更新tab内容
        document.querySelectorAll('.tab-pane').forEach(pane => {
            pane.classList.remove('active');
        });
        
        if (tabName === 'projects') {
            document.getElementById('projectsTab').classList.add('active');
            document.getElementById('addProjectBtn').style.display = 'inline-block';
            document.getElementById('addTaskBtn').style.display = 'none';
        } else {
            document.getElementById('tasksTab').classList.add('active');
            document.getElementById('addProjectBtn').style.display = 'none';
            document.getElementById('addTaskBtn').style.display = 'inline-block';
            this.loadCategoryTasks();
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
                        <div class="category-card-stat-value">${cat.project_count || 0}</div>
                        <div class="category-card-stat-label">项目数</div>
                    </div>
                    <div class="category-card-stat">
                        <div class="category-card-stat-value">${cat.task_count || 0}</div>
                        <div class="category-card-stat-label">总任务</div>
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
                <div class="sidebar-item-count">${cat.project_count || 0} 个项目 · ${cat.task_count || 0} 个任务</div>
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
        if (!confirm('确定要删除这个分类吗？分类下的所有项目和任务都将被删除。')) {
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

    // ============ 分类详情 ============

    async showCategoryDetail(categoryId) {
        this.currentCategory = categoryId;
        this.currentTab = 'projects';
        const category = this.categories.find(c => c.id === categoryId);
        
        document.getElementById('categoryDetailTitle').textContent = category.name;
        document.getElementById('categoriesView').classList.remove('active');
        document.getElementById('categoryDetailView').classList.add('active');
        
        // 重置tab状态
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.tab === 'projects') {
                btn.classList.add('active');
            }
        });
        
        document.getElementById('projectsTab').classList.add('active');
        document.getElementById('tasksTab').classList.remove('active');
        document.getElementById('addProjectBtn').style.display = 'inline-block';
        document.getElementById('addTaskBtn').style.display = 'none';

        await this.loadProjects(categoryId);
        this.renderSidebar();
    },

    // ============ 项目管理 ============

    async loadProjects(categoryId) {
        try {
            const response = await fetch(`${API_BASE}/categories/${categoryId}/projects`);
            this.projects = await response.json();
            this.renderProjects();
        } catch (error) {
            console.error('加载项目失败:', error);
            alert('加载项目失败');
        }
    },

    renderProjects() {
        const grid = document.getElementById('projectsGrid');
        
        if (this.projects.length === 0) {
            grid.innerHTML = '<div style="text-align:center; padding:2rem; color:#6c757d;">暂无项目</div>';
            return;
        }

        grid.innerHTML = this.projects.map(project => `
            <div class="project-card ${project.is_default ? 'default-project' : ''}" 
                 onclick="app.showProjectDetail(${project.id})">
                <div class="project-card-header">
                    <div class="project-card-title">
                        ${project.name}
                        ${project.is_default ? '<span class="default-badge">默认</span>' : ''}
                    </div>
                    <button class="project-card-edit" onclick="event.stopPropagation(); app.editProject(${project.id})">⚙️</button>
                </div>
                <div class="project-card-description">${project.description || '暂无描述'}</div>
                <div class="project-card-stats">
                    <div class="project-card-stat">
                        <div class="project-card-stat-value">${project.task_count || 0}</div>
                        <div class="project-card-stat-label">总任务</div>
                    </div>
                    <div class="project-card-stat">
                        <div class="project-card-stat-value">${project.done_count || 0}</div>
                        <div class="project-card-stat-label">已完成</div>
                    </div>
                    <div class="project-card-stat">
                        <div class="project-card-stat-value">${project.task_count > 0 ? Math.round((project.done_count || 0) / project.task_count * 100) : 0}%</div>
                        <div class="project-card-stat-label">完成率</div>
                    </div>
                </div>
                <div class="project-card-footer">
                    创建于 ${new Date(project.created_at).toLocaleDateString()}
                </div>
            </div>
        `).join('');
    },

    showProjectModal(projectId = null) {
        const modal = document.getElementById('projectModal');
        const title = document.getElementById('projectModalTitle');
        const deleteBtn = document.getElementById('deleteProjectBtn');

        if (projectId) {
            const project = this.projects.find(p => p.id === projectId);
            title.textContent = '编辑项目';
            document.getElementById('projectId').value = project.id;
            document.getElementById('projectName').value = project.name;
            document.getElementById('projectDescription').value = project.description || '';
            document.getElementById('projectCategoryId').value = project.category_id;
            document.getElementById('projectIsDefault').value = project.is_default;
            
            if (project.is_default) {
                deleteBtn.style.display = 'none';
            } else {
                deleteBtn.style.display = 'inline-block';
            }
        } else {
            title.textContent = '新建项目';
            document.getElementById('projectId').value = '';
            document.getElementById('projectName').value = '';
            document.getElementById('projectDescription').value = '';
            document.getElementById('projectCategoryId').value = this.currentCategory;
            document.getElementById('projectIsDefault').value = '0';
            deleteBtn.style.display = 'none';
        }

        modal.classList.add('active');
    },

    closeProjectModal() {
        document.getElementById('projectModal').classList.remove('active');
    },

    editProject(id) {
        this.showProjectModal(id);
    },

    async saveProject() {
        const id = document.getElementById('projectId').value;
        const name = document.getElementById('projectName').value.trim();
        const description = document.getElementById('projectDescription').value.trim();
        const category_id = document.getElementById('projectCategoryId').value;

        if (!name) {
            alert('请输入项目名称');
            return;
        }

        try {
            const url = id ? `${API_BASE}/projects/${id}` : `${API_BASE}/projects`;
            const method = id ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, description, category_id })
            });

            if (response.ok) {
                this.closeProjectModal();
                await this.loadProjects(this.currentCategory);
                this.loadCategories(); // 更新统计
            } else {
                const error = await response.json();
                alert('保存失败: ' + (error.error || '未知错误'));
            }
        } catch (error) {
            console.error('保存项目失败:', error);
            alert('保存失败');
        }
    },

    async deleteProject() {
        const id = document.getElementById('projectId').value;
        if (!confirm('确定要删除这个项目吗？项目下的任务将移至默认项目"杂"。')) {
            return;
        }

        try {
            const response = await fetch(`${API_BASE}/projects/${id}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                this.closeProjectModal();
                await this.loadProjects(this.currentCategory);
                this.loadCategories();
            } else {
                const error = await response.json();
                alert('删除失败: ' + (error.error || '未知错误'));
            }
        } catch (error) {
            console.error('删除项目失败:', error);
            alert('删除失败');
        }
    },

    // ============ 项目详情 ============

    async showProjectDetail(projectId) {
        this.currentProject = projectId;
        const project = this.projects.find(p => p.id === projectId);
        const category = this.categories.find(c => c.id === this.currentCategory);
        
        document.getElementById('projectDetailTitle').textContent = project.name;
        document.getElementById('projectDetailMeta').textContent = 
            `${category.name} / ${project.description || '暂无描述'}`;
        
        document.getElementById('categoryDetailView').classList.remove('active');
        document.getElementById('projectDetailView').classList.add('active');

        await this.loadProjectTasks(projectId);
    },

    backToCategoryDetail() {
        this.currentProject = null;
        document.getElementById('projectDetailView').classList.remove('active');
        document.getElementById('categoryDetailView').classList.add('active');
    },

    async loadProjectTasks(projectId) {
        try {
            const response = await fetch(`${API_BASE}/projects/${projectId}/tasks`);
            this.tasks = await response.json();
            this.renderProjectTasks();
        } catch (error) {
            console.error('加载项目事项失败:', error);
            alert('加载项目事项失败');
        }
    },

    renderProjectTasks() {
        const list = document.getElementById('projectTasksList');
        
        if (this.tasks.length === 0) {
            list.innerHTML = '<div style="text-align:center; padding:2rem; color:#6c757d;">暂无事项</div>';
            return;
        }

        list.innerHTML = this.tasks.map(task => this.renderTaskItem(task)).join('');
    },

    // ============ 分类事项总览 ============

    async loadCategoryTasks() {
        try {
            // 加载所有项目用于筛选
            const projectsResponse = await fetch(`${API_BASE}/categories/${this.currentCategory}/projects`);
            this.allProjects = await projectsResponse.json();
            
            // 填充项目筛选下拉框
            const projectFilter = document.getElementById('projectFilter');
            projectFilter.innerHTML = '<option value="">全部项目</option>' +
                this.allProjects.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
            
            // 加载事项
            this.filterTasksByProject();
        } catch (error) {
            console.error('加载分类事项失败:', error);
            alert('加载分类事项失败');
        }
    },

    async filterTasksByProject() {
        try {
            const projectId = document.getElementById('projectFilter').value;
            const status = document.getElementById('statusFilter').value;
            const priority = document.getElementById('priorityFilter').value;
            
            let url = `${API_BASE}/categories/${this.currentCategory}/tasks`;
            const params = [];
            
            if (projectId) params.push(`project_id=${projectId}`);
            if (status) params.push(`status=${status}`);
            if (priority) params.push(`priority=${priority}`);
            
            if (params.length > 0) {
                url += '?' + params.join('&');
            }
            
            const response = await fetch(url);
            let tasks = await response.json();
            
            // 客户端过滤（因为API可能不支持所有过滤参数）
            if (projectId) {
                tasks = tasks.filter(t => t.project_id == projectId);
            }
            if (status) {
                tasks = tasks.filter(t => t.status === status);
            }
            if (priority) {
                tasks = tasks.filter(t => t.priority === priority);
            }
            
            this.renderCategoryTasks(tasks);
        } catch (error) {
            console.error('筛选事项失败:', error);
            alert('筛选事项失败');
        }
    },

    renderCategoryTasks(tasks) {
        const list = document.getElementById('categoryTasksList');
        
        if (tasks.length === 0) {
            list.innerHTML = '<div style="text-align:center; padding:2rem; color:#6c757d;">暂无事项</div>';
            return;
        }

        // 按项目分组
        const tasksByProject = {};
        tasks.forEach(task => {
            const projectName = task.project_name || '未分类';
            if (!tasksByProject[projectName]) {
                tasksByProject[projectName] = [];
            }
            tasksByProject[projectName].push(task);
        });

        let html = '';
        for (const [projectName, projectTasks] of Object.entries(tasksByProject)) {
            html += `
                <div class="task-group">
                    <div class="task-group-header">${projectName} (${projectTasks.length})</div>
                    ${projectTasks.map(task => this.renderTaskItem(task)).join('')}
                </div>
            `;
        }
        
        list.innerHTML = html;
    },

    // ============ 事项管理 ============

    renderTaskItem(task) {
        return `
            <div class="task-item priority-${task.priority}" onclick="app.editTask(${task.id})">
                <div class="task-item-header">
                    <div class="task-item-title">${task.title}</div>
                    <div class="task-item-meta">
                        <span class="task-badge priority-${task.priority}">${task.priority.toUpperCase()}</span>
                        <span class="task-badge status-${task.status}">${this.getStatusText(task.status)}</span>
                        ${task.project_name ? `<span class="task-badge" style="background:#e9ecef;color:#495057;">${task.project_name}</span>` : ''}
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
        `;
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

    async showTaskModal(taskId = null) {
        const modal = document.getElementById('taskModal');
        const title = document.getElementById('taskModalTitle');
        const deleteBtn = document.getElementById('deleteTaskBtn');

        // 加载所有分类和项目
        if (this.categories.length === 0) {
            await this.loadCategories();
        }

        // 填充分类选项
        const categorySelect = document.getElementById('taskCategory');
        categorySelect.innerHTML = '<option value="">请选择分类</option>' + 
            this.categories.map(cat => `<option value="${cat.id}">${cat.name}</option>`).join('');

        if (taskId) {
            const response = await fetch(`${API_BASE}/tasks/${taskId}`);
            const task = await response.json();
            
            title.textContent = '编辑事项';
            document.getElementById('taskId').value = task.id;
            document.getElementById('taskTitle').value = task.title;
            document.getElementById('taskDescription').value = task.description || '';
            document.getElementById('taskCategory').value = task.category_id || '';
            document.getElementById('taskPriority').value = task.priority;
            document.getElementById('taskStatus').value = task.status;
            document.getElementById('taskProgress').value = task.progress;
            document.getElementById('taskWeek').value = task.week_number || '';
            
            // 加载该分类的项目
            await this.updateProjectOptions();
            document.getElementById('taskProject').value = task.project_id;
            
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
            
            await this.updateProjectOptions();
            
            deleteBtn.style.display = 'none';
        }

        modal.classList.add('active');
    },

    async updateProjectOptions() {
        const categoryId = document.getElementById('taskCategory').value;
        const projectSelect = document.getElementById('taskProject');
        
        if (!categoryId) {
            projectSelect.innerHTML = '<option value="">请先选择分类</option>';
            projectSelect.disabled = true;
            return;
        }
        
        try {
            const response = await fetch(`${API_BASE}/categories/${categoryId}/projects`);
            const projects = await response.json();
            
            projectSelect.innerHTML = projects.map(p => 
                `<option value="${p.id}">${p.name}${p.is_default ? ' (默认)' : ''}</option>`
            ).join('');
            projectSelect.disabled = false;
            
            // 如果当前项目属于该分类，自动选择
            if (this.currentProject) {
                const project = projects.find(p => p.id === this.currentProject);
                if (project) {
                    projectSelect.value = this.currentProject;
                }
            } else {
                // 默认选择默认项目
                const defaultProject = projects.find(p => p.is_default);
                if (defaultProject) {
                    projectSelect.value = defaultProject.id;
                }
            }
        } catch (error) {
            console.error('加载项目选项失败:', error);
            projectSelect.innerHTML = '<option value="">加载失败</option>';
        }
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
        const project_id = document.getElementById('taskProject').value;
        const priority = document.getElementById('taskPriority').value;
        const status = document.getElementById('taskStatus').value;
        const progress = parseInt(document.getElementById('taskProgress').value) || 0;
        const week_number = parseInt(document.getElementById('taskWeek').value) || null;

        if (!title) {
            alert('请输入事项标题');
            return;
        }

        if (!project_id) {
            alert('请选择所属项目');
            return;
        }

        try {
            const url = id ? `${API_BASE}/tasks/${id}` : `${API_BASE}/tasks`;
            const method = id ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title, description, category_id, project_id, priority, status, progress, week_number
                })
            });

            if (response.ok) {
                this.closeTaskModal();
                
                // 刷新相应视图
                if (this.currentProject) {
                    await this.loadProjectTasks(this.currentProject);
                } else if (this.currentTab === 'tasks') {
                    await this.loadCategoryTasks();
                } else if (this.currentView === 'weekly') {
                    await this.loadWeeklyView();
                }
                
                this.loadCategories(); // 更新统计
            } else {
                const error = await response.json();
                alert('保存失败: ' + (error.error || '未知错误'));
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
                
                // 刷新相应视图
                if (this.currentProject) {
                    await this.loadProjectTasks(this.currentProject);
                } else if (this.currentTab === 'tasks') {
                    await this.loadCategoryTasks();
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
                    ${tasks.map(task => this.renderTaskItem(task)).join('')}
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
        
        // 本周进展（按分类和项目）
        markdown += `## 本周进展\n\n`;
        
        const doneByCategory = {};
        data.doneTasksByCategory.forEach(task => {
            const categoryName = task.category_name || '其他';
            if (!doneByCategory[categoryName]) {
                doneByCategory[categoryName] = {};
            }
            const projectName = task.project_name || '未分类';
            if (!doneByCategory[categoryName][projectName]) {
                doneByCategory[categoryName][projectName] = [];
            }
            doneByCategory[categoryName][projectName].push(task);
        });
        
        for (const [category, projects] of Object.entries(doneByCategory)) {
            markdown += `**${category}**:\n`;
            for (const [project, tasks] of Object.entries(projects)) {
                if (Object.keys(projects).length > 1 || project !== '杂') {
                    markdown += `  *${project}*:\n`;
                    tasks.forEach(task => {
                        markdown += `    - ${task.title}`;
                        if (task.progress < 100) {
                            markdown += ` [${task.progress}%]`;
                        }
                        markdown += '\n';
                        if (task.description) {
                            markdown += `        - ${task.description}\n`;
                        }
                    });
                } else {
                    tasks.forEach(task => {
                        markdown += `  - ${task.title}`;
                        if (task.progress < 100) {
                            markdown += ` [${task.progress}%]`;
                        }
                        markdown += '\n';
                        if (task.description) {
                            markdown += `      - ${task.description}\n`;
                        }
                    });
                }
            }
            markdown += '\n';
        }
        
        // 本周新增需求
        if (data.addedTasks.length > 0) {
            markdown += `## 本周新增需求 (Added)\n`;
            data.addedTasks.forEach(task => {
                const prefix = task.project_name && task.project_name !== '杂' 
                    ? `${task.category_name || ''}/${task.project_name}` 
                    : task.category_name || '';
                markdown += `- ${prefix ? prefix + ': ' : ''}${task.title}\n`;
            });
            markdown += '\n';
        }
        
        // 进行中
        if (data.inProgressTasks.length > 0) {
            markdown += `## 进行中 (In Progress)\n`;
            data.inProgressTasks.forEach(task => {
                markdown += `- ${task.title} [${task.progress}%]`;
                if (task.project_name && task.project_name !== '杂') {
                    markdown += ` (${task.project_name})`;
                }
                markdown += '\n';
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
                    backlogByCategory[cat] = {};
                }
                const proj = task.project_name || '未分类';
                if (!backlogByCategory[cat][proj]) {
                    backlogByCategory[cat][proj] = [];
                }
                backlogByCategory[cat][proj].push(task);
            });
            
            for (const [category, projects] of Object.entries(backlogByCategory)) {
                markdown += `**${category}**:\n`;
                for (const [project, tasks] of Object.entries(projects)) {
                    if (Object.keys(projects).length > 1 || project !== '杂') {
                        markdown += `  *${project}*:\n`;
                        tasks.forEach(task => {
                            markdown += `    - ${task.title}\n`;
                        });
                    } else {
                        tasks.forEach(task => {
                            markdown += `  - ${task.title}\n`;
                        });
                    }
                }
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
    },

    // ============ 快速添加事项 ============

    async showQuickAddModal() {
        const modal = document.getElementById('quickAddModal');
        
        // 加载所有分类
        if (this.categories.length === 0) {
            await this.loadCategories();
        }

        // 填充分类选项
        const categorySelect = document.getElementById('quickTaskCategory');
        categorySelect.innerHTML = '<option value="">请选择分类</option>' + 
            this.categories.map(cat => `<option value="${cat.id}">${cat.name}</option>`).join('');

        // 清空表单
        document.getElementById('quickTaskTitle').value = '';
        document.getElementById('quickTaskDescription').value = '';
        document.getElementById('quickTaskStatus').value = 'todo';
        document.getElementById('quickTaskWeek').value = this.currentWeek || '';
        
        // 重置优先级按钮
        document.querySelectorAll('.priority-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.priority === 'p2') {
                btn.classList.add('active');
            }
        });
        this.quickAddPriority = 'p2';
        
        // 重置项目下拉框
        const projectSelect = document.getElementById('quickTaskProject');
        projectSelect.innerHTML = '<option value="">请先选择分类</option>';
        projectSelect.disabled = true;

        // 智能默认值：根据当前页面上下文
        if (this.currentCategory) {
            categorySelect.value = this.currentCategory;
            await this.updateQuickProjectOptions();
            
            // 如果在项目详情页，自动选中该项目
            if (this.currentProject) {
                projectSelect.value = this.currentProject;
            }
        }

        modal.classList.add('active');
    },

    closeQuickAddModal() {
        document.getElementById('quickAddModal').classList.remove('active');
    },

    selectQuickPriority(priority) {
        this.quickAddPriority = priority;
        document.querySelectorAll('.priority-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.priority === priority) {
                btn.classList.add('active');
            }
        });
    },

    async updateQuickProjectOptions() {
        const categoryId = document.getElementById('quickTaskCategory').value;
        const projectSelect = document.getElementById('quickTaskProject');
        
        if (!categoryId) {
            projectSelect.innerHTML = '<option value="">请先选择分类</option>';
            projectSelect.disabled = true;
            return;
        }
        
        try {
            const response = await fetch(`${API_BASE}/categories/${categoryId}/projects`);
            const projects = await response.json();
            
            projectSelect.innerHTML = projects.map(p => 
                `<option value="${p.id}">${p.name}${p.is_default ? ' (默认)' : ''}</option>`
            ).join('');
            projectSelect.disabled = false;
            
            // 自动选中默认项目
            const defaultProject = projects.find(p => p.is_default);
            if (defaultProject) {
                projectSelect.value = defaultProject.id;
            }
        } catch (error) {
            console.error('加载项目选项失败:', error);
            projectSelect.innerHTML = '<option value="">加载失败</option>';
        }
    },

    async saveQuickTask() {
        const title = document.getElementById('quickTaskTitle').value.trim();
        const description = document.getElementById('quickTaskDescription').value.trim();
        const category_id = document.getElementById('quickTaskCategory').value || null;
        const project_id = document.getElementById('quickTaskProject').value;
        const priority = this.quickAddPriority;
        const status = document.getElementById('quickTaskStatus').value;
        const week_number = parseInt(document.getElementById('quickTaskWeek').value) || null;

        // 表单验证
        if (!title) {
            alert('请输入事项标题');
            document.getElementById('quickTaskTitle').focus();
            return;
        }

        if (!category_id) {
            alert('请选择分类');
            return;
        }

        if (!project_id) {
            alert('请选择项目');
            return;
        }

        try {
            const response = await fetch(`${API_BASE}/tasks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title,
                    description,
                    category_id,
                    project_id,
                    priority,
                    status,
                    progress: 0,
                    week_number
                })
            });

            if (response.ok) {
                // 显示成功提示
                this.showToast('事项创建成功！', 'success');
                
                // 关闭模态框
                this.closeQuickAddModal();
                
                // 刷新相关视图
                if (this.currentView === 'categories' && !this.currentCategory) {
                    this.loadCategories();
                } else if (this.currentCategory) {
                    if (this.currentProject && project_id == this.currentProject) {
                        await this.loadProjectTasks(this.currentProject);
                    } else if (this.currentTab === 'tasks' && category_id == this.currentCategory) {
                        await this.loadCategoryTasks();
                    } else if (this.currentTab === 'projects') {
                        await this.loadProjects(this.currentCategory);
                    }
                } else if (this.currentView === 'weekly') {
                    await this.loadWeeklyView();
                }
                
                this.loadCategories(); // 更新统计
            } else {
                const error = await response.json();
                alert('创建失败: ' + (error.error || '未知错误'));
            }
        } catch (error) {
            console.error('创建事项失败:', error);
            alert('创建失败，请检查网络连接');
        }
    },

    // 显示提示消息
    showToast(message, type = 'info') {
        // 创建 toast 元素
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        
        // 添加样式（如果还没有）
        if (!document.getElementById('toast-styles')) {
            const style = document.createElement('style');
            style.id = 'toast-styles';
            style.textContent = `
                .toast {
                    position: fixed;
                    top: 80px;
                    right: 20px;
                    padding: 1rem 1.5rem;
                    background-color: white;
                    border-radius: 6px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                    z-index: 2000;
                    animation: slideIn 0.3s ease-out;
                    font-size: 0.9375rem;
                    font-weight: 500;
                }
                .toast-success {
                    border-left: 4px solid #27ae60;
                    color: #27ae60;
                }
                .toast-error {
                    border-left: 4px solid #e74c3c;
                    color: #e74c3c;
                }
                .toast-info {
                    border-left: 4px solid #3498db;
                    color: #3498db;
                }
                @keyframes slideIn {
                    from {
                        transform: translateX(400px);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
                @keyframes slideOut {
                    from {
                        transform: translateX(0);
                        opacity: 1;
                    }
                    to {
                        transform: translateX(400px);
                        opacity: 0;
                    }
                }
            `;
            document.head.appendChild(style);
        }
        
        document.body.appendChild(toast);
        
        // 3秒后移除
        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => {
                document.body.removeChild(toast);
            }, 300);
        }, 3000);
    }
};

// 页面加载完成后初始化应用
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
