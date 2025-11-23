# 项目管理系统需求文档

## 技术栈
- 前端：HTML + JavaScript (原生实现，轻量化)
- 后端：Node.js + SQLite
- 部署：单机部署，简单易用

## 核心功能模块

### 1. 分类管理视图 (Category Management)
- 展示所有事项分类（如：BYOC、跨云能力、infra架构优化、gateway、网络、运维自动化、开源等）
- 支持分类的增删改
- 每个分类显示：
  - 分类名称
  - 该分类下的任务总数
  - 该分类下的完成进度统计

### 2. 单类事项视图 (Category Detail)
- 点击分类进入该分类的详细视图
- 展示该分类下的所有事项
- 每个事项显示：
  - 事项标题
  - 优先级（p0/p1/p2）
  - 状态（todo/doing/done/backlog）
  - 进度百分比
  - 计划执行周次
  - 简要描述
- 支持：
  - 添加新事项
  - 修改事项描述
  - 修改进度
  - 修改优先级和状态
  - 删除事项

### 3. 每周视图 (Weekly View)
- 以日历形式展示周视图（周一到周日）
- 显示当前周编号（如：wk47）
- 支持切换上一周/下一周
- 展示本周计划的所有事项：
  - 按优先级分组（p0 > p1 > p2）
  - 显示事项标题、分类、状态、进度
  - 快速标记完成/更新进度
- 统计数据：
  - 本周总任务数
  - 已完成数
  - 进行中数
  - 完成率

### 4. 事项详情弹窗 (Task Modal)
- 点击任何事项打开详情弹窗
- 可编辑的字段：
  - 标题
  - 详细描述（支持多行文本）
  - 所属分类
  - 优先级（p0/p1/p2）
  - 状态（todo/doing/done/backlog）
  - 进度百分比（0-100）
  - 计划执行周次（支持选择具体周）
  - 创建时间（自动记录）
  - 更新时间（自动记录）
- 操作按钮：
  - 保存
  - 取消
  - 删除

### 5. 周报生成视图 (Weekly Report)
- 根据 wk47.md 的格式自动生成周报
- 包含以下部分：
  - 本周进展（按分类整理完成的事项）
  - 本周新增需求
  - 进行中的事项
  - Backlog
  - 每日进展（可选）
- 支持导出为 Markdown 格式
- 支持一键复制到剪贴板

## 数据库设计

### 表结构

#### categories (分类表)
- id: INTEGER PRIMARY KEY
- name: TEXT (分类名称)
- description: TEXT (分类描述)
- created_at: DATETIME
- updated_at: DATETIME

#### tasks (事项表)
- id: INTEGER PRIMARY KEY
- title: TEXT (标题)
- description: TEXT (详细描述)
- category_id: INTEGER (外键)
- priority: TEXT (p0/p1/p2)
- status: TEXT (todo/doing/done/backlog)
- progress: INTEGER (0-100)
- week_number: INTEGER (计划执行周次，如47)
- created_at: DATETIME
- updated_at: DATETIME

#### weekly_logs (周记录表)
- id: INTEGER PRIMARY KEY
- week_number: INTEGER
- task_id: INTEGER (外键)
- log_type: TEXT (added/progress/done)
- content: TEXT (记录内容)
- log_date: DATE
- created_at: DATETIME

## UI界面要求

### 整体布局
- 顶部导航栏：切换不同视图（分类管理、每周视图、周报生成）
- 侧边栏：显示所有分类的快速入口
- 主内容区：展示当前选中视图的内容
- 响应式设计：支持桌面端浏览器

### 交互体验
- 使用模态框进行编辑操作
- 支持拖拽排序（分类和事项）
- 实时保存（防止数据丢失）
- 操作确认提示（删除等危险操作）
- 加载状态提示

### 样式风格
- 简洁现代的扁平化设计
- 使用清晰的视觉层级
- 优先级用颜色区分（p0-红色、p1-橙色、p2-蓝色）
- 状态用图标或标签表示

## API接口设计

### 分类相关
- GET /api/categories - 获取所有分类
- POST /api/categories - 创建分类
- PUT /api/categories/:id - 更新分类
- DELETE /api/categories/:id - 删除分类

### 事项相关
- GET /api/tasks - 获取所有事项（支持按分类、周次、状态过滤）
- GET /api/tasks/:id - 获取单个事项详情
- POST /api/tasks - 创建事项
- PUT /api/tasks/:id - 更新事项
- DELETE /api/tasks/:id - 删除事项
- GET /api/tasks/week/:weekNumber - 获取指定周的事项

### 周报相关
- GET /api/weekly-report/:weekNumber - 生成指定周的周报
- POST /api/weekly-logs - 记录周日志

## 下一步
1. 搭建基础项目结构
2. 实现数据库和后端API
3. 实现前端UI界面
4. 数据导入功能（将现有wk47.md数据导入系统）
