# 项目管理系统增量设计 v0.7.0

## 新增功能：周次数据结构优化 - 支持跨年管理

### 功能概述
将周次存储从单一 `week_number` (TEXT) 字段改为 `year` (INTEGER) + `week` (INTEGER) 两个字段，支持跨年周次管理。前端显示格式统一为 `2026WK1` 格式，便于用户识别。

### 当前问题
1. **数据类型不匹配**: 数据库中 `week_number` 定义为 INTEGER，但前端使用字符串 `2026WK1`
2. **跨年处理困难**: 单一数字无法表达年份信息，跨年计算复杂
3. **查询效率低**: 字符串比较和范围查询性能差
4. **排序问题**: 字符串排序无法正确处理跨年周次（如 `2025WK52` vs `2026WK1`）

### 设计目标
1. ✅ **正确的数据类型**: 年份和周次都用整数存储
2. ✅ **跨年支持**: 可以轻松查询和比较跨年周次
3. ✅ **高效查询**: 支持索引和范围查询
4. ✅ **统一显示**: 前端统一使用 `2026WK1` 格式
5. ✅ **向后兼容**: 平滑迁移现有数据

---

## 数据库设计

### 1. 表结构变更

#### tasks 表修改

**变更前**:
```sql
CREATE TABLE tasks (
    -- ... 其他字段 ...
    week_number INTEGER,  -- 或 TEXT，存在不一致
    -- ... 其他字段 ...
);
```

**变更后**:
```sql
CREATE TABLE tasks (
    -- ... 其他字段 ...
    year INTEGER,         -- 年份，如 2026
    week INTEGER,         -- 周次，如 1-53
    -- ... 其他字段 ...
);
```

#### weekly_logs 表修改

**变更前**:
```sql
CREATE TABLE weekly_logs (
    week_number INTEGER NOT NULL,
    -- ... 其他字段 ...
);
```

**变更后**:
```sql
CREATE TABLE weekly_logs (
    year INTEGER NOT NULL,
    week INTEGER NOT NULL,
    -- ... 其他字段 ...
);
```

### 2. 索引优化

```sql
-- 组合索引：支持按年份和周次快速查询
CREATE INDEX idx_tasks_year_week ON tasks(year, week);
CREATE INDEX idx_weekly_logs_year_week ON weekly_logs(year, week);

-- 单独索引（如果需要按年份统计）
CREATE INDEX idx_tasks_year ON tasks(year);
```

**优势**:
- 范围查询更高效：`WHERE year = 2026 AND week BETWEEN 1 AND 10`
- 排序性能更好：`ORDER BY year DESC, week DESC`
- 支持年度统计：`GROUP BY year`

---

## 前后端接口设计

### 1. 数据传输格式

#### 前端到后端（创建/更新事项）

**请求体**:
```json
{
    "title": "完成周报",
    "year": 2026,
    "week": 1,
    "priority": "p1",
    "status": "todo"
}
```

**注意**: 前端传递的是分离的 `year` 和 `week` 字段

#### 后端到前端（查询事项）

**响应**:
```json
{
    "id": 123,
    "title": "完成周报",
    "year": 2026,
    "week": 1,
    "priority": "p1",
    "status": "todo"
}
```

**前端格式化显示**:
```javascript
// 在前端组合显示
const displayWeek = task.year && task.week ? `${task.year}WK${task.week}` : '';
```

---

### 2. API 接口调整

#### 2.1 获取指定周的事项

**变更前**:
```
GET /api/tasks/week/:weekNumber
// 如: GET /api/tasks/week/2026WK1
```

**变更后**:
```
GET /api/tasks/week/:year/:week
// 如: GET /api/tasks/week/2026/1
```

**后端实现**:
```javascript
app.get('/api/tasks/week/:year/:week', (req, res) => {
    try {
        const { year, week } = req.params;
        const tasks = query(`
            SELECT t.*, c.name as category_name, p.name as project_name
            FROM tasks t
            LEFT JOIN categories c ON t.category_id = c.id
            LEFT JOIN projects p ON t.project_id = p.id
            WHERE t.year = ? AND t.week = ?
            ORDER BY 
                CASE t.priority 
                    WHEN 'p0' THEN 1 
                    WHEN 'p1' THEN 2 
                    WHEN 'p2' THEN 3 
                END,
                t.created_at DESC
        `, [parseInt(year), parseInt(week)]);
        
        res.json(tasks);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
});
```

