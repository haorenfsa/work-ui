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
    quickAddPriority: 'p2',
    currentDbName: null,
    weeklyTasks: [],
    weekFilters: {
        projectId: '',
        status: ''
    },
    
    // 初始化应用
    async init() {
        this.setupNavigation();
        await this.loadCurrentDatabase();
        await this.loadCategories();
        
        // 从 URL 读取参数
        const params = this.parseUrlParams();
        
        // 设置视图和周次
        this.currentWeek = params.week || this.getCurrentWeekNumber();
        this.setupWeekOptions();
        
        // 应用视图
        if (params.view === 'weekly') {
            this.weekFilters.projectId = params.project || '';
            this.weekFilters.status = params.status || '';
            this.showView('weekly');
        } else if (params.view === 'report') {
            this.showView('report');
        } else {
            // 分类管理视图
            this.showView('categories');
            
            // 如果有分类参数，显示分类详情
            if (params.category) {
                this.currentTab = params.tab || 'projects';
                await this.showCategoryDetail(params.category);
                
                // 如果有项目参数，显示项目详情
                if (params.project) {
                    await this.showProjectDetail(parseInt(params.project));
                }
            }
        }
    },

    // 解析 URL 参数
    parseUrlParams() {
        const urlParams = new URLSearchParams(window.location.search);
        return {
            view: urlParams.get('view'),
            week: urlParams.get('week') ? parseInt(urlParams.get('week')) : null,
            project: urlParams.get('project') || '',
            status: urlParams.get('status') || '',
            // 分类管理相关参数
            category: urlParams.get('category') ? parseInt(urlParams.get('category')) : null,
            tab: urlParams.get('tab') || 'projects'
        };
    },

    // 更新 URL（不刷新页面）
    updateUrl() {
        const params = new URLSearchParams();
        
        // 分类管理视图参数
        if (this.currentView === 'categories') {
            if (this.currentCategory) {
                params.set('category', this.currentCategory);
                
                // 项目详情
                if (this.currentProject) {
                    params.set('project', this.currentProject);
                } 
                // 分类详情的 tab
                else if (this.currentTab !== 'projects') {
                    params.set('tab', this.currentTab);
                }
            }
            // 如果是分类列表视图，不添加任何参数
        }
        // 每周视图参数
        else if (this.currentView === 'weekly') {
            params.set('view', 'weekly');
            params.set('week', this.currentWeek);
            
            if (this.weekFilters.projectId) {
                params.set('project', this.weekFilters.projectId);
            }
            
            if (this.weekFilters.status) {
                params.set('status', this.weekFilters.status);
            }
        }
        // 其他视图
        else {
            params.set('view', this.currentView);
        }
        
        // 更新 URL，不刷新页面
        const queryString = params.toString();
        const newUrl = queryString ? `${window.location.pathname}?${queryString}` : window.location.pathname;
        window.history.pushState({ path: newUrl }, '', newUrl);
    },

    // 设置导航
    setupNavigation() {
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const view = e.target.dataset.view;
                this.showView(view);
            });
        });
        
        // 监听浏览器前进/后退
        window.addEventListener('popstate', async () => {
            const params = this.parseUrlParams();
            
            if (params.view === 'weekly') {
                this.currentWeek = params.week || this.getCurrentWeekNumber();
                this.weekFilters.projectId = params.project || '';
                this.weekFilters.status = params.status || '';
                this.showView('weekly');
            } else if (params.view === 'report') {
                this.showView('report');
            } else {
                // 分类管理视图
                this.showView('categories');
                
                if (params.category) {
                    this.currentTab = params.tab || 'projects';
                    await this.showCategoryDetail(params.category);
                    
                    if (params.project) {
                        await this.showProjectDetail(parseInt(params.project));
                    }
                }
            }
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
        
        // 更新 URL
        this.updateUrl();
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
        
        // 更新 URL
        this.updateUrl();
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
                this.showToast(id ? '分类更新成功！' : '分类创建成功！', 'success');
                this.closeCategoryModal();
                await this.loadCategories();
                
                // 如果当前在分类详情页，刷新该分类
                if (this.currentCategory) {
                    await this.showCategoryDetail(this.currentCategory);
                }
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
                this.showToast('分类删除成功！', 'success');
                this.closeCategoryModal();
                
                // 如果删除的是当前分类，返回分类列表
                if (this.currentCategory == id) {
                    this.currentCategory = null;
                    this.currentProject = null;
                    document.getElementById('categoryDetailView').classList.remove('active');
                    document.getElementById('projectDetailView').classList.remove('active');
                    document.getElementById('categoriesView').classList.add('active');
                }
                
                await this.loadCategories();
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
        
        // 更新 URL
        this.updateUrl();
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
                this.showToast(id ? '项目更新成功！' : '项目创建成功！', 'success');
                this.closeProjectModal();
                
                // 刷新当前视图的项目列表
                if (this.currentCategory) {
                    await this.loadProjects(this.currentCategory);
                }
                
                // 如果在项目详情页且是编辑该项目，刷新项目任务
                if (id && this.currentProject == id) {
                    await this.loadProjectTasks(this.currentProject);
                }
                
                // 更新分类统计
                await this.loadCategories();
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
                this.showToast('项目删除成功！', 'success');
                this.closeProjectModal();
                
                // 如果删除的是当前项目，返回分类详情页
                if (this.currentProject == id) {
                    this.currentProject = null;
                    document.getElementById('projectDetailView').classList.remove('active');
                    document.getElementById('categoryDetailView').classList.add('active');
                }
                
                // 刷新项目列表和统计
                if (this.currentCategory) {
                    await this.loadProjects(this.currentCategory);
                }
                await this.loadCategories();
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
        
        // 更新 URL
        this.updateUrl();
    },

    backToCategoryDetail() {
        this.currentProject = null;
        document.getElementById('projectDetailView').classList.remove('active');
        document.getElementById('categoryDetailView').classList.add('active');
        
        // 更新 URL
        this.updateUrl();
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
            <div class="task-item priority-${task.priority}" onclick="app.showQuickAddModal(${task.id})">
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

    // 旧的 showTaskModal 和相关函数已删除，统一使用 showQuickAddModal

    // ============ 每周视图 ============

    getCurrentWeekNumber() {
        const now = new Date();
        const start = new Date(now.getFullYear(), 0, 1);
        
        // 获取1月1日是周几 (0=周日, 1=周一, ..., 6=周六)
        const startDay = start.getDay();
        
        // 计算从年初到现在经过的天数
        const diff = now - start;
        const daysPassed = Math.floor(diff / (1000 * 60 * 60 * 24));
        
        // 调整：如果1月1日不是周一，需要加上偏移量
        // 例如：如果1月1日是周三(3)，那么第一周从周一开始应该是在1月1日之前2天
        // 使用周一作为一周的开始（周一=1，周日=0，需要调整为周一=0）
        const adjustedStartDay = startDay === 0 ? 6 : startDay - 1; // 周日变成6，周一变成0
        
        // 计算周数：(已过天数 + 开始日偏移) / 7，向上取整
        return Math.ceil((daysPassed + adjustedStartDay + 1) / 7);
    },

    // 获取下一周周次
    getNextWeekNumber() {
        return this.getCurrentWeekNumber() + 1;
    },

    // 获取默认周次：周五、周六、周日时返回下一周
    getDefaultWeekNumber() {
        const now = new Date();
        const dayOfWeek = now.getDay(); // 0=周日, 1=周一, ..., 6=周六
        const currentWeek = this.getCurrentWeekNumber();
        
        // 如果是周五(5)、周六(6)、周日(0)，返回下一周
        if (dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6) {
            return currentWeek + 1;
        }
        
        return currentWeek;
    },

    async loadWeeklyView() {
        document.getElementById('weekTitle').textContent = `WK${this.currentWeek}`;
        
        try {
            const response = await fetch(`${API_BASE}/tasks/week/${this.currentWeek}`);
            const tasks = await response.json();
            this.weeklyTasks = tasks;
            
            // 加载所有项目用于筛选
            await this.loadWeeklyProjects();
            
            // 恢复筛选状态到 UI
            document.getElementById('weekProjectFilter').value = this.weekFilters.projectId;
            document.getElementById('weekStatusFilter').value = this.weekFilters.status;
            
            // 应用筛选并渲染
            this.applyWeekFilters();
        } catch (error) {
            console.error('加载每周视图失败:', error);
            alert('加载失败');
        }
    },
    
    async loadWeeklyProjects() {
        try {
            const response = await fetch(`${API_BASE}/categories`);
            const categories = await response.json();
            
            // 收集所有项目
            const projectsMap = new Map();
            
            for (const category of categories) {
                const projectsResponse = await fetch(`${API_BASE}/categories/${category.id}/projects`);
                const projects = await projectsResponse.json();
                
                projects.forEach(project => {
                    projectsMap.set(project.id, {
                        id: project.id,
                        name: project.name,
                        categoryName: category.name
                    });
                });
            }
            
            // 填充项目筛选下拉框
            const projectFilter = document.getElementById('weekProjectFilter');
            projectFilter.innerHTML = '<option value="">📁 全部项目</option>' +
                Array.from(projectsMap.values()).map(p => 
                    `<option value="${p.id}">${p.categoryName} / ${p.name}</option>`
                ).join('');
        } catch (error) {
            console.error('加载项目列表失败:', error);
        }
    },
    
    applyWeekFilters() {
        const projectId = document.getElementById('weekProjectFilter').value;
        const status = document.getElementById('weekStatusFilter').value;
        
        // 更新筛选状态
        this.weekFilters.projectId = projectId;
        this.weekFilters.status = status;
        
        // 筛选任务
        let filteredTasks = [...this.weeklyTasks];
        
        if (projectId) {
            filteredTasks = filteredTasks.filter(t => t.project_id == projectId);
        }
        
        if (status) {
            filteredTasks = filteredTasks.filter(t => t.status === status);
        }
        
        // 更新UI状态
        this.updateWeekFilterUI(projectId, status, filteredTasks.length);
        
        // 渲染结果
        this.renderWeekStats(filteredTasks);
        this.renderWeekTasks(filteredTasks);
        
        // 更新 URL
        if (this.currentView === 'weekly') {
            this.updateUrl();
        }
    },
    
    updateWeekFilterUI(projectId, status, resultCount) {
        const projectFilter = document.getElementById('weekProjectFilter');
        const statusFilter = document.getElementById('weekStatusFilter');
        const clearBtn = document.getElementById('clearWeekFiltersBtn');
        const filterStatus = document.getElementById('weekFilterStatus');
        const filterStatusText = document.getElementById('weekFilterStatusText');
        
        const hasFilter = projectId || status;
        
        // 更新下拉框样式
        if (projectId) {
            projectFilter.classList.add('filter-active');
        } else {
            projectFilter.classList.remove('filter-active');
        }
        
        if (status) {
            statusFilter.classList.add('filter-active');
        } else {
            statusFilter.classList.remove('filter-active');
        }
        
        // 显示/隐藏清除按钮
        clearBtn.style.display = hasFilter ? 'inline-block' : 'none';
        
        // 显示/隐藏筛选状态
        if (hasFilter) {
            filterStatus.style.display = 'flex';
            
            const projectName = projectId ? 
                projectFilter.options[projectFilter.selectedIndex].text.replace('📁 ', '') : '';
            const statusName = status ? 
                statusFilter.options[statusFilter.selectedIndex].text.replace(/^[^\s]+\s/, '') : '';
            
            let statusText = '当前筛选: ';
            if (projectName && statusName) {
                statusText += `项目「${projectName}」+ 状态「${statusName}」`;
            } else if (projectName) {
                statusText += `项目「${projectName}」`;
            } else if (statusName) {
                statusText += `状态「${statusName}」`;
            }
            statusText += ` | 共找到 ${resultCount} 个事项`;
            
            filterStatusText.textContent = statusText;
        } else {
            filterStatus.style.display = 'none';
        }
    },
    
    clearWeekFilters() {
        document.getElementById('weekProjectFilter').value = '';
        document.getElementById('weekStatusFilter').value = '';
        this.weekFilters.projectId = '';
        this.weekFilters.status = '';
        this.applyWeekFilters();
        
        // 更新 URL
        if (this.currentView === 'weekly') {
            this.updateUrl();
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
        const container = document.getElementById('weekTasks');
        
        if (tasks.length === 0) {
            container.innerHTML = `
                <div class="week-empty-state">
                    <div class="empty-icon">🔍</div>
                    <h3>未找到符合条件的事项</h3>
                    <p>尝试调整筛选条件或清除筛选重新查看</p>
                    <button class="btn btn-secondary" onclick="app.clearWeekFilters()">清除筛选</button>
                </div>
            `;
            return;
        }
        
        const p0Tasks = tasks.filter(t => t.priority === 'p0');
        const p1Tasks = tasks.filter(t => t.priority === 'p1');
        const p2Tasks = tasks.filter(t => t.priority === 'p2');

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
        
        // 更新 URL
        if (this.currentView === 'weekly') {
            this.updateUrl();
        }
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

    async showQuickAddModal(taskId = null) {
        const modal = document.getElementById('quickAddModal');
        const title = document.getElementById('quickAddModalTitle');
        const deleteBtn = document.getElementById('quickDeleteTaskBtn');
        const saveBtn = document.getElementById('quickSaveTaskBtn');
        
        // 加载所有分类
        if (this.categories.length === 0) {
            await this.loadCategories();
        }

        // 填充分类选项
        const categorySelect = document.getElementById('quickTaskCategory');
        categorySelect.innerHTML = '<option value="">请选择分类</option>' + 
            this.categories.map(cat => `<option value="${cat.id}">${cat.name}</option>`).join('');

        if (taskId) {
            // 编辑模式
            const response = await fetch(`${API_BASE}/tasks/${taskId}`);
            const task = await response.json();
            
            title.textContent = '编辑事项';
            saveBtn.textContent = '保存';
            document.getElementById('quickTaskId').value = task.id;
            document.getElementById('quickTaskTitle').value = task.title;
            document.getElementById('quickTaskDescription').value = task.description || '';
            document.getElementById('quickTaskCategory').value = task.category_id || '';
            document.getElementById('quickTaskStatus').value = task.status;
            document.getElementById('quickTaskProgress').value = task.progress;
            document.getElementById('quickTaskWeek').value = task.week_number || '';
            
            // 设置优先级
            this.quickAddPriority = task.priority;
            document.querySelectorAll('.priority-btn').forEach(btn => {
                btn.classList.remove('active');
                if (btn.dataset.priority === task.priority) {
                    btn.classList.add('active');
                }
            });
            
            // 加载该分类的项目
            await this.updateQuickProjectOptions();
            document.getElementById('quickTaskProject').value = task.project_id;
            
            deleteBtn.style.display = 'inline-block';
        } else {
            // 新建模式
            title.textContent = '快速添加事项';
            saveBtn.textContent = '创建事项';
            document.getElementById('quickTaskId').value = '';
            document.getElementById('quickTaskTitle').value = '';
            document.getElementById('quickTaskDescription').value = '';
            document.getElementById('quickTaskStatus').value = 'todo';
            document.getElementById('quickTaskProgress').value = '0';
            document.getElementById('quickTaskWeek').value = this.getDefaultWeekNumber() || '';
            
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
            
            deleteBtn.style.display = 'none';
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
        const id = document.getElementById('quickTaskId').value;
        const title = document.getElementById('quickTaskTitle').value.trim();
        const description = document.getElementById('quickTaskDescription').value.trim();
        const category_id = document.getElementById('quickTaskCategory').value || null;
        const project_id = document.getElementById('quickTaskProject').value;
        const priority = this.quickAddPriority;
        const status = document.getElementById('quickTaskStatus').value;
        const progress = parseInt(document.getElementById('quickTaskProgress').value) || 0;
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
            const url = id ? `${API_BASE}/tasks/${id}` : `${API_BASE}/tasks`;
            const method = id ? 'PUT' : 'POST';
            
            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title,
                    description,
                    category_id,
                    project_id,
                    priority,
                    status,
                    progress,
                    week_number
                })
            });

            if (response.ok) {
                // 显示成功提示
                const message = id ? '事项更新成功！' : '事项创建成功！';
                this.showToast(message, 'success');
                
                // 关闭模态框
                this.closeQuickAddModal();
                
                // 刷新所有相关视图
                if (this.currentView === 'categories') {
                    // 更新分类统计
                    await this.loadCategories();
                    
                    if (this.currentCategory) {
                        // 如果在项目详情页
                        if (this.currentProject) {
                            await this.loadProjectTasks(this.currentProject);
                            // 同时刷新项目列表（更新统计）
                            await this.loadProjects(this.currentCategory);
                        }
                        // 如果在分类的任务tab
                        else if (this.currentTab === 'tasks') {
                            await this.loadCategoryTasks();
                            // 同时刷新项目列表（更新统计）
                            await this.loadProjects(this.currentCategory);
                        }
                        // 如果在分类的项目tab
                        else {
                            await this.loadProjects(this.currentCategory);
                        }
                    }
                } else if (this.currentView === 'weekly') {
                    // 刷新每周视图
                    await this.loadWeeklyView();
                    // 同时更新分类统计（侧边栏可能显示）
                    await this.loadCategories();
                } else if (this.currentView === 'report') {
                    // 如果在报告视图，也刷新数据
                    await this.loadWeeklyReport();
                }
            } else {
                const error = await response.json();
                alert('保存失败: ' + (error.error || '未知错误'));
            }
        } catch (error) {
            console.error('保存事项失败:', error);
            alert('保存失败，请检查网络连接');
        }
    },

    async deleteQuickTask() {
        const id = document.getElementById('quickTaskId').value;
        if (!confirm('确定要删除这个事项吗？')) {
            return;
        }

        try {
            const response = await fetch(`${API_BASE}/tasks/${id}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                this.showToast('事项删除成功！', 'success');
                this.closeQuickAddModal();
                
                // 刷新所有相关视图
                if (this.currentView === 'categories') {
                    // 更新分类统计
                    await this.loadCategories();
                    
                    if (this.currentCategory) {
                        // 如果在项目详情页
                        if (this.currentProject) {
                            await this.loadProjectTasks(this.currentProject);
                            // 同时刷新项目列表（更新统计）
                            await this.loadProjects(this.currentCategory);
                        }
                        // 如果在分类的任务tab
                        else if (this.currentTab === 'tasks') {
                            await this.loadCategoryTasks();
                            // 同时刷新项目列表（更新统计）
                            await this.loadProjects(this.currentCategory);
                        }
                        // 如果在分类的项目tab
                        else {
                            await this.loadProjects(this.currentCategory);
                        }
                    }
                } else if (this.currentView === 'weekly') {
                    // 刷新每周视图
                    await this.loadWeeklyView();
                    // 同时更新分类统计
                    await this.loadCategories();
                } else if (this.currentView === 'report') {
                    // 如果在报告视图，也刷新数据
                    await this.loadWeeklyReport();
                }
            } else {
                alert('删除失败');
            }
        } catch (error) {
            console.error('删除事项失败:', error);
            alert('删除失败');
        }
    },

    // ============ 未完成事项批量移动 ============
    
    async moveUnfinishedToNextWeek() {
        const nextWeek = this.getNextWeekNumber();
        
        try {
            // 先获取未完成事项数量
            const countResponse = await fetch(`${API_BASE}/tasks/unfinished/count`);
            const { count } = await countResponse.json();
            
            if (count === 0) {
                alert('没有未完成的事项');
                return;
            }
            
            // 确认对话框
            if (!confirm(`将 ${count} 个未完成的事项移动到 WK${nextWeek}？\n\n包括状态为「待办」、「进行中」和「Backlog」的事项。`)) {
                return;
            }
            
            // 执行批量更新
            const updateResponse = await fetch(`${API_BASE}/tasks/unfinished/move-to-week`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ weekNumber: nextWeek })
            });
            
            if (updateResponse.ok) {
                const result = await updateResponse.json();
                this.showToast(`成功移动 ${result.updated} 个事项到 WK${nextWeek}！`, 'success');
                
                // 刷新当前视图
                if (this.currentView === 'categories') {
                    await this.loadCategories();
                    if (this.currentCategory) {
                        if (this.currentProject) {
                            await this.loadProjectTasks(this.currentProject);
                            await this.loadProjects(this.currentCategory);
                        } else if (this.currentTab === 'tasks') {
                            await this.loadCategoryTasks();
                            await this.loadProjects(this.currentCategory);
                        } else {
                            await this.loadProjects(this.currentCategory);
                        }
                    }
                } else if (this.currentView === 'weekly') {
                    await this.loadWeeklyView();
                    await this.loadCategories();
                } else if (this.currentView === 'report') {
                    await this.loadWeeklyReport();
                }
            } else {
                const error = await updateResponse.json();
                alert('移动失败: ' + (error.error || '未知错误'));
            }
        } catch (error) {
            console.error('移动未完成事项失败:', error);
            alert('移动失败，请检查网络连接');
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
    },

    // ============ 数据库管理 ============
    
    // 加载当前数据库信息
    async loadCurrentDatabase() {
        try {
            const response = await fetch(`${API_BASE}/databases/current`);
            const dbInfo = await response.json();
            this.currentDbName = dbInfo.name;
            document.getElementById('currentDbName').textContent = 
                dbInfo.displayName || dbInfo.name;
        } catch (error) {
            console.error('加载数据库信息失败:', error);
        }
    },
    
    async showDatabaseModal() {
        const modal = document.getElementById('databaseModal');
        await this.loadDatabaseList();
        modal.classList.add('active');
    },
    
    closeDatabaseModal() {
        document.getElementById('databaseModal').classList.remove('active');
        this.hideCreateDbForm();
    },
    
    async loadDatabaseList() {
        try {
            const response = await fetch(`${API_BASE}/databases`);
            const databases = await response.json();
            
            this.renderCurrentDbInfo(databases.find(db => db.isCurrent));
            this.renderDatabaseList(databases);
        } catch (error) {
            console.error('加载数据库列表失败:', error);
            alert('加载数据库列表失败');
        }
    },
    
    renderCurrentDbInfo(currentDb) {
        const container = document.getElementById('currentDbInfo');
        if (!currentDb) {
            container.innerHTML = '<p>无法获取当前数据库信息</p>';
            return;
        }
        
        container.innerHTML = `
            <div class="current-db-card">
                <div class="db-card-header">
                    <h4>${currentDb.displayName}</h4>
                    <span class="current-badge">当前</span>
                </div>
                <p class="db-description">${currentDb.description || '暂无描述'}</p>
                <div class="db-stats">
                    <span>${currentDb.stats.categories} 个分类</span>
                    <span>${currentDb.stats.projects} 个项目</span>
                    <span>${currentDb.stats.tasks} 个事项</span>
                </div>
                <div class="db-meta">
                    <small>创建时间: ${new Date(currentDb.createdAt).toLocaleString('zh-CN')}</small>
                    <small>最后使用: ${new Date(currentDb.lastUsed).toLocaleString('zh-CN')}</small>
                </div>
            </div>
        `;
    },
    
    renderDatabaseList(databases) {
        const container = document.getElementById('databaseList');
        
        if (databases.length === 0) {
            container.innerHTML = '<p class="empty-message">暂无其他数据库</p>';
            return;
        }
        
        container.innerHTML = databases.map(db => `
            <div class="db-card ${db.isCurrent ? 'current' : ''}">
                <div class="db-card-header">
                    <div>
                        <h5>${db.displayName}</h5>
                        <small class="db-filename">${db.name}</small>
                    </div>
                    ${db.isCurrent ? '<span class="current-badge">当前</span>' : ''}
                </div>
                
                <p class="db-description">${db.description || '暂无描述'}</p>
                
                <div class="db-stats">
                    <span>📁 ${db.stats.categories} 分类</span>
                    <span>📊 ${db.stats.projects} 项目</span>
                    <span>✅ ${db.stats.tasks} 事项</span>
                </div>
                
                <div class="db-meta">
                    <small>最后使用: ${this.formatRelativeTime(db.lastUsed)}</small>
                </div>
                
                <div class="db-actions">
                    ${!db.isCurrent ? `
                        <button class="btn btn-primary btn-sm" 
                                onclick="app.switchDatabase('${db.name}')">
                            切换
                        </button>
                    ` : ''}
                    <button class="btn btn-secondary btn-sm" 
                            onclick="app.renameDatabase('${db.name}')">
                        重命名
                    </button>
                    ${!db.isCurrent ? `
                        <button class="btn btn-danger btn-sm" 
                                onclick="app.deleteDatabase('${db.name}')">
                            删除
                        </button>
                    ` : ''}
                </div>
            </div>
        `).join('');
    },
    
    formatRelativeTime(dateStr) {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        if (diffMins < 1) return '刚刚';
        if (diffMins < 60) return `${diffMins} 分钟前`;
        if (diffHours < 24) return `${diffHours} 小时前`;
        if (diffDays < 7) return `${diffDays} 天前`;
        
        return date.toLocaleDateString('zh-CN');
    },
    
    async switchDatabase(dbName) {
        if (!confirm(`确定要切换到数据库 "${dbName}" 吗？`)) {
            return;
        }
        
        try {
            const response = await fetch(`${API_BASE}/databases/switch`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dbName })
            });
            
            if (response.ok) {
                this.showToast('数据库切换成功！', 'success');
                this.closeDatabaseModal();
                
                // 刷新页面以加载新数据库的数据
                setTimeout(() => {
                    window.location.reload();
                }, 500);
            } else {
                const error = await response.json();
                alert('切换失败: ' + (error.error || '未知错误'));
            }
        } catch (error) {
            console.error('切换数据库失败:', error);
            alert('切换失败');
        }
    },
    
    showCreateDbForm() {
        document.getElementById('createDbForm').style.display = 'block';
        document.getElementById('newDbName').focus();
    },
    
    hideCreateDbForm() {
        document.getElementById('createDbForm').style.display = 'none';
        document.getElementById('newDbName').value = '';
        document.getElementById('newDbDisplayName').value = '';
        document.getElementById('newDbDescription').value = '';
    },
    
    async createDatabase() {
        const dbName = document.getElementById('newDbName').value.trim();
        const displayName = document.getElementById('newDbDisplayName').value.trim();
        const description = document.getElementById('newDbDescription').value.trim();
        
        // 验证
        if (!dbName) {
            alert('请输入数据库文件名');
            return;
        }
        
        if (!/^[a-zA-Z0-9_-]+\.db$/.test(dbName)) {
            alert('文件名格式不正确，请使用格式: name.db\n只能包含字母、数字、下划线和连字符');
            return;
        }
        
        if (!displayName) {
            alert('请输入显示名称');
            return;
        }
        
        try {
            const response = await fetch(`${API_BASE}/databases`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dbName, displayName, description })
            });
            
            if (response.ok) {
                this.showToast('数据库创建成功！', 'success');
                this.hideCreateDbForm();
                
                // 刷新页面以加载新数据库
                setTimeout(() => {
                    window.location.reload();
                }, 500);
            } else {
                const error = await response.json();
                alert('创建失败: ' + (error.error || '未知错误'));
            }
        } catch (error) {
            console.error('创建数据库失败:', error);
            alert('创建失败');
        }
    },
    
    async renameDatabase(dbName) {
        const newDisplayName = prompt('请输入新的显示名称:');
        if (!newDisplayName || !newDisplayName.trim()) {
            return;
        }
        
        const newDescription = prompt('请输入新的描述（可选）:');
        
        try {
            const response = await fetch(`${API_BASE}/databases/${dbName}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    displayName: newDisplayName.trim(), 
                    description: newDescription?.trim() 
                })
            });
            
            if (response.ok) {
                this.showToast('重命名成功！', 'success');
                await this.loadDatabaseList();
                
                // 如果重命名的是当前数据库，更新导航栏显示
                if (dbName === this.currentDbName) {
                    await this.loadCurrentDatabase();
                }
            } else {
                const error = await response.json();
                alert('重命名失败: ' + (error.error || '未知错误'));
            }
        } catch (error) {
            console.error('重命名失败:', error);
            alert('重命名失败');
        }
    },
    
    async deleteDatabase(dbName) {
        if (!confirm(`确定要删除数据库 "${dbName}" 吗？\n\n此操作不可恢复！`)) {
            return;
        }
        
        // 二次确认
        const confirmText = prompt('请输入数据库文件名以确认删除:');
        if (confirmText !== dbName) {
            alert('文件名不匹配，取消删除');
            return;
        }
        
        try {
            const response = await fetch(`${API_BASE}/databases/${dbName}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                this.showToast('数据库已删除', 'success');
                await this.loadDatabaseList();
            } else {
                const error = await response.json();
                alert('删除失败: ' + (error.error || '未知错误'));
            }
        } catch (error) {
            console.error('删除失败:', error);
            alert('删除失败');
        }
    }
};

// 页面加载完成后初始化应用
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
