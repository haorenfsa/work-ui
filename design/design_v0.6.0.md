# 项目管理系统增量设计 v0.6.0

## 新增功能：事项支持每周重复

### 功能概述
为事项增加"每周重复"属性。设置为重复的事项，在执行"未完成到下一周"操作时，会在下一周创建一个相同的新事项（重置状态和进度），原事项保持不变。这样可以保留完整的历史记录，适合每周例行任务。

### 使用场景
- **每周例会**: 周一站会、周五复盘等固定会议
- **定期检查**: 代码审查、安全检查、数据备份检查
- **周期性任务**: 周报撰写、进度汇报、环境巡检
- **个人习惯**: 健身打卡、学习计划、周末整理

---

## 设计原则

1. **保留历史**: 每周的重复事项都是独立的记录，可追踪每周完成情况
2. **简单直观**: 用户只需勾选"每周重复"，无需理解复杂的模板概念
3. **最小改动**: 只增加标记字段，不改变现有数据结构和业务逻辑
4. **向后兼容**: 现有事项不受影响，默认为非重复事项

---

## 功能设计

### 1. 数据库变更

#### tasks 表增加字段

```sql
-- 是否为重复事项
ALTER TABLE tasks ADD COLUMN is_recurring INTEGER DEFAULT 0;

-- 重复事项备注（可选）
ALTER TABLE tasks ADD COLUMN recurring_note TEXT;
```

**字段说明**:
- `is_recurring`: 0=普通事项, 1=每周重复事项
- `recurring_note`: 重复备注，如"每周一例会"、"周报提醒"等，帮助用户记忆

---

### 2. UI 设计

#### 2.1 快速添加/编辑事项对话框

在现有表单中增加"每周重复"选项：

```html
<!-- 在进度和周次字段之后 -->
<div class="form-group">
    <label>
        <input type="checkbox" id="quickTaskRecurring" onchange="app.toggleRecurringNote()"> 
        🔄 每周重复
    </label>
    <small class="form-hint">勾选后，每次"未完成到下一周"时会在下周自动创建此事项</small>
</div>

<div class="form-group" id="recurringNoteGroup" style="display:none;">
    <label>重复备注（可选）</label>
    <input type="text" id="quickTaskRecurringNote" 
           placeholder="如：每周一例会、周报提醒等"
           maxlength="50">
    <small class="form-hint">帮助你快速识别这是什么重复任务</small>
</div>
```

**交互逻辑**:
- 勾选"每周重复"后，显示"重复备注"输入框
- 取消勾选后，隐藏"重复备注"输入框

---

#### 2.2 事项列表显示

在事项标题前增加重复标识：

```javascript
renderTaskItem(task) {
    const recurringIcon = task.is_recurring ? '🔄 ' : '';
    const recurringNote = task.is_recurring && task.recurring_note 
        ? `<span class="recurring-note">${task.recurring_note}</span>` 
        : '';
    
    return `
        <div class="task-item priority-${task.priority}" onclick="app.showQuickAddModal(${task.id})">
            <div class="task-item-header">
                <div class="task-item-title">
                    ${recurringIcon}${task.title}
                    ${recurringNote}
                </div>
                <!-- ... -->
            </div>
            <!-- ... -->
        </div>
    `;
}
```

**视觉效果**:
- 重复事项显示 🔄 图标
- 如果有备注，在标题旁显示灰色小字

---

### 3. 业务逻辑

#### 3.1 "未完成到下一周"功能升级

**核心变化**:
1. 普通事项（未完成）：移动到下一周（状态为 todo, doing, backlog）
2. 重复事项（所有状态）：在下一周创建副本，原事项保持不变
   - 包括已完成的重复事项，因为完成只是表示本周完成，下周还要继续
   - 普通已完成事项不移动

**前端逻辑**:

```javascript
async moveUnfinishedToNextWeek() {
    const nextWeek = this.getNextWeekNumber();
    
    try {
        // 1. 获取未完成事项统计（分普通和重复）
        const countResponse = await fetch(`${API_BASE}/tasks/unfinished/grouped-count`);
        const { normalCount, recurringCount } = await countResponse.json();
        
        const totalCount = normalCount + recurringCount;
        
        if (totalCount === 0) {
            alert('没有未完成的事项');
            return;
        }
        
        // 2. 显示详细确认信息
        let message = `将事项移动到 WK${nextWeek}？\n\n`;
        if (normalCount > 0) {
            message += `• 普通未完成事项 ${normalCount} 个：直接移动到下周\n`;
        }
        if (recurringCount > 0) {
            message += `• 重复事项 ${recurringCount} 个：在下周创建新副本（不管本周是否完成）\n`;
        }
        message += `\n共 ${totalCount} 个事项\n`;
        message += `\n注：已完成的普通事项不会被移动`;
        
        if (!confirm(message)) {
            return;
        }
        
        // 3. 执行批量操作
        const updateResponse = await fetch(`${API_BASE}/tasks/unfinished/move-to-week`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ weekNumber: nextWeek })
        });
        
        if (updateResponse.ok) {
            const result = await updateResponse.json();
            
            // 4. 显示成功信息
            let successMsg = `成功移动到 WK${nextWeek}！\n`;
            successMsg += `移动了 ${result.movedCount} 个普通事项，`;
            successMsg += `创建了 ${result.createdCount} 个重复事项副本`;
            
            this.showToast(successMsg, 'success');
            
            // 5. 刷新当前视图
            // ... 现有刷新逻辑 ...
        } else {
            const error = await updateResponse.json();
            alert('移动失败: ' + (error.error || '未知错误'));
        }
    } catch (error) {
        console.error('移动未完成事项失败:', error);
        alert('移动失败，请检查网络连接');
    }
}
```

