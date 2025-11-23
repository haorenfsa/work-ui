const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

let db = null;
const dbPath = path.join(__dirname, 'data.db');

// 初始化数据库
async function setupDatabase() {
  const SQL = await initSqlJs();
  
  // 尝试加载已有数据库
  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }
  
  return db;
}

// 保存数据库到文件
function saveDatabase() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
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

// 初始化默认分类数据
function initDefaultData() {
  const categories = [
    { name: 'BYOC', description: 'Bring Your Own Cloud 相关事项' },
    { name: '跨云能力', description: '跨云部署和管理能力' },
    { name: 'infra架构优化', description: '基础架构优化' },
    { name: 'gateway', description: 'Gateway 网关相关' },
    { name: '网络', description: '网络相关问题和优化' },
    { name: '运维自动化', description: '运维和自动化工具' },
    { name: '开源', description: '开源项目维护' }
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

module.exports = {
  setupDatabase,
  saveDatabase,
  initDatabase,
  initDefaultData,
  query,
  run,
  get,
  getDb: () => db
};
