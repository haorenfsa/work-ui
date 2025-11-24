# 项目管理系统增量设计 v0.4

## 新增功能：多数据库切换

### 功能概述
在 v0.3 快速添加功能的基础上，新增数据库切换功能，允许用户在多个工作空间（数据库文件）之间快速切换，适用于管理不同团队、项目或时间段的任务。

### 使用场景
- **多团队管理**: 不同团队使用独立的数据库，避免数据混淆
- **个人/工作分离**: 个人事项和工作事项分开管理
- **项目归档**: 历史项目使用独立数据库归档，主数据库保持清爽
- **测试环境**: 开发/测试数据库与生产数据库分离

---

## UI 设计

### 导航栏布局调整

```
[项目管理系统] [🗄️ 切换数据库] [+ 快速添加]  |  [分类管理] [每周视图] [周报生成]
```

**布局说明**:
- 在「项目管理系统」标题右侧添加「🗄️ 切换数据库」按钮
- 「切换数据库」按钮位于「快速添加」左侧
- 顺序：Logo/标题 → 数据库切换 → 快速添加 → 功能导航

**按钮样式**:
- 图标：使用文件夹或数据库图标（🗄️ 或 📁）
- 颜色：区别于「快速添加」按钮，使用次要色（如灰色/紫色）
- 显示当前数据库名称（可选，空间允许时）
- 悬停提示：显示当前数据库的完整信息

---

## 数据库切换模态框设计

### 模态框标题
**切换数据库**

### 主要区域

#### 1. 当前数据库信息
```
当前数据库：work-main.db
创建时间：2024-11-20
最后使用：2024-11-24 14:30
统计：5个分类 | 12个项目 | 48个事项
```

#### 2. 数据库列表
- 以卡片形式展示所有可用数据库
- 每个数据库卡片包含：
  - 数据库名称（可点击编辑）
  - 文件路径（简化显示）
  - 基本统计（分类数、项目数、事项数）
  - 创建时间
  - 最后使用时间
  - 操作按钮：
    - **切换** - 切换到该数据库
    - **重命名** - 修改显示名称
    - **删除** - 删除数据库文件（需二次确认）

#### 3. 新建数据库区域
```
[+ 新建数据库]

输入框：
- 数据库名称：work-new
- 描述（可选）：新项目工作空间

[创建]  [取消]
```

---

## 技术实现

### 后端实现

#### 1. 数据库配置管理

##### 配置文件结构 (`db-config.json`)
```json
{
  "currentDb": "work-main.db",
  "databases": {
    "work-main.db": {
      "displayName": "主工作空间",
      "description": "日常工作任务管理",
      "filePath": "data/work-main.db",
      "createdAt": "2024-11-20T10:00:00Z",
      "lastUsed": "2024-11-24T14:30:00Z"
    },
    "personal.db": {
      "displayName": "个人事项",
      "description": "个人学习和生活规划",
      "filePath": "data/personal.db",
      "createdAt": "2024-11-22T09:00:00Z",
      "lastUsed": "2024-11-23T20:15:00Z"
    }
  }
}
```

#### 2. 修改 `database.js`