---

#### 2.2 生成周报

**变更前**:
```
GET /api/weekly-report/:weekNumber
// 如: GET /api/weekly-report/2026WK1
```

**变更后**:
```
GET /api/weekly-report/:year/:week
// 如: GET /api/weekly-report/2026/1
```

**后端实现**:
```javascript
app.get('/api/weekly-report/:year/:week', (req, res) => {
    try {
        const { year, week } = req.params;
        const yearInt = parseInt(year);
        const weekInt = parseInt(week);
        
        // 获取本周完成的事项
        const doneTasksByCategory = query(`
            SELECT c.name as category_name, p.name as project_name, 
                   t.title, t.description, t.progress
            FROM tasks t
            JOIN categories c ON t.category_id = c.id
            LEFT JOIN projects p ON t.project_id = p.id
            WHERE t.year = ? AND t.week = ? AND t.status = 'done'
            ORDER BY c.name, p.name, t.priority
        `, [yearInt, weekInt]);
        
        // 其他查询类似...
        
        res.json({
            year: yearInt,
            week: weekInt,
            weekNumber: `${yearInt}WK${weekInt}`,  // 便于前端显示
            doneTasksByCategory,
            // ... 其他数据
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
});
```

---

#### 2.3 获取未完成事项数量（分组）

**变更前**:
```
GET /api/tasks/unfinished/grouped-count?currentWeek=2026WK1
```

**变更后**:
```
GET /api/tasks/unfinished/grouped-count?year=2026&week=1
```

**后端实现**:
```javascript
app.get('/api/tasks/unfinished/grouped-count', (req, res) => {
    try {
        const { year, week } = req.query;
        
        if (!year || !week) {
            return res.status(400).json({ error: 'year and week are required' });
        }
        
        const yearInt = parseInt(year);
        const weekInt = parseInt(week);
        
        // 普通事项：只统计本周及之前的未完成事项
        const normalResult = get(`
            SELECT COUNT(*) as count 
            FROM tasks 
            WHERE status IN ('todo', 'doing', 'backlog')
            AND (is_recurring = 0 OR is_recurring IS NULL)
            AND (
                year < ? 
                OR (year = ? AND week <= ?)
            )
        `, [yearInt, yearInt, weekInt]);
        
        // 重复事项：只统计本周的（避免重复计算）
        const recurringResult = get(`
            SELECT COUNT(*) as count 
            FROM tasks 
            WHERE is_recurring = 1
            AND year = ? AND week = ?
        `, [yearInt, weekInt]);
        
        res.json({
            normalCount: normalResult.count,
            recurringCount: recurringResult.count,
            totalCount: normalResult.count + recurringResult.count
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
});
```

---

#### 2.4 批量移动未完成事项

**变更前**:
```json
{
    "weekNumber": "2026WK2",
    "currentWeek": "2026WK1"
}
```

**变更后**:
```json
{
    "toYear": 2026,
    "toWeek": 2,
    "fromYear": 2026,
    "fromWeek": 1
}
```

**后端实现**:
```javascript
app.put('/api/tasks/unfinished/move-to-week', (req, res) => {
    try {
        const { toYear, toWeek, fromYear, fromWeek } = req.body;
        
        if (!toYear || !toWeek || !fromYear || !fromWeek) {
            return res.status(400).json({ 
                error: 'toYear, toWeek, fromYear, fromWeek are required' 
            });
        }
        
        const toYearInt = parseInt(toYear);
        const toWeekInt = parseInt(toWeek);
        const fromYearInt = parseInt(fromYear);
        const fromWeekInt = parseInt(fromWeek);
        
        // 1. 移动普通未完成事项（只移动本周及之前的）
        const moveResult = run(`
            UPDATE tasks 
            SET year = ?, week = ?, updated_at = CURRENT_TIMESTAMP
            WHERE status IN ('todo', 'doing', 'backlog')
            AND (is_recurring = 0 OR is_recurring IS NULL)
            AND (
                year < ? 
                OR (year = ? AND week <= ?)
            )
        `, [toYearInt, toWeekInt, fromYearInt, fromYearInt, fromWeekInt]);
        
        // 2. 获取本周的重复事项（只复制本周的，避免额外重复）
        const recurringTasks = query(`
            SELECT * FROM tasks 
            WHERE is_recurring = 1
            AND year = ? AND week = ?
        `, [fromYearInt, fromWeekInt]);
        
        // 3. 为每个重复事项创建下周副本
        let createdCount = 0;
        recurringTasks.forEach(task => {
            run(`
                INSERT INTO tasks (
                    title, description, category_id, project_id, 
                    priority, status, progress, year, week,
                    is_recurring, recurring_note
                ) VALUES (?, ?, ?, ?, ?, 'todo', 0, ?, ?, ?, ?)
            `, [
                task.title,
                task.description,
                task.category_id,
                task.project_id,
                task.priority,
                toYearInt,
                toWeekInt,
                1,
                task.recurring_note
            ]);
            createdCount++;
        });
        
        res.json({ 
            movedCount: moveResult.changes || 0,
            createdCount: createdCount,
            toYear: toYearInt,
            toWeek: toWeekInt
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
});
```

