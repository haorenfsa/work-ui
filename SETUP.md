# 项目管理系统 - 启动指南

## 前提条件

系统需要安装 Node.js (推荐 v16 或更高版本)

### 安装 Node.js (macOS)

使用 Homebrew 安装：
```bash
brew install node
```

或从官网下载安装：https://nodejs.org/

## 启动步骤

### 1. 安装依赖

在 `ui/` 目录下执行：
```bash
cd /Users/zilliz/Desktop/workspace/plan/ui
npm install
```

### 2. 启动服务器

```bash
npm start
```

服务器将在 http://localhost:3000 启动

### 3. 访问系统

打开浏览器访问：http://localhost:3000

## 开发模式

如果需要开发时自动重启服务器：
```bash
npm run dev
```

## 系统功能

### ✅ 已实现功能

1. **分类管理**
   - 查看所有分类及统计信息
   - 创建、编辑、删除分类
   - 每个分类显示任务数量和完成率

2. **事项管理**
   - 查看分类下的所有事项
   - 创建、编辑、删除事项
   - 支持优先级（p0/p1/p2）
   - 支持状态（待办/进行中/已完成/Backlog）
   - 进度跟踪（0-100%）
   - 计划周次设置

3. **每周视图**
   - 按周查看任务
   - 切换上一周/下一周
   - 按优先级分组显示
   - 周统计数据（总数、完成数、进行中、完成率）

4. **周报生成**
   - 选择周次自动生成周报
   - Markdown 格式
   - 按分类整理完成事项
   - 显示新增需求、进行中和 Backlog
   - 一键复制到剪贴板
   - 下载为 .md 文件

### 界面特色

- 🎨 现代化扁平设计
- 📱 响应式布局
- 🎯 优先级颜色区分（P0-红色、P1-橙色、P2-蓝色）
- 🔄 实时数据更新
- ⚡ 流畅的交互体验

## 数据库

系统使用 SQLite 数据库，数据文件位于 `ui/data.db`

首次启动时会自动创建数据库并初始化默认分类：
- BYOC
- 跨云能力
- infra架构优化
- gateway
- 网络
- 运维自动化
- 开源

## 项目结构

```
ui/
├── server.js              # 后端 Express 服务器
├── database.js            # 数据库配置和初始化
├── package.json           # 项目配置
├── README.md             # 项目说明
├── data.db               # SQLite 数据库（自动生成）
└── public/               # 前端静态文件
    ├── index.html        # 主页面
    ├── css/
    │   └── style.css     # 样式文件
    └── js/
        └── app.js        # 前端逻辑

```

## API 接口

完整的 REST API 已实现：

### 分类相关
- `GET /api/categories` - 获取所有分类
- `POST /api/categories` - 创建分类
- `PUT /api/categories/:id` - 更新分类
- `DELETE /api/categories/:id` - 删除分类

### 事项相关
- `GET /api/tasks` - 获取所有事项（支持过滤）
- `GET /api/tasks/:id` - 获取单个事项
- `POST /api/tasks` - 创建事项
- `PUT /api/tasks/:id` - 更新事项
- `DELETE /api/tasks/:id` - 删除事项
- `GET /api/tasks/week/:weekNumber` - 获取指定周的事项

### 周报相关
- `GET /api/weekly-report/:weekNumber` - 生成指定周的周报
- `POST /api/weekly-logs` - 记录周日志

## 使用建议

1. **初次使用**：系统会自动创建默认分类，你可以直接开始创建事项

2. **计划周次**：建议为每个事项设置计划执行的周次，这样在每周视图中可以更好地管理任务

3. **进度跟踪**：及时更新事项的进度和状态，系统会自动统计完成率

4. **周报生成**：每周结束时，在周报生成视图选择对应周次，即可自动生成格式化的周报

## 故障排查

### 端口被占用
如果 3000 端口被占用，可以修改 `server.js` 中的 PORT 变量

### 数据库错误
删除 `data.db` 文件，重启服务器会自动重新创建

### 依赖安装失败
尝试清除缓存后重新安装：
```bash
rm -rf node_modules package-lock.json
npm install
```
