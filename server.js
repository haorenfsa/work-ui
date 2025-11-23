const express = require('express');
const cors = require('cors');
const path = require('path');
const { setupDatabase, initDatabase, initDefaultData, query, run, get } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 初始化数据库并启动服务器
async function startServer() {
  await setupDatabase();
  initDatabase();
  initDefaultData();

  // ============ 分类相关API ============

  // 获取所有分类
  app.get('/api/categories', (req, res) => {
    try {
      const categories = query(`
        SELECT c.*, 
          COUNT(t.id) as task_count,
          SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) as done_count
        FROM categories c
        LEFT JOIN tasks t ON c.id = t.category_id
        GROUP BY c.id
        ORDER BY c.name
      `);
      
      res.json(categories);
    } catch (error) {
      console.error('Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // 创建分类
  app.post('/api/categories', (req, res) => {
    try {
      const { name, description } = req.body;
      const result = run(`
        INSERT INTO categories (name, description) VALUES (?, ?)
      `, [name, description]);
      
      res.json({ id: result.lastInsertRowid, name, description });
    } catch (error) {
      console.error('Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // 更新分类
  app.put('/api/categories/:id', (req, res) => {
    try {
      const { id } = req.params;
      const { name, description } = req.body;
      
      run(`
        UPDATE categories 
        SET name = ?, description = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `, [name, description, id]);
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // 删除分类
  app.delete('/api/categories/:id', (req, res) => {
    try {
      const { id } = req.params;
      run('DELETE FROM categories WHERE id = ?', [id]);
      res.json({ success: true });
    } catch (error) {
      console.error('Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============ 事项相关API ============

  // 获取事项列表（支持过滤）
  app.get('/api/tasks', (req, res) => {
    try {
      const { category_id, week_number, status } = req.query;
      let sql = `
        SELECT t.*, c.name as category_name 
        FROM tasks t
        LEFT JOIN categories c ON t.category_id = c.id
        WHERE 1=1
      `;
      const params = [];
      
      if (category_id) {
        sql += ' AND t.category_id = ?';
        params.push(category_id);
      }
      if (week_number) {
        sql += ' AND t.week_number = ?';
        params.push(week_number);
      }
      if (status) {
        sql += ' AND t.status = ?';
        params.push(status);
      }
      
      sql += ' ORDER BY t.priority, t.created_at DESC';
      
      const tasks = query(sql, params);
      res.json(tasks);
    } catch (error) {
      console.error('Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // 获取单个事项
  app.get('/api/tasks/:id', (req, res) => {
    try {
      const { id } = req.params;
      const task = get(`
        SELECT t.*, c.name as category_name 
        FROM tasks t
        LEFT JOIN categories c ON t.category_id = c.id
        WHERE t.id = ?
      `, [id]);
      
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }
      
      res.json(task);
    } catch (error) {
      console.error('Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // 创建事项
  app.post('/api/tasks', (req, res) => {
    try {
      const { title, description, category_id, priority, status, progress, week_number } = req.body;
      
      const result = run(`
        INSERT INTO tasks (title, description, category_id, priority, status, progress, week_number)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [title, description, category_id, priority || 'p2', status || 'todo', progress || 0, week_number]);
      
      res.json({ id: result.lastInsertRowid, ...req.body });
    } catch (error) {
      console.error('Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // 更新事项
  app.put('/api/tasks/:id', (req, res) => {
    try {
      const { id } = req.params;
      const { title, description, category_id, priority, status, progress, week_number } = req.body;
      
      run(`
        UPDATE tasks 
        SET title = ?, description = ?, category_id = ?, priority = ?, 
            status = ?, progress = ?, week_number = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [title, description, category_id, priority, status, progress, week_number, id]);
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // 删除事项
  app.delete('/api/tasks/:id', (req, res) => {
    try {
      const { id } = req.params;
      run('DELETE FROM tasks WHERE id = ?', [id]);
      res.json({ success: true });
    } catch (error) {
      console.error('Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // 获取指定周的事项
  app.get('/api/tasks/week/:weekNumber', (req, res) => {
    try {
      const { weekNumber } = req.params;
      const tasks = query(`
        SELECT t.*, c.name as category_name 
        FROM tasks t
        LEFT JOIN categories c ON t.category_id = c.id
        WHERE t.week_number = ?
        ORDER BY 
          CASE t.priority 
            WHEN 'p0' THEN 1 
            WHEN 'p1' THEN 2 
            WHEN 'p2' THEN 3 
          END,
          t.created_at DESC
      `, [weekNumber]);
      
      res.json(tasks);
    } catch (error) {
      console.error('Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============ 周报相关API ============

  // 生成周报
  app.get('/api/weekly-report/:weekNumber', (req, res) => {
    try {
      const { weekNumber } = req.params;
      
      // 获取本周完成的事项（按分类）
      const doneTasksByCategory = query(`
        SELECT c.name as category_name, t.title, t.description, t.progress
        FROM tasks t
        JOIN categories c ON t.category_id = c.id
        WHERE t.week_number = ? AND t.status = 'done'
        ORDER BY c.name, t.priority
      `, [weekNumber]);
      
      // 获取本周新增的事项
      const addedTasks = query(`
        SELECT t.title, t.description, c.name as category_name
        FROM tasks t
        LEFT JOIN categories c ON t.category_id = c.id
        WHERE t.week_number = ? AND DATE(t.created_at) >= DATE('now', 'weekday 0', '-6 days')
        ORDER BY t.priority
      `, [weekNumber]);
      
      // 获取进行中的事项
      const inProgressTasks = query(`
        SELECT t.title, t.description, t.progress, c.name as category_name
        FROM tasks t
        LEFT JOIN categories c ON t.category_id = c.id
        WHERE t.week_number = ? AND t.status = 'doing'
        ORDER BY t.priority
      `, [weekNumber]);
      
      // 获取backlog
      const backlogTasks = query(`
        SELECT t.title, t.description, c.name as category_name
        FROM tasks t
        LEFT JOIN categories c ON t.category_id = c.id
        WHERE t.status = 'backlog'
        ORDER BY c.name, t.priority
      `);
      
      res.json({
        weekNumber,
        doneTasksByCategory,
        addedTasks,
        inProgressTasks,
        backlogTasks
      });
    } catch (error) {
      console.error('Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // 记录周日志
  app.post('/api/weekly-logs', (req, res) => {
    try {
      const { week_number, task_id, log_type, content, log_date } = req.body;
      
      const result = run(`
        INSERT INTO weekly_logs (week_number, task_id, log_type, content, log_date)
        VALUES (?, ?, ?, ?, ?)
      `, [week_number, task_id, log_type, content, log_date]);
      
      res.json({ id: result.lastInsertRowid, ...req.body });
    } catch (error) {
      console.error('Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // 启动服务器
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}

// 启动
startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
