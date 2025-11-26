const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

// 配置文件路径
const CONFIG_PATH = path.join(__dirname, 'db-config.json');

let db = null;
let currentDbPath = null;
let dbConfig = null;

// 加载数据库配置
function loadConfig() {
  if (fs.existsSync(CONFIG_PATH)) {
    const content = fs.readFileSync(CONFIG_PATH, 'utf-8');
    dbConfig = JSON.parse(content);
  } else {
    // 初始化默认配置
    dbConfig = {
      currentDb: 'data.db',
      databases: {
        'data.db': {
          displayName: '主工作空间',
          description: '日常工作任务管理',
          filePath: 'data.db',
          createdAt: new Date().toISOString(),
          lastUsed: new Date().toISOString()
        },
        'personal.db': {
          displayName: '个人空间',
          description: '个人事务管理',
          filePath: 'personal.db',
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
        currentDbName;
}

// 初始化数据库
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

// 保存数据库到文件
function saveDatabase() {
  if (db && currentDbPath) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(currentDbPath, buffer);
  }
}

// 创建表结构
function initDatabase() {
  // 分类表
  db.run(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 项目表
  db.run(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      category_id INTEGER NOT NULL,
      is_default BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
    )
  `);

  // 事项表
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
      week_number INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    )
  `);

  // 周记录表
  db.run(`
    CREATE TABLE IF NOT EXISTS weekly_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      week_number INTEGER NOT NULL,
      task_id INTEGER,
      log_type TEXT CHECK(log_type IN ('added', 'progress', 'done')) NOT NULL,
      content TEXT,
      log_date DATE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    )
  `);

  // 创建索引
  db.run(`CREATE INDEX IF NOT EXISTS idx_projects_category ON projects(category_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_tasks_category ON tasks(category_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_tasks_week ON tasks(week_number)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_weekly_logs_week ON weekly_logs(week_number)`);

  saveDatabase();
  console.log('Database initialized successfully');
}

// 初始化数据
function initDefaultData() {
  const categories = [
    { name: 'default', description: 'default example' },
  ];

  for (const cat of categories) {
    try {
      db.run(`INSERT OR IGNORE INTO categories (name, description) VALUES (?, ?)`, 
        [cat.name, cat.description]);
      
      // 为每个分类创建默认项目"杂"
      const categoryResult = db.exec(`SELECT id FROM categories WHERE name = ?`, [cat.name]);
      if (categoryResult.length > 0 && categoryResult[0].values.length > 0) {
        const categoryId = categoryResult[0].values[0][0];
        db.run(`INSERT OR IGNORE INTO projects (name, description, category_id, is_default) 
                SELECT '杂', '默认项目，用于未明确归类的任务', ?, 1
                WHERE NOT EXISTS (SELECT 1 FROM projects WHERE category_id = ? AND is_default = 1)`, 
          [categoryId, categoryId]);
      }
    } catch (e) {
      // 忽略重复插入错误
      console.error('Error inserting default data:', e);
    }
  }
  
  saveDatabase();
  console.log('Default categories and projects inserted');
}

// 辅助函数：执行查询
function query(sql, params = []) {
  if (!db) throw new Error('Database not initialized');
  const stmt = db.prepare(sql);
  stmt.bind(params);
  
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

// 辅助函数：执行插入/更新/删除
function run(sql, params = []) {
  if (!db) throw new Error('Database not initialized');
  db.run(sql, params);
  saveDatabase();
  return { lastInsertRowid: db.exec("SELECT last_insert_rowid() as id")[0].values[0][0] };
}

// 辅助函数：获取单行
function get(sql, params = []) {
  const results = query(sql, params);
  return results[0] || null;
}

// ============ 数据库管理功能 ============

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
  
  const filePath = dbName;
  
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
      try {
        const result = query(`
          SELECT 
            (SELECT COUNT(*) FROM categories) as categories,
            (SELECT COUNT(*) FROM projects) as projects,
            (SELECT COUNT(*) FROM tasks) as tasks
        `);
        if (result.length > 0) {
          stats = result[0];
        }
      } catch (e) {
        console.error(`Error reading stats for current db:`, e);
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

// 获取当前数据库信息
function getCurrentDbInfo() {
  if (!dbConfig || !dbConfig.currentDb) {
    return null;
  }
  return {
    name: dbConfig.currentDb,
    ...dbConfig.databases[dbConfig.currentDb]
  };
}

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
  getCurrentDbInfo
};