---

## 前端实现

### 1. 周次计算和格式化

#### 工具函数

```javascript
// ============ 周次计算工具 ============

// 获取当前周次（返回对象）
getCurrentWeek() {
    const now = new Date();
    const year = now.getFullYear();
    const start = new Date(year, 0, 1);
    
    // 获取1月1日是周几 (0=周日, 1=周一, ..., 6=周六)
    const startDay = start.getDay();
    
    // 计算从年初到现在经过的天数
    const diff = now - start;
    const daysPassed = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    // 调整：使用周一作为一周的开始
    const adjustedStartDay = startDay === 0 ? 6 : startDay - 1;
    
    // 计算周数
    const week = Math.ceil((daysPassed + adjustedStartDay + 1) / 7);
    
    return { year, week };
},

// 获取下一周
getNextWeek(currentYear, currentWeek) {
    let year = currentYear;
    let week = currentWeek + 1;
    
    // 检查是否需要跨年（简单处理：假设一年最多53周）
    if (week > 52) {
        // 检查当年是否真的有53周
        const lastDayOfYear = new Date(year, 11, 31);
        const lastWeek = this.getWeekOfDate(lastDayOfYear);
        
        if (week > lastWeek.week) {
            year++;
            week = 1;
        }
    }
    
    return { year, week };
},

// 获取上一周
getPreviousWeek(currentYear, currentWeek) {
    let year = currentYear;
    let week = currentWeek - 1;
    
    if (week < 1) {
        year--;
        // 获取上一年的最后一周
        const lastDayOfPrevYear = new Date(year, 11, 31);
        week = this.getWeekOfDate(lastDayOfPrevYear).week;
    }
    
    return { year, week };
},

// 获取指定日期的周次
getWeekOfDate(date) {
    const year = date.getFullYear();
    const start = new Date(year, 0, 1);
    const startDay = start.getDay();
    const diff = date - start;
    const daysPassed = Math.floor(diff / (1000 * 60 * 60 * 24));
    const adjustedStartDay = startDay === 0 ? 6 : startDay - 1;
    const week = Math.ceil((daysPassed + adjustedStartDay + 1) / 7);
    
    return { year, week };
},

// 格式化周次显示
formatWeek(year, week) {
    return `${year}WK${week}`;
},

// 解析周次字符串（用于URL参数等）
parseWeek(weekString) {
    const match = weekString.match(/(\d{4})WK(\d+)/);
    if (!match) return null;
    
    return {
        year: parseInt(match[1]),
        week: parseInt(match[2])
    };
},

// 比较两个周次（返回 -1, 0, 1）
compareWeeks(year1, week1, year2, week2) {
    if (year1 !== year2) {
        return year1 - year2;
    }
    return week1 - week2;
},

// 获取默认周次：周五、周六、周日时返回下一周
getDefaultWeek() {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=周日, 1=周一, ..., 6=周六
    const current = this.getCurrentWeek();
    
    // 如果是周五(5)、周六(6)、周日(0)，返回下一周
    if (dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6) {
        return this.getNextWeek(current.year, current.week);
    }
    
    return current;
},
```

---

### 2. URL 参数处理

#### 解析 URL 参数