```javascript
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

// 配置文件路径
const CONFIG_PATH = path.join(__dirname, 'db-config.json');
const DATA_DIR = path.join(__dirname, 'data');

let db = null;
let currentDbPath = null;
let dbConfig = null;

// 确保数据目录存在
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR);
}

// 加载数据库配置
function loadConfig() {
  if (fs.existsSync(CONFIG_PATH)) {
    const content = fs.readFileSync(CONFIG_PATH, 'utf-8');
    dbConfig = JSON.parse(content);
  } else {
    // 初始化默认配置
    dbConfig = {
      currentDb: 'work-main.db',
      databases: {
        'work-main.db': {
          displayName: '主工作空间',
          description: '日常工作任务管理',
          filePath: path.join(DATA_DIR, 'work-main.db'),
          createdAt: new Date().toISOString(),
          lastUsed: new Date().toISOString()
        }
      }
    };
    saveConfig();
  }
  return dbConfig;
}

// 保存数据库配置
function saveConfig() {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(dbConfig, null, 2));
}

// 获取当前数据库路径
function getCurrentDbPath() {
  if (!dbConfig) loadConfig();
  const currentDbName = dbConfig.currentDb;
  return dbConfig.databases[currentDbName]?.filePath || 
         path.join(DATA_DIR, currentDbName);
}

// 切换数据库
async function switchDatabase(dbName) {
  if (!dbConfig.databases[dbName]) {
    throw new Error(`Database ${dbName} not found in config`);
  }
  
  // 保存当前数据库
  if (db) {
    saveDatabase();
  }
  
  // 更新配置
  dbConfig.currentDb = dbName;
  dbConfig.databases[dbName].lastUsed = new Date().toISOString();
  saveConfig();
  
  // 加载新数据库
  await setupDatabase();
  
  return {
    success: true,
    currentDb: dbName,
    info: dbConfig.databases[dbName]
  };
}

// 创建新数据库
async function createDatabase(dbName, displayName, description = '') {
  if (dbConfig.databases[dbName]) {
    throw new Error(`Database ${dbName} already exists`);
  }
  
  const filePath = path.join(DATA_DIR, dbName);
  
  // 添加到配置
  dbConfig.databases[dbName] = {
    displayName: displayName || dbName,
    description,
    filePath,
    createdAt: new Date().toISOString(),
    lastUsed: new Date().toISOString()
  };
  saveConfig();
  
  // 切换到新数据库并初始化
  await switchDatabase(dbName);
  initDatabase();
  initDefaultData();
  
  return {
    success: true,
    dbName,
    info: dbConfig.databases[dbName]
  };
}

// 删除数据库
function deleteDatabase(dbName) {
  if (dbName === dbConfig.currentDb) {
    throw new Error('Cannot delete current database');
  }
  
  if (!dbConfig.databases[dbName]) {
    throw new Error(`Database ${dbName} not found`);
  }
  
  const filePath = dbConfig.databases[dbName].filePath;
  
  // 删除文件
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
  
  // 从配置中移除
  delete dbConfig.databases[dbName];
  saveConfig();
  
  return { success: true };
}

// 重命名数据库
function renameDatabase(dbName, newDisplayName, newDescription) {
  if (!dbConfig.databases[dbName]) {
    throw new Error(`Database ${dbName} not found`);
  }
  
  dbConfig.databases[dbName].displayName = newDisplayName;
  if (newDescription !== undefined) {
    dbConfig.databases[dbName].description = newDescription;
  }
  saveConfig();
  
  return {
    success: true,
    info: dbConfig.databases[dbName]
  };
}

// 获取所有数据库信息（包含统计）
async function getAllDatabases() {
  const databases = [];
  
  for (const [dbName, info] of Object.entries(dbConfig.databases)) {
    let stats = { categories: 0, projects: 0, tasks: 0 };
    
    // 如果是当前数据库，直接查询
    if (dbName === dbConfig.currentDb && db) {
      const result = query(`
        SELECT 
          (SELECT COUNT(*) FROM categories) as categories,
          (SELECT COUNT(*) FROM projects) as projects,
          (SELECT COUNT(*) FROM tasks) as tasks
      `);
      if (result.length > 0) {
        stats = result[0];
      }
    } else {
      // 其他数据库需要临时加载来获取统计
      try {
        const SQL = await initSqlJs();
        if (fs.existsSync(info.filePath)) {
          const buffer = fs.readFileSync(info.filePath);
          const tempDb = new SQL.Database(buffer);
          
          const result = tempDb.exec(`
            SELECT 
              (SELECT COUNT(*) FROM categories) as categories,
              (SELECT COUNT(*) FROM projects) as projects,
              (SELECT COUNT(*) FROM tasks) as tasks
          `);
          
          if (result.length > 0 && result[0].values.length > 0) {
            stats = {
              categories: result[0].values[0][0],
              projects: result[0].values[0][1],
              tasks: result[0].values[0][2]
            };
          }
          
          tempDb.close();
        }
      } catch (e) {
        console.error(`Error reading stats for ${dbName}:`, e);
      }
    }
    
    databases.push({
      name: dbName,
      displayName: info.displayName,
      description: info.description,
      filePath: info.filePath,
      createdAt: info.createdAt,
      lastUsed: info.lastUsed,
      isCurrent: dbName === dbConfig.currentDb,
      stats
    });
  }
  
  // 按最后使用时间排序
  databases.sort((a, b) => 
    new Date(b.lastUsed) - new Date(a.lastUsed)
  );
  
  return databases;
}

// 修改原有的 setupDatabase
async function setupDatabase() {
  loadConfig();
  currentDbPath = getCurrentDbPath();
  
  const SQL = await initSqlJs();
  
  // 尝试加载已有数据库
  if (fs.existsSync(currentDbPath)) {
    const buffer = fs.readFileSync(currentDbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }
  
  return db;
}

// 修改原有的 saveDatabase
function saveDatabase() {
  if (db && currentDbPath) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(currentDbPath, buffer);
  }
}

// 导出新增的函数
module.exports = {
  setupDatabase,
  saveDatabase,
  initDatabase,
  initDefaultData,
  query,
  run,
  get,
  getDb: () => db,
  
  // 新增的数据库管理函数
  switchDatabase,
  createDatabase,
  deleteDatabase,
  renameDatabase,
  getAllDatabases,
  getCurrentDbInfo: () => ({
    name: dbConfig?.currentDb,
    ...dbConfig?.databases[dbConfig?.currentDb]
  })
};
```

