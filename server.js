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
          COUNT(DISTINCT p.id) as project_count,
          COUNT(t.id) as task_count,
          SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) as done_count
        FROM categories c
        LEFT JOIN projects p ON c.id = p.category_id
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

  // 创建分类（自动创建默认项目"杂"）
  app.post('/api/categories', (req, res) => {
    try {
      const { name, description } = req.body;
      const result = run(`
        INSERT INTO categories (name, description) VALUES (?, ?)
      `, [name, description]);
      
      const categoryId = result.lastInsertRowid;
      
      // 创建默认项目"杂"
      run(`
        INSERT INTO projects (name, description, category_id, is_default) 
        VALUES ('杂', '默认项目，用于未明确归类的任务', ?, 1)
      `, [categoryId]);
      
      res.json({ id: categoryId, name, description });
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
      // 级联删除会自动删除所有项目和事项
      run('DELETE FROM categories WHERE id = ?', [id]);
      res.json({ success: true });
    } catch (error) {
      console.error('Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // 获取分类下的所有项目
  app.get('/api/categories/:id/projects', (req, res) => {
    try {
      const { id } = req.params;
      const projects = query(`
        SELECT p.*, 
          COUNT(t.id) as task_count,
          SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) as done_count
        FROM projects p
        LEFT JOIN tasks t ON p.id = t.project_id
        WHERE p.category_id = ?
        GROUP BY p.id
        ORDER BY p.is_default DESC, p.created_at
      `, [id]);
      
      res.json(projects);
    } catch (error) {
      console.error('Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // 获取分类下的所有事项（包含所有项目）
  app.get('/api/categories/:id/tasks', (req, res) => {
    try {
      const { id } = req.params;
      const tasks = query(`
        SELECT t.*, p.name as project_name, c.name as category_name 
        FROM tasks t
        LEFT JOIN projects p ON t.project_id = p.id
        LEFT JOIN categories c ON t.category_id = c.id
        WHERE t.category_id = ?
        ORDER BY p.name, t.priority, t.created_at DESC
      `, [id]);
      
      res.json(tasks);
    } catch (error) {
      console.error('Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============ 项目相关API ============

  // 获取所有项目
  app.get('/api/projects', (req, res) => {
    try {
      const projects = query(`
        SELECT p.*, c.name as category_name,
          COUNT(t.id) as task_count,
          SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) as done_count
        FROM projects p
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN tasks t ON p.id = t.project_id
        GROUP BY p.id
        ORDER BY c.name, p.is_default DESC, p.created_at
      `);
      
      res.json(projects);
    } catch (error) {
      console.error('Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // 获取单个项目详情
  app.get('/api/projects/:id', (req, res) => {
    try {
      const { id } = req.params;
      const project = get(`
        SELECT p.*, c.name as category_name,
          COUNT(t.id) as task_count,
          SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) as done_count
        FROM projects p
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN tasks t ON p.id = t.project_id
        WHERE p.id = ?
        GROUP BY p.id
      `, [id]);
      
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      res.json(project);
    } catch (error) {
      console.error('Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // 创建项目
  app.post('/api/projects', (req, res) => {
    try {
      const { name, description, category_id } = req.body;
      
      if (!category_id) {
        return res.status(400).json({ error: 'category_id is required' });
      }
      
      const result = run(`
        INSERT INTO projects (name, description, category_id, is_default)
        VALUES (?, ?, ?, 0)
      `, [name, description, category_id]);
      
      res.json({ id: result.lastInsertRowid, name, description, category_id, is_default: false });
    } catch (error) {
      console.error('Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // 更新项目
  app.put('/api/projects/:id', (req, res) => {
    try {
      const { id } = req.params;
      const { name, description } = req.body;
      
      run(`
        UPDATE projects 
        SET name = ?, description = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `, [name, description, id]);
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // 删除项目（默认项目不可删除，删除时将事项移至默认项目）
  app.delete('/api/projects/:id', (req, res) => {
    try {
      const { id } = req.params;
      
      // 检查是否为默认项目
      const project = get('SELECT * FROM projects WHERE id = ?', [id]);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      if (project.is_default) {
        return res.status(400).json({ error: 'Cannot delete default project' });
      }
      
      // 获取该分类的默认项目
      const defaultProject = get(`
        SELECT id FROM projects 
        WHERE category_id = ? AND is_default = 1
      `, [project.category_id]);
      
      if (defaultProject) {
        // 将事项转移到默认项目
        run(`
          UPDATE tasks 
          SET project_id = ?, updated_at = CURRENT_TIMESTAMP 
          WHERE project_id = ?
        `, [defaultProject.id, id]);
      }
      
      // 删除项目
      run('DELETE FROM projects WHERE id = ?', [id]);
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // 获取项目下的所有事项
  app.get('/api/projects/:id/tasks', (req, res) => {
    try {
      const { id } = req.params;
      const tasks = query(`
        SELECT t.*, c.name as category_name, p.name as project_name
        FROM tasks t
        LEFT JOIN categories c ON t.category_id = c.id
        LEFT JOIN projects p ON t.project_id = p.id
        WHERE t.project_id = ?
        ORDER BY t.priority, t.created_at DESC
      `, [id]);
      
      res.json(tasks);
    } catch (error) {
      console.error('Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============ 事项相关API ============

  // 获取事项列表（支持过滤）
  app.get('/api/tasks', (req, res) => {
    try {
      const { category_id, project_id, week_number, status } = req.query;
      let sql = `
        SELECT t.*, c.name as category_name, p.name as project_name
        FROM tasks t
        LEFT JOIN categories c ON t.category_id = c.id
        LEFT JOIN projects p ON t.project_id = p.id
        WHERE 1=1
      `;
      const params = [];
      
      if (category_id) {
        sql += ' AND t.category_id = ?';
        params.push(category_id);
      }
      if (project_id) {
        sql += ' AND t.project_id = ?';
        params.push(project_id);
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
        SELECT t.*, c.name as category_name, p.name as project_name
        FROM tasks t
        LEFT JOIN categories c ON t.category_id = c.id
        LEFT JOIN projects p ON t.project_id = p.id
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
      const { title, description, category_id, project_id, priority, status, progress, week_number } = req.body;
      
      // 如果没有指定project_id，获取该分类的默认项目
      let finalProjectId = project_id;
      if (!finalProjectId && category_id) {
        const defaultProject = get(`
          SELECT id FROM projects 
          WHERE category_id = ? AND is_default = 1
        `, [category_id]);
        
        if (defaultProject) {
          finalProjectId = defaultProject.id;
        }
      }
      
      if (!finalProjectId) {
        return res.status(400).json({ error: 'project_id is required or category must have a default project' });
      }
      
      const result = run(`
        INSERT INTO tasks (title, description, category_id, project_id, priority, status, progress, week_number)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [title, description, category_id, finalProjectId, priority || 'p2', status || 'todo', progress || 0, week_number]);
      
      res.json({ id: result.lastInsertRowid, ...req.body, project_id: finalProjectId });
    } catch (error) {
      console.error('Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // 更新事项
  app.put('/api/tasks/:id', (req, res) => {
    try {
      const { id } = req.params;
      const { title, description, category_id, project_id, priority, status, progress, week_number } = req.body;
      
      run(`
        UPDATE tasks 
        SET title = ?, description = ?, category_id = ?, project_id = ?, priority = ?, 
            status = ?, progress = ?, week_number = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [title, description, category_id, project_id, priority, status, progress, week_number, id]);
      
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
        SELECT t.*, c.name as category_name, p.name as project_name
        FROM tasks t
        LEFT JOIN categories c ON t.category_id = c.id
        LEFT JOIN projects p ON t.project_id = p.id
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
      
      // 获取本周完成的事项（按分类和项目）
      const doneTasksByCategory = query(`
        SELECT c.name as category_name, p.name as project_name, 
               t.title, t.description, t.progress
        FROM tasks t
        JOIN categories c ON t.category_id = c.id
        LEFT JOIN projects p ON t.project_id = p.id
        WHERE t.week_number = ? AND t.status = 'done'
        ORDER BY c.name, p.name, t.priority
      `, [weekNumber]);
      
      // 获取本周新增的事项
      const addedTasks = query(`
        SELECT t.title, t.description, c.name as category_name, p.name as project_name
        FROM tasks t
        LEFT JOIN categories c ON t.category_id = c.id
        LEFT JOIN projects p ON t.project_id = p.id
        WHERE t.week_number = ? AND DATE(t.created_at) >= DATE('now', 'weekday 0', '-6 days')
        ORDER BY t.priority
      `, [weekNumber]);
      
      // 获取进行中的事项
      const inProgressTasks = query(`
        SELECT t.title, t.description, t.progress, 
               c.name as category_name, p.name as project_name
        FROM tasks t
        LEFT JOIN categories c ON t.category_id = c.id
        LEFT JOIN projects p ON t.project_id = p.id
        WHERE t.week_number = ? AND t.status = 'doing'
        ORDER BY t.priority
      `, [weekNumber]);
      
      // 获取backlog
      const backlogTasks = query(`
        SELECT t.title, t.description, c.name as category_name, p.name as project_name
        FROM tasks t
        LEFT JOIN categories c ON t.category_id = c.id
        LEFT JOIN projects p ON t.project_id = p.id
        WHERE t.status = 'backlog'
        ORDER BY c.name, p.name, t.priority
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