```javascript
parseUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const result = {
        view: urlParams.get('view'),
        project: urlParams.get('project') || '',
        status: urlParams.get('status') || '',
        category: urlParams.get('category') ? parseInt(urlParams.get('category')) : null,
        tab: urlParams.get('tab') || 'projects'
    };
    
    // 解析周次参数（支持两种格式）
    const weekParam = urlParams.get('week');
    if (weekParam) {
        // 格式1: week=2026WK1
        const parsed = this.parseWeek(weekParam);
        if (parsed) {
            result.year = parsed.year;
            result.week = parsed.week;
        }
    } else {
        // 格式2: year=2026&week=1
        const year = urlParams.get('year');
        const week = urlParams.get('week');
        if (year && week) {
            result.year = parseInt(year);
            result.week = parseInt(week);
        }
    }
    
    return result;
},
```

#### 更新 URL

```javascript
updateUrl() {
    const params = new URLSearchParams();
    
    if (this.currentView === 'categories') {
        if (this.currentCategory) {
            params.set('category', this.currentCategory);
            if (this.currentProject) {
                params.set('project', this.currentProject);
            } else if (this.currentTab !== 'projects') {
                params.set('tab', this.currentTab);
            }
        }
    } else if (this.currentView === 'weekly') {
        params.set('view', 'weekly');
        
        // 使用组合格式更简洁
        if (this.currentWeek) {
            params.set('week', this.formatWeek(this.currentWeek.year, this.currentWeek.week));
        }
        
        if (this.weekFilters.projectId) {
            params.set('project', this.weekFilters.projectId);
        }
        if (this.weekFilters.status) {
            params.set('status', this.weekFilters.status);
        }
    } else {
        params.set('view', this.currentView);
    }
    
    const queryString = params.toString();
    const newUrl = queryString ? `${window.location.pathname}?${queryString}` : window.location.pathname;
    window.history.pushState({ path: newUrl }, '', newUrl);
},
```

---

### 3. 主要功能修改

#### 3.1 应用初始化

```javascript
async init() {
    this.setupNavigation();
    await this.loadCurrentDatabase();
    await this.loadCategories();
    
    // 从 URL 读取参数
    const params = this.parseUrlParams();
    
    // 设置当前周次
    if (params.year && params.week) {
        this.currentWeek = { year: params.year, week: params.week };
    } else {
        this.currentWeek = this.getCurrentWeek();
    }
    
    this.setupWeekOptions();
    
    // 应用视图
    if (params.view === 'weekly') {
        this.weekFilters.projectId = params.project || '';
        this.weekFilters.status = params.status || '';
        this.showView('weekly');
    } else if (params.view === 'report') {
        this.showView('report');
    } else {
        this.showView('categories');
        if (params.category) {
            this.currentTab = params.tab || 'projects';
            await this.showCategoryDetail(params.category);
            if (params.project) {
                await this.showProjectDetail(params.project);
            }
        }
    }
},
```

---

#### 3.2 每周视图加载

```javascript
async loadWeeklyView() {
    const weekDisplay = this.formatWeek(this.currentWeek.year, this.currentWeek.week);
    document.getElementById('weekTitle').textContent = weekDisplay;
    
    try {
        const response = await fetch(
            `${API_BASE}/tasks/week/${this.currentWeek.year}/${this.currentWeek.week}`
        );
        const tasks = await response.json();
        this.weeklyTasks = tasks;
        
        await this.loadWeeklyProjects();
        
        document.getElementById('weekProjectFilter').value = this.weekFilters.projectId;
        document.getElementById('weekStatusFilter').value = this.weekFilters.status;
        
        this.applyWeekFilters();
    } catch (error) {
        console.error('加载每周视图失败:', error);
        alert('加载失败');
    }
},
```

---

#### 3.3 周次切换

```javascript
changeWeek(delta) {
    if (delta > 0) {
        // 下一周
        this.currentWeek = this.getNextWeek(this.currentWeek.year, this.currentWeek.week);
    } else {
        // 上一周
        this.currentWeek = this.getPreviousWeek(this.currentWeek.year, this.currentWeek.week);
    }
    
    this.loadWeeklyView();
    this.updateUrl();
},
```

---

#### 3.4 周报选择器