#### 3. 新增 API 接口 (`server.js`)

```javascript
// ============ 数据库管理 API ============

// 获取所有数据库列表
app.get('/api/databases', async (req, res) => {
  try {
    const databases = await getAllDatabases();
    res.json(databases);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 获取当前数据库信息
app.get('/api/databases/current', (req, res) => {
  try {
    const info = getCurrentDbInfo();
    res.json(info);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 切换数据库
app.post('/api/databases/switch', async (req, res) => {
  try {
    const { dbName } = req.body;
    if (!dbName) {
      return res.status(400).json({ error: 'Database name is required' });
    }
    
    const result = await switchDatabase(dbName);
    res.json(result);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 创建新数据库
app.post('/api/databases', async (req, res) => {
  try {
    const { dbName, displayName, description } = req.body;
    
    if (!dbName) {
      return res.status(400).json({ error: 'Database name is required' });
    }
    
    // 验证文件名格式
    if (!/^[a-zA-Z0-9_-]+\.db$/.test(dbName)) {
      return res.status(400).json({ 
        error: 'Invalid database name. Use format: name.db' 
      });
    }
    
    const result = await createDatabase(dbName, displayName, description);
    res.json(result);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 重命名数据库
app.put('/api/databases/:dbName', (req, res) => {
  try {
    const { dbName } = req.params;
    const { displayName, description } = req.body;
    
    const result = renameDatabase(dbName, displayName, description);
    res.json(result);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 删除数据库
app.delete('/api/databases/:dbName', (req, res) => {
  try {
    const { dbName } = req.params;
    const result = deleteDatabase(dbName);
    res.json(result);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});
```

---

## 前端实现

### 1. 导航栏添加数据库切换按钮 (`index.html`)

```html
<nav class="top-nav">
    <div class="nav-left">
        <h1>项目管理系统</h1>
        <button class="btn-db-switch" onclick="app.showDatabaseModal()">
            <span class="db-icon">🗄️</span>
            <span id="currentDbName">主工作空间</span>
        </button>
        <button class="btn-quick-add" onclick="app.showQuickAddModal()">
            <span class="plus-icon">+</span>
            <span>快速添加</span>
        </button>
    </div>
    <div class="nav-buttons">
        <button class="nav-btn active" data-view="categories">分类管理</button>
        <button class="nav-btn" data-view="weekly">每周视图</button>
        <button class="nav-btn" data-view="report">周报生成</button>
    </div>
</nav>
```