---

### 4. API 设计

#### 4.1 获取分组的未完成事项数量

```
GET /api/tasks/unfinished/grouped-count
```

**响应**:
```json
{
    "normalCount": 8,
    "recurringCount": 5,
    "totalCount": 13
}
```

**实现**:
```javascript
app.get('/api/tasks/unfinished/grouped-count', (req, res) => {
    try {
        // 普通事项：只统计未完成的
        const normalResult = get(`
            SELECT COUNT(*) as count 
            FROM tasks 
            WHERE status IN ('todo', 'doing', 'backlog')
            AND (is_recurring = 0 OR is_recurring IS NULL)
        `);
        
        // 重复事项：统计所有状态（包括已完成），因为每周都要重复
        const recurringResult = get(`
            SELECT COUNT(*) as count 
            FROM tasks 
            WHERE is_recurring = 1
        `);        res.json({
            normalCount: normalResult.count,
            recurringCount: recurringResult.count,
            totalCount: normalResult.count + recurringResult.count
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
});
```

---

#### 4.2 批量移动未完成事项（含重复处理）

```
PUT /api/tasks/unfinished/move-to-week
```

**请求体**:
```json
{
    "weekNumber": 50
}
```

**响应**:
```json
{
    "movedCount": 8,
    "createdCount": 5,
    "weekNumber": 50
}
```

**实现**:
```javascript
app.put('/api/tasks/unfinished/move-to-week', (req, res) => {
    try {
        const { weekNumber } = req.body;
        
        if (!weekNumber) {
            return res.status(400).json({ error: 'weekNumber is required' });
        }
        
        // 1. 移动普通未完成事项
        const moveResult = run(`
            UPDATE tasks 
            SET week_number = ?, updated_at = CURRENT_TIMESTAMP
            WHERE status IN ('todo', 'doing', 'backlog')
            AND is_recurring = 0
        `, [weekNumber]);
        
      // 2. 获取所有重复事项（不限状态，包括已完成）
      const recurringTasks = query(`
        SELECT * FROM tasks 
        WHERE is_recurring = 1
      `);        // 3. 为每个重复事项创建下周副本
        let createdCount = 0;
        recurringTasks.forEach(task => {
            run(`
                INSERT INTO tasks (
                    title, description, category_id, project_id, 
                    priority, status, progress, week_number,
                    is_recurring, recurring_note
                ) VALUES (?, ?, ?, ?, ?, 'todo', 0, ?, ?, ?)
            `, [
                task.title,
                task.description,
                task.category_id,
                task.project_id,
                task.priority,
                weekNumber,
                1,  // 保持重复标记
                task.recurring_note
            ]);
            createdCount++;
        });
        
        res.json({
            movedCount: moveResult.changes,
            createdCount: createdCount,
            weekNumber: weekNumber
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
});
```

**关键点**:
1. 普通事项：直接 UPDATE week_number
2. 重复事项：INSERT 新记录到下一周
3. 新副本的状态重置为 `todo`，进度重置为 `0`
4. 保留 `is_recurring` 和 `recurring_note`，使其继续可重复

---

### 5. 样式设计

#### CSS 增加

```css
/* 重复事项相关样式 */
.recurring-note {
    display: inline-block;
    margin-left: 0.5rem;
    padding: 0.125rem 0.5rem;
    font-size: 0.75rem;
    color: #6c757d;
    background-color: #f8f9fa;
    border-radius: 3px;
}

.form-hint {
    display: block;
    margin-top: 0.25rem;
    font-size: 0.813rem;
    color: #6c757d;
}

#recurringNoteGroup {
    margin-top: 0.5rem;
    padding-left: 1.5rem;
    border-left: 3px solid #e9ecef;
}
```

---

## 实现清单

### 数据库
- [ ] 执行 SQL 迁移：添加 `is_recurring` 和 `recurring_note` 字段

### 后端 (server.js)
- [ ] 修改 `GET /api/tasks/unfinished/count` 为 `GET /api/tasks/unfinished/grouped-count`
- [ ] 修改 `PUT /api/tasks/unfinished/move-to-week` 实现重复事项创建逻辑
- [ ] 修改 `POST /api/tasks` 和 `PUT /api/tasks/:id` 支持 `is_recurring` 和 `recurring_note`