```javascript
setupWeekOptions() {
    const select = document.getElementById('reportWeekSelect');
    select.innerHTML = ''; // 清空
    
    let current = this.getCurrentWeek();
    
    // 生成最近10周的选项
    for (let i = 0; i < 10; i++) {
        const weekStr = this.formatWeek(current.year, current.week);
        const option = document.createElement('option');
        option.value = weekStr;
        option.textContent = weekStr;
        if (i === 0) option.selected = true;
        select.appendChild(option);
        
        // 计算上一周
        current = this.getPreviousWeek(current.year, current.week);
    }
},
```

---

#### 3.5 周报加载

```javascript
async loadWeeklyReport() {
    const weekString = document.getElementById('reportWeekSelect').value;
    const parsed = this.parseWeek(weekString);
    
    if (!parsed) {
        alert('无效的周次格式');
        return;
    }
    
    try {
        const response = await fetch(
            `${API_BASE}/weekly-report/${parsed.year}/${parsed.week}`
        );
        const data = await response.json();
        this.renderReport(data);
    } catch (error) {
        console.error('生成周报失败:', error);
        alert('生成周报失败');
    }
},
```

---

#### 3.6 未完成事项移动

```javascript
async moveUnfinishedToNextWeek() {
    const current = this.getCurrentWeek();
    const next = this.getNextWeek(current.year, current.week);
    
    try {
        // 1. 获取未完成事项统计
        const countResponse = await fetch(
            `${API_BASE}/tasks/unfinished/grouped-count?year=${current.year}&week=${current.week}`
        );
        const { normalCount, recurringCount, totalCount } = await countResponse.json();
        
        if (totalCount === 0) {
            alert('没有未完成的事项');
            return;
        }
        
        // 2. 显示确认信息
        const nextWeekDisplay = this.formatWeek(next.year, next.week);
        let message = `将事项移动到 ${nextWeekDisplay}？\n\n`;
        if (normalCount > 0) {
            message += `• 普通未完成事项 ${normalCount} 个：直接移动到下周\n`;
        }
        if (recurringCount > 0) {
            message += `• 重复事项 ${recurringCount} 个：在下周创建新副本\n`;
        }
        message += `\n共 ${totalCount} 个事项`;
        
        if (!confirm(message)) {
            return;
        }
        
        // 3. 执行移动
        const updateResponse = await fetch(`${API_BASE}/tasks/unfinished/move-to-week`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                toYear: next.year,
                toWeek: next.week,
                fromYear: current.year,
                fromWeek: current.week
            })
        });
        
        if (updateResponse.ok) {
            const result = await updateResponse.json();
            
            let successMsg = `成功移动到 ${nextWeekDisplay}！`;
            if (result.movedCount > 0 && result.createdCount > 0) {
                successMsg += `\n移动 ${result.movedCount} 个，创建 ${result.createdCount} 个副本`;
            } else if (result.movedCount > 0) {
                successMsg += `\n移动 ${result.movedCount} 个普通事项`;
            } else if (result.createdCount > 0) {
                successMsg += `\n创建 ${result.createdCount} 个重复事项副本`;
            }
            
            this.showToast(successMsg, 'success');
            
            // 刷新视图
            if (this.currentView === 'categories') {
                if (this.currentProject) {
                    await this.loadProjectTasks(this.currentProject);
                } else if (this.currentCategory && this.currentTab === 'tasks') {
                    await this.loadCategoryTasks();
                }
                await this.loadCategories();
            } else if (this.currentView === 'weekly') {
                await this.loadWeeklyView();
            }
        } else {
            const error = await updateResponse.json();
            alert('移动失败: ' + (error.error || '未知错误'));
        }
    } catch (error) {
        console.error('移动未完成事项失败:', error);
        alert('移动失败');
    }
},
```

---

#### 3.7 快速添加事项