### 2. 数据库切换模态框 (`index.html`)

```html
<!-- 数据库切换模态框 -->
<div id="databaseModal" class="modal">
    <div class="modal-content modal-large">
        <div class="modal-header">
            <h3>切换数据库</h3>
            <span class="close" onclick="app.closeDatabaseModal()">&times;</span>
        </div>
        <div class="modal-body">
            <!-- 当前数据库信息 -->
            <div class="current-db-info" id="currentDbInfo">
                <!-- 动态加载 -->
            </div>
            
            <!-- 数据库列表 -->
            <div class="db-list-header">
                <h4>所有数据库</h4>
                <button class="btn btn-primary btn-sm" onclick="app.showCreateDbForm()">
                    + 新建数据库
                </button>
            </div>
            
            <div class="database-list" id="databaseList">
                <!-- 动态加载数据库卡片 -->
            </div>
            
            <!-- 新建数据库表单（初始隐藏）-->
            <div class="create-db-form" id="createDbForm" style="display:none;">
                <h4>新建数据库</h4>
                <div class="form-group">
                    <label>数据库文件名 *</label>
                    <input type="text" id="newDbName" placeholder="例如: personal.db" />
                    <small>只能包含字母、数字、下划线和连字符，必须以 .db 结尾</small>
                </div>
                <div class="form-group">
                    <label>显示名称 *</label>
                    <input type="text" id="newDbDisplayName" placeholder="例如: 个人事项" />
                </div>
                <div class="form-group">
                    <label>描述（可选）</label>
                    <textarea id="newDbDescription" rows="2" placeholder="简单描述这个数据库的用途"></textarea>
                </div>
                <div class="form-actions">
                    <button class="btn btn-secondary" onclick="app.hideCreateDbForm()">取消</button>
                    <button class="btn btn-primary" onclick="app.createDatabase()">创建</button>
                </div>
            </div>
        </div>
    </div>
</div>
```

### 3. JavaScript 实现 (`app.js`)

```javascript
const app = {
    // ... 现有代码 ...
    
    currentDbName: null,
    
    // 初始化时加载当前数据库信息
    async init() {
        this.setupNavigation();
        await this.loadCurrentDatabase();
        this.loadCategories();
        this.currentWeek = this.getCurrentWeekNumber();
        this.setupWeekOptions();
    },
    
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
    
    // ============ 数据库管理 ============
    
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
```

### 4. CSS 样式 (`style.css`)

