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
  - 该分类下的项目总数（包含默认的"杂"项目）
  - 该分类下的任务总数
  - 该分类下的完成进度统计
- 注意：每个分类创建时会自动创建一个名为"杂"的默认项目，用于存放未明确归类的任务

### 2. 分类详情视图 (Category Detail)
- 点击分类进入该分类的详细视图
- 包含两个Tab页签：
  
#### Tab 1: 分类项目视图 (Category Projects)
- 展示该分类下的所有项目
- 每个项目显示：
  - 项目名称
  - 项目描述
  - 该项目下的任务总数
  - 该项目下的完成进度统计
  - 创建时间
- 支持：
  - 添加新项目
  - 修改项目信息
  - 删除项目
  - 点击项目进入项目详情视图

#### Tab 2: 分类事项总览 (Category Tasks Overview)
- 展示该分类下所有项目的事项汇总
- 按项目分组显示事项
- 每个事项显示：
  - 事项标题
  - 所属项目
  - 优先级（p0/p1/p2）
  - 状态（todo/doing/done/backlog）
  - 进度百分比
  - 计划执行周次
  - 简要描述
- 支持：
  - 快速添加事项（默认添加到"杂"项目）
  - 点击事项查看/编辑详情
  - 按项目筛选事项
  - 按状态/优先级筛选

### 3. 项目详情视图 (Project Detail)
- 点击项目进入该项目的详细视图
- 显示项目基本信息：
  - 项目名称
  - 所属分类
  - 项目描述
  - 创建时间
- 展示该项目下的所有事项
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
  - 编辑项目信息

### 4. 每周视图 (Weekly View)
- 以日历形式展示周视图（周一到周日）
- 显示当前周编号（如：wk47）
- 支持切换上一周/下一周
- 展示本周计划的所有事项：
  - 按优先级分组（p0 > p1 > p2）
  - 显示事项标题、所属分类、所属项目（如有）、状态、进度
  - 快速标记完成/更新进度
- 统计数据：
  - 本周总任务数
  - 已完成数
  - 进行中数
  - 完成率

### 5. 事项详情弹窗 (Task Modal)
- 点击任何事项打开详情弹窗
- 可编辑的字段：
  - 标题
  - 详细描述（支持多行文本）
  - 所属分类
  - 所属项目（必填，默认选择当前分类的"杂"项目）
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

### 6. 周报生成视图 (Weekly Report)
- 根据 wk47.md 的格式自动生成周报
- 包含以下部分：
  - 本周进展（按分类和项目整理完成的事项）
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

#### projects (项目表)
- id: INTEGER PRIMARY KEY
- name: TEXT (项目名称)
- description: TEXT (项目描述)
- category_id: INTEGER (外键，关联分类)
- is_default: BOOLEAN (是否为默认项目，即"杂"项目，默认为false)
- created_at: DATETIME
- updated_at: DATETIME

#### tasks (事项表)
- id: INTEGER PRIMARY KEY
- title: TEXT (标题)
- description: TEXT (详细描述)
- category_id: INTEGER (外键，关联分类)
- project_id: INTEGER (外键，关联项目，NOT NULL，必须归属于某个项目)
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
- 支持拖拽排序（分类、项目和事项）
- 实时保存（防止数据丢失）
- 操作确认提示（删除等危险操作）
- 加载状态提示
- 面包屑导航（分类 > 项目 > 事项）

### 样式风格
- 简洁现代的扁平化设计
- 使用清晰的视觉层级
- 优先级用颜色区分（p0-红色、p1-橙色、p2-蓝色）
- 状态用图标或标签表示

## API接口设计

### 分类相关
- GET /api/categories - 获取所有分类
- POST /api/categories - 创建分类（自动创建默认"杂"项目）
- PUT /api/categories/:id - 更新分类
- DELETE /api/categories/:id - 删除分类（级联删除所有项目和事项）
- GET /api/categories/:id/projects - 获取分类下的所有项目
- GET /api/categories/:id/tasks - 获取分类下的所有事项（包含所有项目）

### 项目相关
- GET /api/projects - 获取所有项目
- GET /api/projects/:id - 获取单个项目详情
- POST /api/projects - 创建项目
- PUT /api/projects/:id - 更新项目（默认项目"杂"不允许删除但可以重命名）
- DELETE /api/projects/:id - 删除项目（默认项目不可删除，删除时将事项移至默认项目）
- GET /api/projects/:id/tasks - 获取项目下的所有事项

### 事项相关
- GET /api/tasks - 获取所有事项（支持按分类、项目、周次、状态过滤）
- GET /api/tasks/:id - 获取单个事项详情
- POST /api/tasks - 创建事项
- PUT /api/tasks/:id - 更新事项
- DELETE /api/tasks/:id - 删除事项
- GET /api/tasks/week/:weekNumber - 获取指定周的事项

### 周报相关
- GET /api/weekly-report/:weekNumber - 生成指定周的周报
- POST /api/weekly-logs - 记录周日志

## 实现注意事项

### 默认项目处理
1. 创建分类时自动创建名为"杂"的默认项目（is_default=true）
2. 默认项目不可删除，但可以重命名
3. 删除非默认项目时，将该项目下的所有事项转移到默认项目
4. 每个分类有且仅有一个默认项目
5. 创建事项时，如果未指定项目，自动关联到当前分类的默认项目

### 数据完整性
- 所有task必须有project_id（数据库约束：NOT NULL）
- 删除分类时级联删除所有项目和事项
- 删除项目时将事项转移到默认项目，而不是级联删除

## 下一步
1. 搭建基础项目结构
2. 实现数据库和后端API（包含默认项目的自动创建和保护逻辑）
3. 实现前端UI界面
4. 数据导入功能（将现有wk47.md数据导入系统）
