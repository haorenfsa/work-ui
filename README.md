# 项目管理系统

一个基于 Node.js + SQLite + 原生前端的轻量级项目管理系统。

## 功能特性

- 分类管理：创建、编辑、删除项目分类
- 事项管理：完整的任务CRUD操作，支持优先级、状态、进度跟踪
- 周视图：以周为单位查看和管理任务
- 周报生成：自动生成 Markdown 格式的周报

## 技术栈

- 后端：Node.js + Express
- 数据库：SQLite (better-sqlite3)
- 前端：HTML + CSS + JavaScript（原生实现）

## 安装和运行

1. 安装依赖：
```bash
npm install
```

2. 启动服务：
```bash
npm start
```

3. 开发模式（自动重启）：
```bash
npm run dev
```

4. 访问系统：
打开浏览器访问 http://localhost:3000

## 项目结构

```
ui/
├── server.js          # 后端服务器
├── database.js        # 数据库初始化和配置
├── package.json       # 项目配置
├── public/            # 前端静态文件
│   ├── index.html    # 主页面
│   ├── css/
│   │   └── style.css # 样式文件
│   └── js/
│       └── app.js    # 前端逻辑
└── data.db           # SQLite 数据库文件（自动生成）
```

## 数据库设计

- **categories**: 分类表
- **tasks**: 事项表
- **weekly_logs**: 周记录表

详细设计请参考 design.md