### 前端 (public/js/app.js)
- [ ] 实现 `toggleRecurringNote()` 方法
- [ ] 修改 `showQuickAddModal()` 加载和显示重复字段
- [ ] 修改 `saveQuickTask()` 保存重复字段
- [ ] 修改 `moveUnfinishedToNextWeek()` 调用新 API
- [ ] 修改 `renderTaskItem()` 显示重复标识

### 前端 (public/index.html)
- [ ] 在快速添加对话框增加重复选项字段

### 样式 (public/css/style.css)
- [ ] 添加 `.recurring-note` 样式
- [ ] 添加 `.form-hint` 样式
- [ ] 添加 `#recurringNoteGroup` 样式

---

## 测试场景

### 基础功能
1. ✅ 创建普通事项，不显示重复标识
2. ✅ 创建重复事项（勾选复选框），显示 🔄 图标
3. ✅ 编辑普通事项，可以改为重复事项
4. ✅ 编辑重复事项，可以改为普通事项
5. ✅ 重复事项可以添加备注，在列表中显示

### "未完成到下一周"功能
6. ✅ 只有普通未完成事项时，正常移动
7. ✅ 只有重复未完成事项时，创建副本
8. ✅ 同时有普通和重复事项时，分别处理
9. ✅ 重复事项副本状态为 todo，进度为 0
10. ✅ 重复事项副本保留 is_recurring 和 recurring_note
11. ✅ 原重复事项保持不变（不移动）
12. ✅ 确认对话框显示正确的分类统计

### 边界情况
13. ✅ 没有未完成事项时提示
14. ✅ 取消操作时不执行
15. ✅ 重复事项已完成时不创建副本
16. ✅ 移动后刷新视图显示正确

### 历史记录
17. ✅ 每周的重复事项是独立记录
18. ✅ 可以看到历史周次的完成情况
19. ✅ 修改重复事项不影响历史记录
20. ✅ 删除某周的重复事项不影响其他周

---

## 使用示例

### 示例 1: 每周例会

**创建事项**:
- 标题: 周一站会
- 分类: 工作
- 项目: 团队管理
- 优先级: P1
- 周次: WK49
- ✅ 每周重复
- 重复备注: 每周一 10:00

**周末操作**:
- 点击"未完成到下一周"
- WK50 自动创建"周一站会"
- WK49 的记录保留（可标记完成或未完成）

---

### 示例 2: 周报撰写

**创建事项**:
- 标题: 撰写周报
- 分类: 工作
- 项目: 个人管理
- 优先级: P0
- 周次: WK49
- ✅ 每周重复
- 重复备注: 周五下班前提交

**效果**:
- 每周五完成后标记为 done
- 周末移动时，WK50 自动创建新的"撰写周报"
- 可以回顾历史周报完成情况

---

## 注意事项

1. **保留历史**: 重复事项每周都是独立记录，可以分别标记完成状态
2. **副本规则**: 新副本的状态固定为 `todo`，进度为 `0`
3. **继承属性**: 副本继承标题、描述、分类、项目、优先级、重复标记和备注
4. **不继承**: 副本不继承状态、进度、创建时间、更新时间
5. **原事项**: 原重复事项保持不变，不会被移动或修改
6. **普通与重复的区别**:
   - 普通事项：只移动本周及之前的未完成事项（todo, doing, backlog），已完成的保持不动，未来周的也不移动
   - 重复事项：只复制本周的事项到下周（避免每周额外重复），不管本周是否完成
7. **周次限制**: 避免移动未来周的普通事项，避免重复事项多次复制

---

## 扩展功能（v0.7.0 可选）

### 1. 重复频率选项
- 每周
- 每两周
- 每月
- 自定义间隔

### 2. 重复结束日期
- 设置重复任务的终止日期
- 到期后自动停止创建

### 3. 批量管理
- 查看所有重复事项列表
- 批量修改重复事项
- 批量取消重复

### 4. 智能提醒
- 未完成的重复事项高亮提示
- 周末自动提醒执行"未完成到下一周"

---

## 数据库迁移脚本

```sql
-- 迁移脚本：v0.6.0
-- 执行时间：2025-XX-XX

BEGIN TRANSACTION;

-- 1. 添加重复事项字段
ALTER TABLE tasks ADD COLUMN is_recurring INTEGER DEFAULT 0;
ALTER TABLE tasks ADD COLUMN recurring_note TEXT;

-- 2. 创建索引（提升查询性能）
CREATE INDEX idx_tasks_recurring ON tasks(is_recurring);

-- 3. 验证
SELECT COUNT(*) as total_tasks,
       SUM(CASE WHEN is_recurring = 1 THEN 1 ELSE 0 END) as recurring_tasks
FROM tasks;

COMMIT;
```

---

## 总结

v0.6.0 通过简单的标记机制实现了每周重复功能：

✅ **简单**: 只需勾选复选框  
✅ **直观**: 用 🔄 图标清晰标识  
✅ **完整**: 保留所有历史记录  
✅ **灵活**: 可以随时添加/取消重复  
✅ **可追溯**: 每周的完成情况独立记录  

这个设计符合"人一生的事项有限，要保留历史记录"的理念，让用户可以看到每周任务的完成轨迹，既满足重复需求，又保持数据完整性。