```javascript
async showQuickAddModal(taskId = null) {
    // ... 前面代码保持不变 ...
    
    if (taskId) {
        // 编辑模式
        const response = await fetch(`${API_BASE}/tasks/${taskId}`);
        const task = await response.json();
        
        // ... 其他字段设置 ...
        
        // 设置周次
        if (task.year && task.week) {
            document.getElementById('quickTaskWeek').value = this.formatWeek(task.year, task.week);
        } else {
            document.getElementById('quickTaskWeek').value = '';
        }
        
    } else {
        // 新建模式
        // ... 其他字段设置 ...
        
        // 设置默认周次
        const defaultWeek = this.getDefaultWeek();
        document.getElementById('quickTaskWeek').value = this.formatWeek(defaultWeek.year, defaultWeek.week);
    }
    
    modal.classList.add('active');
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
    const is_recurring = document.getElementById('quickTaskRecurring').checked ? 1 : 0;
    const recurring_note = document.getElementById('quickTaskRecurringNote').value.trim() || null;
    
    // 解析周次
    const weekString = document.getElementById('quickTaskWeek').value.trim();
    let year = null;
    let week = null;
    
    if (weekString) {
        const parsed = this.parseWeek(weekString);
        if (parsed) {
            year = parsed.year;
            week = parsed.week;
        } else {
            alert('周次格式不正确，请使用格式: 2026WK1');
            return;
        }
    }
    
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
                year,
                week,
                is_recurring,
                recurring_note
            })
        });
        
        if (response.ok) {
            const message = id ? '事项更新成功！' : '事项创建成功！';
            this.showToast(message, 'success');
            this.closeQuickAddModal();
            
            // 刷新视图...
        } else {
            const error = await response.json();
            alert('保存失败: ' + (error.error || '未知错误'));
        }
    } catch (error) {
        console.error('保存事项失败:', error);
        alert('保存失败');
    }
},
```

---

#### 3.8 任务显示

```javascript
renderTaskItem(task) {
    const recurringIcon = task.is_recurring ? '🔄 ' : '';
    const recurringNote = task.is_recurring && task.recurring_note 
        ? `<span class="recurring-note">${task.recurring_note}</span>` 
        : '';
    
    const displayProgress = task.status === 'done' ? 100 : (task.progress || 0);
    
    // 格式化周次显示
    const weekDisplay = task.year && task.week 
        ? this.formatWeek(task.year, task.week) 
        : '';
    
    return `
        <div class="task-item priority-${task.priority}" onclick="app.showQuickAddModal(${task.id})">
            <div class="task-item-header">
                <div class="task-item-title">
                    ${recurringIcon}${task.title}
                    ${recurringNote}
                </div>
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
                        <div class="task-progress-fill" style="width: ${displayProgress}%"></div>
                    </div>
                </div>
                <div class="task-week">${displayProgress}% ${weekDisplay ? `| ${weekDisplay}` : ''}</div>
            </div>
        </div>
    `;
},
```

---

### 4. HTML 表单修改

#### 快速添加对话框中的周次输入

```html
<div class="form-group">
    <label>周次</label>
    <input type="text" id="quickTaskWeek" 
           placeholder="如: 2026WK1"
           pattern="^\d{4}WK\d+$"
           title="格式: 2026WK1">
    <small class="form-hint">格式: 年份WK周次，如 2026WK1</small>
</div>
```

---

## 数据库迁移

### 迁移策略：简化方案

#### 背景
- 当前所有存量数据都是 2025 年产生的
- week_number 字段为 INTEGER 类型，存储的是周次（1-53）
- 无需复杂的数据解析和转换

#### 迁移方案：重建表 + 默认年份

使用 SQLite 的表重建方式，直接添加 year 和 week 字段，存量数据的年份默认设置为 2025。

**迁移 SQL**:

