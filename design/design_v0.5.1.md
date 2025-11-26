# 项目管理系统增量设计 v0.5.1

## 新增功能：每周视图 URL 查询参数

### 功能概述
为每周视图添加 URL query 支持，使筛选状态和周次可通过 URL 持久化，刷新页面时保持当前视图状态。

### 使用场景
- **页面刷新保持状态**: 刷新浏览器时保留当前周次和筛选条件
- **分享特定视图**: 复制 URL 分享给他人，直接打开指定周次和筛选
- **浏览器前进/后退**: 支持浏览器导航，返回之前的视图状态
- **书签保存**: 将特定的周视图保存为书签

---

## URL 参数设计

### 参数定义

```
/index.html?view=weekly&week=47&project=12&status=doing
```

| 参数 | 说明 | 值 | 是否必填 |
|-----|------|-----|---------|
| `view` | 视图类型 | `categories`, `weekly`, `report` | 否，默认 `categories` |
| `week` | 周次编号 | 数字，如 `47` | 否，默认当前周 |
| `project` | 项目ID | 数字，如 `12` | 否，空表示全部 |
| `status` | 事项状态 | `todo`, `doing`, `done`, `backlog` | 否，空表示全部 |

### 示例场景

```
# 查看第47周的全部事项
?view=weekly&week=47

# 查看第47周"前端开发"项目的进行中事项
?view=weekly&week=47&project=12&status=doing

# 查看第48周已完成的事项
?view=weekly&week=48&status=done
```

---

## 实现方案

### 1. 初始化时读取 URL 参数

在 `app.init()` 中解析 URL 参数并应用：

```javascript
async init() {
    this.setupNavigation();
    await this.loadCurrentDatabase();
    this.loadCategories();
    
    // 从 URL 读取参数
    const params = this.parseUrlParams();
    
    // 设置视图和周次
    this.currentView = params.view || 'categories';
    this.currentWeek = params.week || this.getCurrentWeekNumber();
    
    this.setupWeekOptions();
    
    // 应用视图
    if (params.view === 'weekly') {
        this.weekFilters.projectId = params.project || '';
        this.weekFilters.status = params.status || '';
        this.showView('weekly');
    } else {
        this.showView(this.currentView);
    }
}
```

### 2. 解析 URL 参数

```javascript
parseUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    return {
        view: urlParams.get('view'),
        week: urlParams.get('week') ? parseInt(urlParams.get('week')) : null,
        project: urlParams.get('project') || '',
        status: urlParams.get('status') || ''
    };
}
```

### 3. 更新 URL（不刷新页面）

在用户操作时更新 URL：

```javascript
updateUrl() {
    const params = new URLSearchParams();
    
    // 始终包含视图类型
    params.set('view', this.currentView);
    
    // 每周视图特定参数
    if (this.currentView === 'weekly') {
        params.set('week', this.currentWeek);
        
        if (this.weekFilters.projectId) {
            params.set('project', this.weekFilters.projectId);
        }
        
        if (this.weekFilters.status) {
            params.set('status', this.weekFilters.status);
        }
    }
    
    // 更新 URL，不刷新页面
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.pushState({ path: newUrl }, '', newUrl);
}
```

### 4. 修改相关函数调用 `updateUrl()`

需要在以下操作后调用 `updateUrl()`：

- `showView()` - 切换视图时
- `changeWeek()` - 切换周次时  
- `applyWeekFilters()` - 应用筛选时
- `clearWeekFilters()` - 清除筛选时

### 5. 支持浏览器前进/后退

```javascript
setupNavigation() {
    // 原有导航按钮事件...
    
    // 监听浏览器前进/后退
    window.addEventListener('popstate', () => {
        const params = this.parseUrlParams();
        
        if (params.view === 'weekly') {
            this.currentWeek = params.week || this.getCurrentWeekNumber();
            this.weekFilters.projectId = params.project || '';
            this.weekFilters.status = params.status || '';
            this.showView('weekly');
        } else {
            this.showView(params.view || 'categories');
        }
    });
}
```

---

## 修改清单

### 新增函数
1. `parseUrlParams()` - 解析 URL 参数
2. `updateUrl()` - 更新浏览器 URL

### 修改函数
1. `init()` - 读取 URL 参数并初始化
2. `setupNavigation()` - 添加 popstate 监听
3. `showView()` - 调用 `updateUrl()`
4. `changeWeek()` - 调用 `updateUrl()`
5. `applyWeekFilters()` - 调用 `updateUrl()`
6. `clearWeekFilters()` - 调用 `updateUrl()`

---

## 测试场景

1. ✅ 直接访问 `?view=weekly&week=47` 进入第47周
2. ✅ 切换周次，URL 自动更新
3. ✅ 应用筛选，URL 包含筛选参数
4. ✅ 刷新页面，保持当前周次和筛选
5. ✅ 清除筛选，URL 移除筛选参数
6. ✅ 切换到其他视图，URL 更新为对应视图
7. ✅ 浏览器后退，返回之前的周视图状态
8. ✅ 复制 URL 在新标签页打开，显示相同状态
