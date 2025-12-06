# 项目管理系统增量设计 v0.5.3

## 新增功能：未完成事项批量移动到下一周

### 功能概述
在顶部导航栏「快速添加」按钮旁边添加「未完成到下一周」按钮，点击后扫描所有未完成的事项（状态为 todo, doing, backlog），将它们的周次更新为实时日期的下一周。

### 使用场景
- **周末计划调整**: 周末时将本周未完成的事项批量移到下一周
- **任务延期管理**: 快速处理大量延期任务
- **周计划更新**: 便捷更新周计划安排

---

## 功能设计

### 1. UI 设计

#### 按钮位置
在顶部导航栏左侧区域，「快速添加」按钮旁边添加新按钮：

```html
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
    <!-- 新增按钮 -->
    <button class="btn-move-next-week" onclick="app.moveUnfinishedToNextWeek()">
        <span class="icon">⏩</span>
        <span>未完成到下一周</span>
    </button>
</div>
```

#### 按钮样式
- 使用图标 ⏩ 表示"快进到下一周"
- 颜色使用橙色系，表示警告/提醒操作
- hover 时有提示效果

---

## 功能逻辑

### 1. 扫描规则
- **扫描范围**: 所有数据库中的事项
- **过滤条件**: 
  - 状态为 `todo`（待办）、`doing`（进行中）或 `backlog`（待办）
  - 状态不为 `done`（已完成）
- **更新字段**: `week_number` 更新为下一周周次

### 2. 下一周计算
```javascript
getNextWeekNumber() {
    const currentWeek = this.getCurrentWeekNumber();
    return currentWeek + 1;
}
```

### 3. 操作流程
1. 用户点击「未完成到下一周」按钮
2. 弹出确认对话框，显示将要移动的事项数量
3. 用户确认后，调用 API 批量更新
4. 显示成功提示
5. 刷新当前视图

### 4. 确认对话框
```javascript
async moveUnfinishedToNextWeek() {
    const nextWeek = this.getNextWeekNumber();
    
    // 先获取未完成事项数量
    const response = await fetch(`${API_BASE}/tasks/unfinished/count`);
    const { count } = await response.json();
    
    if (count === 0) {
        alert('没有未完成的事项');
        return;
    }
    
    if (!confirm(`将 ${count} 个未完成的事项移动到 WK${nextWeek}？\n\n包括状态为「待办」、「进行中」和「Backlog」的事项。`)) {
        return;
    }
    
    // 执行批量更新
    // ...
}
```

---

## API 设计

### 1. 获取未完成事项数量
```
GET /api/tasks/unfinished/count
```

**响应**:
```json
{
    "count": 15
}
```

### 2. 批量更新未完成事项到指定周次
```
PUT /api/tasks/unfinished/move-to-week
```

**请求体**:
```json
{
    "weekNumber": 49
}
```

**响应**:
```json
{
    "updated": 15,
    "weekNumber": 49
}
```

**SQL 实现**:
```sql
UPDATE tasks 
SET week_number = ?
WHERE status IN ('todo', 'doing', 'backlog')
AND status != 'done'
```

---

## 实现清单

### 前端修改

#### 1. HTML (`public/index.html`)
- [ ] 在顶部导航栏添加「未完成到下一周」按钮

#### 2. CSS (`public/css/style.css`)
- [ ] 添加 `.btn-move-next-week` 样式
- [ ] 添加 hover 和 active 状态

#### 3. JavaScript (`public/js/app.js`)
- [ ] 实现 `getNextWeekNumber()` 方法
- [ ] 实现 `moveUnfinishedToNextWeek()` 方法

### 后端修改

#### 4. Server (`server.js`)
- [ ] 添加 `GET /api/tasks/unfinished/count` 路由
- [ ] 添加 `PUT /api/tasks/unfinished/move-to-week` 路由

---

## 测试场景

1. ✅ 点击按钮时，正确计算下一周周次
2. ✅ 显示正确的未完成事项数量
3. ✅ 批量更新成功后显示提示
4. ✅ 更新后刷新当前视图，显示最新数据
5. ✅ 没有未完成事项时显示提示
6. ✅ 取消操作时不执行更新
7. ✅ 更新完成后分类统计正确
8. ✅ 更新完成后每周视图正确

---

## 注意事项

1. **事项过滤**: 只移动未完成的事项（status != 'done'）
2. **周次计算**: 基于实时日期计算，不依赖当前视图周次
3. **用户确认**: 必须确认才执行，避免误操作
4. **视图刷新**: 更新后自动刷新当前视图
5. **成功提示**: 显示移动的事项数量

---

## 扩展功能（可选）

### 1. 显示待移动事项列表
在确认对话框中显示即将移动的事项列表，让用户更清楚操作内容。

### 2. 自定义目标周次
允许用户选择移动到哪一周，而不是固定下一周。

### 3. 按分类/项目筛选
支持只移动特定分类或项目的未完成事项。

### 4. 撤销功能
提供撤销功能，允许用户恢复刚才的批量移动操作。