```css
/* 数据库切换按钮 */
.btn-db-switch {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background-color: #5a67d8;
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.875rem;
    font-weight: 500;
    transition: all 0.2s;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.btn-db-switch:hover {
    background-color: #4c51bf;
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(0,0,0,0.15);
}

.btn-db-switch .db-icon {
    font-size: 1.125rem;
}

/* 当前数据库信息卡片 */
.current-db-info {
    margin-bottom: 1.5rem;
}

.current-db-card {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 1.5rem;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}

.current-db-card .db-card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
}

.current-db-card h4 {
    margin: 0;
    font-size: 1.25rem;
}

.current-badge {
    background-color: rgba(255,255,255,0.3);
    padding: 0.25rem 0.75rem;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 600;
}

.current-db-card .db-description {
    margin: 0.5rem 0 1rem 0;
    opacity: 0.9;
}

.current-db-card .db-stats {
    display: flex;
    gap: 1.5rem;
    margin-bottom: 1rem;
}

.current-db-card .db-stats span {
    font-size: 0.9375rem;
    font-weight: 500;
}

.current-db-card .db-meta {
    display: flex;
    gap: 1.5rem;
    opacity: 0.8;
    font-size: 0.8125rem;
}

/* 数据库列表 */
.db-list-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
}

.db-list-header h4 {
    margin: 0;
}

.database-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 1rem;
    margin-bottom: 1.5rem;
}

.db-card {
    background-color: white;
    border: 2px solid #e2e8f0;
    border-radius: 8px;
    padding: 1.25rem;
    transition: all 0.2s;
}

.db-card:hover {
    border-color: #cbd5e0;
    box-shadow: 0 4px 12px rgba(0,0,0,0.08);
}

.db-card.current {
    border-color: #667eea;
    background-color: #f7fafc;
}

.db-card .db-card-header {
    display: flex;
    justify-content: space-between;
    align-items: start;
    margin-bottom: 0.75rem;
}

.db-card h5 {
    margin: 0 0 0.25rem 0;
    font-size: 1.125rem;
    color: #2d3748;
}

.db-card .db-filename {
    color: #718096;
    font-size: 0.75rem;
}

.db-card .current-badge {
    background-color: #667eea;
    color: white;
    padding: 0.25rem 0.5rem;
    border-radius: 12px;
    font-size: 0.625rem;
    font-weight: 600;
}

.db-card .db-description {
    color: #4a5568;
    font-size: 0.875rem;
    margin-bottom: 0.75rem;
    line-height: 1.4;
}

.db-card .db-stats {
    display: flex;
    gap: 1rem;
    margin-bottom: 0.75rem;
    font-size: 0.8125rem;
    color: #718096;
}

.db-card .db-meta {
    margin-bottom: 1rem;
    font-size: 0.75rem;
    color: #a0aec0;
}

.db-card .db-actions {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
}

/* 新建数据库表单 */
.create-db-form {
    background-color: #f7fafc;
    border: 2px dashed #cbd5e0;
    border-radius: 8px;
    padding: 1.5rem;
    margin-top: 1.5rem;
}

.create-db-form h4 {
    margin: 0 0 1rem 0;
    color: #2d3748;
}

.create-db-form .form-group small {
    display: block;
    margin-top: 0.25rem;
    color: #718096;
    font-size: 0.75rem;
}

.create-db-form .form-actions {
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
    margin-top: 1rem;
}

/* 按钮尺寸变体 */
.btn-sm {
    padding: 0.375rem 0.75rem;
    font-size: 0.8125rem;
}

/* 空状态消息 */
.empty-message {
    text-align: center;
    color: #a0aec0;
    padding: 2rem;
    font-style: italic;
}
```

---

## 安全考虑

### 1. 数据备份
- 切换数据库前自动保存当前数据库
- 建议定期备份所有数据库文件
- 可考虑添加自动备份功能

### 2. 文件验证
- 严格验证数据库文件名格式
- 防止路径遍历攻击（/../）
- 限制文件大小和数量

### 3. 删除确认
- 两次确认机制
- 不允许删除当前正在使用的数据库
- 提供数据导出功能（未来扩展）

---

## 用户体验优化

### 1. 智能提示
- 显示每个数据库的统计信息
- 显示最后使用时间
- 当前数据库高亮显示

### 2. 快速切换
- 按最后使用时间排序
- 支持搜索/筛选（未来扩展）
- 提供最近使用列表（未来扩展）

### 3. 错误处理
- 数据库文件损坏时的友好提示
- 切换失败时的回滚机制
- 详细的错误日志

---

## 未来扩展

### 1. 数据导入导出
- 导出数据库为 JSON
- 从 JSON 导入数据
- 数据库合并功能

### 2. 云同步
- 支持同步到云存储
- 多设备数据同步
- 冲突解决机制

### 3. 数据库模板
- 预设数据库模板
- 快速创建特定类型的工作空间

### 4. 权限管理
- 数据库级别的访问控制
- 只读模式
- 密码保护（可选）

---

## 实施计划

### Phase 1: 核心功能（当前版本）
- ✅ 多数据库文件支持
- ✅ 数据库切换
- ✅ 创建新数据库
- ✅ 重命名数据库
- ✅ 删除数据库

### Phase 2: 体验优化（下一版本）
- 搜索和筛选
- 数据库备份功能
- 最近使用快速访问
- 数据统计详情

### Phase 3: 高级功能（未来）
- 数据导入导出
- 云同步
- 数据库模板
- 权限管理
