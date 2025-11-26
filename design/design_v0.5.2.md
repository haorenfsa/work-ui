# 项目管理系统增量设计 v0.5.2

## 新增功能：分类管理页面 URL 查询参数

### 功能概述
为分类管理页面（包括分类详情和项目详情）添加 URL query 支持，使页面状态可通过 URL 持久化，刷新页面时保持当前视图状态。

### 使用场景
- **页面刷新保持状态**: 刷新浏览器时保留当前查看的分类/项目和标签页
- **分享特定页面**: 复制 URL 分享给他人，直接打开指定分类或项目
- **浏览器前进/后退**: 支持浏览器导航，返回之前的页面状态
- **书签保存**: 将特定的分类或项目视图保存为书签

---

## URL 参数设计

### 参数定义

```
# 查看分类列表（默认）
/index.html

# 查看特定分类的项目
/index.html?category=3

# 查看特定分类的事项总览
/index.html?category=3&tab=tasks

# 查看特定项目的事项
/index.html?category=3&project=12
```

| 参数 | 说明 | 值 | 是否必填 |
|-----|------|-----|---------|
| `view` | 视图类型 | `categories`, `weekly`, `report` | 否，默认 `categories` |
| `category` | 分类ID | 数字，如 `3` | 否，空表示分类列表 |
| `project` | 项目ID | 数字，如 `12` | 否，需要 category |
| `tab` | 分类详情标签页 | `projects`, `tasks` | 否，默认 `projects` |

### 示例场景

```
# 查看分类列表
/?view=categories
或
/

# 查看"工作"分类的项目
/?category=3

# 查看"工作"分类的所有事项
/?category=3&tab=tasks

# 查看"前端开发"项目的事项列表
/?category=3&project=12
```

---

## 实现方案

### 1. 扩展 URL 参数解析

```javascript
parseUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    return {
        view: urlParams.get('view'),
        week: urlParams.get('week') ? parseInt(urlParams.get('week')) : null,
        project: urlParams.get('project') || '',
        status: urlParams.get('status') || '',
        // 新增分类管理相关参数
        category: urlParams.get('category') ? parseInt(urlParams.get('category')) : null,
        tab: urlParams.get('tab') || 'projects'
    };
}
```

### 2. 扩展 URL 更新逻辑

```javascript
updateUrl() {
    const params = new URLSearchParams();
    
    // 分类管理视图参数
    if (this.currentView === 'categories') {
        if (this.currentCategory) {
            params.set('category', this.currentCategory);
            
            // 项目详情
            if (this.currentProject) {
                params.set('project', this.currentProject);
            } 
            // 分类详情的 tab
            else if (this.currentTab !== 'projects') {
                params.set('tab', this.currentTab);
            }
        }
        // 如果是分类列表视图，不添加任何参数
    }
    // 每周视图参数
    else if (this.currentView === 'weekly') {
        params.set('view', 'weekly');
        params.set('week', this.currentWeek);
        
        if (this.weekFilters.projectId) {
            params.set('project', this.weekFilters.projectId);
        }
        
        if (this.weekFilters.status) {
            params.set('status', this.weekFilters.status);
        }
    }
    // 其他视图
    else {
        params.set('view', this.currentView);
    }
    
    // 更新 URL
    const queryString = params.toString();
    const newUrl = queryString ? `${window.location.pathname}?${queryString}` : window.location.pathname;
    window.history.pushState({ path: newUrl }, '', newUrl);
}
```

### 3. 初始化时应用分类/项目参数

```javascript
async init() {
    this.setupNavigation();
    await this.loadCurrentDatabase();
    await this.loadCategories();
    
    // 从 URL 读取参数
    const params = this.parseUrlParams();
    
    this.currentWeek = params.week || this.getCurrentWeekNumber();
    this.setupWeekOptions();
    
    // 应用视图
    if (params.view === 'weekly') {
        this.weekFilters.projectId = params.project || '';
        this.weekFilters.status = params.status || '';
        this.showView('weekly');
    } else if (params.view === 'report') {
        this.showView('report');
    } else {
        // 分类管理视图
        this.showView('categories');
        
        // 如果有分类参数，显示分类详情
        if (params.category) {
            this.currentTab = params.tab || 'projects';
            await this.showCategoryDetail(params.category);
            
            // 如果有项目参数，显示项目详情
            if (params.project) {
                await this.showProjectDetail(params.project);
            }
        }
    }
}
```

### 4. 扩展浏览器前进/后退支持

```javascript
window.addEventListener('popstate', () => {
    const params = this.parseUrlParams();
    
    if (params.view === 'weekly') {
        this.currentWeek = params.week || this.getCurrentWeekNumber();
        this.weekFilters.projectId = params.project || '';
        this.weekFilters.status = params.status || '';
        this.showView('weekly');
    } else if (params.view === 'report') {
        this.showView('report');
    } else {
        // 分类管理视图
        this.showView('categories');
        
        if (params.category) {
            this.currentTab = params.tab || 'projects';
            this.showCategoryDetail(params.category);
            
            if (params.project) {
                this.showProjectDetail(params.project);
            }
        }
    }
});
```

### 5. 在相关函数中调用 updateUrl()

需要添加 `updateUrl()` 调用的函数：
- `showCategoryDetail()` - 进入分类详情
- `switchTab()` - 切换标签页
- `showProjectDetail()` - 进入项目详情
- `backToCategoryDetail()` - 返回分类详情

---

## 修改清单

### 修改函数
1. `parseUrlParams()` - 添加 `category`, `tab` 参数解析
2. `updateUrl()` - 添加分类管理视图的 URL 更新逻辑
3. `init()` - 初始化时根据 URL 参数打开相应页面
4. `setupNavigation()` 中的 `popstate` 监听器 - 支持分类/项目导航
5. `showCategoryDetail()` - 添加 `updateUrl()` 调用
6. `switchTab()` - 添加 `updateUrl()` 调用
7. `showProjectDetail()` - 添加 `updateUrl()` 调用
8. `backToCategoryDetail()` - 添加 `updateUrl()` 调用

---

## 测试场景

1. ✅ 直接访问 `/?category=3` 进入指定分类
2. ✅ 访问 `/?category=3&tab=tasks` 打开事项标签页
3. ✅ 访问 `/?category=3&project=12` 打开指定项目
4. ✅ 切换标签页，URL 自动更新
5. ✅ 进入项目详情，URL 包含分类和项目参数
6. ✅ 返回分类详情，URL 移除项目参数
7. ✅ 刷新页面，保持当前分类/项目状态
8. ✅ 浏览器后退，返回之前的页面
9. ✅ 复制 URL 在新标签页打开，显示相同页面