```sql
-- 迁移脚本 v0.7.0
-- 执行时间：2026-01-XX

BEGIN TRANSACTION;

-- 1. 创建新的 tasks 表
CREATE TABLE tasks_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    category_id INTEGER,
    project_id INTEGER NOT NULL,
    priority TEXT CHECK(priority IN ('p0', 'p1', 'p2')) DEFAULT 'p2',
    status TEXT CHECK(status IN ('todo', 'doing', 'done', 'backlog')) DEFAULT 'todo',
    progress INTEGER DEFAULT 0 CHECK(progress >= 0 AND progress <= 100),
    year INTEGER,
    week INTEGER,
    is_recurring BOOLEAN DEFAULT 0,
    recurring_note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- 2. 迁移数据：存量数据年份默认为 2025
INSERT INTO tasks_new (
    id, title, description, category_id, project_id,
    priority, status, progress, year, week,
    is_recurring, recurring_note,
    created_at, updated_at
)
SELECT 
    id, title, description, category_id, project_id,
    priority, status, progress,
    2025,  -- 存量数据默认年份为 2025
    week_number,  -- 直接使用原 week_number
    COALESCE(is_recurring, 0),
    recurring_note,
    created_at, updated_at
FROM tasks;

-- 3. 删除旧表
DROP TABLE tasks;

-- 4. 重命名新表
ALTER TABLE tasks_new RENAME TO tasks;

-- 5. 创建索引
CREATE INDEX idx_tasks_category ON tasks(category_id);
CREATE INDEX idx_tasks_project ON tasks(project_id);
CREATE INDEX idx_tasks_year_week ON tasks(year, week);
CREATE INDEX idx_tasks_year ON tasks(year);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_recurring ON tasks(is_recurring);

-- 6. 迁移 weekly_logs 表（如果使用）
CREATE TABLE weekly_logs_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    year INTEGER NOT NULL,
    week INTEGER NOT NULL,
    task_id INTEGER,
    log_type TEXT CHECK(log_type IN ('added', 'progress', 'done')) NOT NULL,
    content TEXT,
    log_date DATE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

INSERT INTO weekly_logs_new (
    id, year, week, task_id, log_type, content, log_date, created_at
)
SELECT 
    id,
    2025,  -- 存量数据默认年份为 2025
    week_number,
    task_id, log_type, content, log_date, created_at
FROM weekly_logs;

DROP TABLE weekly_logs;
ALTER TABLE weekly_logs_new RENAME TO weekly_logs;
CREATE INDEX idx_weekly_logs_year_week ON weekly_logs(year, week);

-- 7. 验证迁移结果
SELECT 
    COUNT(*) as total_tasks,
    COUNT(DISTINCT year) as year_count,
    MIN(year) as min_year,
    MAX(year) as max_year,
    MIN(week) as min_week,
    MAX(week) as max_week
FROM tasks;

COMMIT;
```

#### 优势
✅ **简单直接**: 无需复杂的字符串解析  
✅ **安全可靠**: 事务保护，失败自动回滚  
✅ **高效执行**: 无条件判断，直接赋值  
✅ **易于验证**: 迁移后数据清晰可查  
✅ **符合实际**: 存量数据确实是 2025 年的  

#### 执行步骤

**方式一：通过 database.js 的 initDatabase()**

在 `database.js` 的 `initDatabase()` 函数中添加迁移检查：

```javascript
function initDatabase() {
  // 检查是否需要迁移
  const tableInfo = db.exec("PRAGMA table_info(tasks)");
  const columns = tableInfo[0]?.values.map(row => row[1]) || [];
  
  if (columns.includes('week_number') && !columns.includes('year')) {
    console.log('检测到旧表结构，开始迁移...');
    
    // 执行迁移 SQL（上面的完整 SQL）
    db.exec(`
      BEGIN TRANSACTION;
      -- ... 迁移 SQL ...
      COMMIT;
    `);
    
    console.log('迁移完成！');
    saveDatabase();
  }
  
  // 创建新表结构（如果是全新数据库）
  db.run(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      category_id INTEGER,
      project_id INTEGER NOT NULL,
      priority TEXT CHECK(priority IN ('p0', 'p1', 'p2')) DEFAULT 'p2',
      status TEXT CHECK(status IN ('todo', 'doing', 'done', 'backlog')) DEFAULT 'todo',
      progress INTEGER DEFAULT 0 CHECK(progress >= 0 AND progress <= 100),
      year INTEGER,
      week INTEGER,
      is_recurring BOOLEAN DEFAULT 0,
      recurring_note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    )
  `);
  
  // ... 其他表和索引 ...
}
```

**方式二：手动执行 SQL（推荐用于测试）**

1. 备份数据库文件
2. 使用 SQLite 客户端连接数据库
3. 执行上述迁移 SQL
4. 验证数据

#### 回滚方案

如果迁移失败，由于使用了事务，数据会自动回滚到迁移前状态。

如果需要手动回滚（迁移后发现问题）：

```sql
-- 仅作参考，建议直接恢复备份
BEGIN TRANSACTION;

CREATE TABLE tasks_old (
    -- ... 旧表结构 ...
    week_number INTEGER,
    -- ...
);

INSERT INTO tasks_old SELECT 
    id, title, description, category_id, project_id,
    priority, status, progress, week,  -- week 复制回 week_number
    created_at, updated_at
FROM tasks;

DROP TABLE tasks;
ALTER TABLE tasks_old RENAME TO tasks;

COMMIT;
```

---

## 实施计划

### Phase 1: 数据库层 ✅
1. 创建迁移脚本
2. 在测试数据库上执行迁移
3. 验证数据完整性
4. 备份生产数据库
5. 执行生产迁移

### Phase 2: 后端API ✅
1. 修改所有周次相关API接口
2. 更新查询SQL使用 year 和 week
3. 添加输入验证
4. 更新API文档
5. 编写单元测试

### Phase 3: 前端工具函数 ✅
1. 实现周次计算工具函数
2. 实现周次格式化函数
3. 实现周次解析函数
4. 实现周次比较函数
5. 编写单元测试

### Phase 4: 前端业务逻辑 ✅
1. 更新所有API调用
2. 修改事项表单
3. 更新显示逻辑
4. 修改URL参数处理
5. 测试所有功能

### Phase 5: 测试和部署 ✅
1. 端到端测试
2. 跨年场景测试
3. 性能测试
4. 用户验收测试
5. 生产部署

---

## 测试场景

### 基础功能
1. ✅ 创建事项时输入 `2026WK1`，正确保存为 year=2026, week=1
2. ✅ 编辑事项显示正确的周次格式
3. ✅ 事项列表显示格式统一为 `2026WK1`
4. ✅ 周次选择器显示格式正确

### 跨年场景
5. ✅ 2025年第52周切换到下一周显示 `2026WK1`
6. ✅ 2026年第1周切换到上一周显示 `2025WK52`
7. ✅ 跨年未完成事项移动正确
8. ✅ 跨年周报生成正确

### 查询和排序
9. ✅ 按周次范围查询事项
10. ✅ 事项按年份和周次正确排序
11. ✅ 年度统计查询正确
12. ✅ 索引使用有效，查询性能良好

### 数据迁移
13. ✅ 存量数据年份默认设置为 2025
14. ✅ 周次数据直接复制到 week 字段
15. ✅ NULL 值处理正确
16. ✅ 所有索引创建成功

---

## 优势总结

### 数据层面
✅ **类型安全**: 使用整数存储，避免类型转换问题  
✅ **查询高效**: 支持索引和范围查询  
✅ **排序准确**: 整数排序天然支持跨年  
✅ **存储优化**: 整数比字符串占用空间更小  

### 功能层面
✅ **跨年支持**: 轻松处理年度边界  
✅ **统计方便**: 可以按年份聚合统计  
✅ **扩展性好**: 便于添加季度、月份等维度  
✅ **语义清晰**: year 和 week 字段含义明确  

### 用户体验
✅ **显示统一**: 前端统一使用 `2026WK1` 格式  
✅ **易于理解**: 年份信息一目了然  
✅ **跨年无感**: 周次切换自然流畅  
✅ **历史回顾**: 可以轻松查看往年数据  

---

## 注意事项

1. **数据迁移**: 
   - 必须先备份数据库
   - 存量数据年份统一设置为 2025（符合实际）
   - 使用事务确保原子性，失败自动回滚

2. **API兼容性**:
   - 新旧API可以并存一段时间
   - 逐步废弃旧接口
   - 提供迁移指南

3. **前端兼容**:
   - 周次输入支持自动格式化
   - URL参数支持多种格式
   - 提示用户新格式

4. **性能考虑**:
   - 创建复合索引 (year, week)
   - 避免字符串拼接查询
   - 使用参数化查询

5. **边界处理**:
   - 正确计算年末/年初周次
   - 处理53周的年份
   - 验证周次范围（1-53）

---

## 后续优化（v0.8.0+）

1. **季度视图**: 基于 year/week 实现季度统计
2. **年度报告**: 生成年度工作总结
3. **多年对比**: 对比不同年份同期数据
4. **智能提醒**: 基于历史周次提供建议
5. **数据分析**: 周次维度的数据可视化

---

## 总结

v0.7.0 通过将周次拆分为 `year` (INTEGER) 和 `week` (INTEGER) 两个字段，实现了：

✅ 正确的数据类型设计  
✅ 高效的查询和索引  
✅ 完善的跨年支持  
✅ 统一的显示格式  
✅ 良好的可扩展性  

这个设计为未来的功能扩展（如季度视图、年度报告等）打下了坚实的基础。
