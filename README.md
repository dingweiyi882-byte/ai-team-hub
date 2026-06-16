# AI Team Hub - 开箱即用版

## 系统要求

- Windows 10 及以上
- Python 3.8+
- Node.js 18+

## 快速启动

### 方法一：一键启动（推荐）

1. 确保已安装 Python 和 Node.js
2. 双击运行 `start.bat`
3. 首次运行会自动安装依赖并构建前端
4. 服务启动后，浏览器自动打开 `http://127.0.0.1:8910`

### 方法二：手动启动

#### 1. 安装后端依赖

```batch
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

#### 2. 安装前端依赖并构建

```batch
cd frontend
npm install
npm run build
```

#### 3. 启动后端服务

```batch
cd backend
.venv\Scripts\activate
python main.py
```

服务将在 `http://127.0.0.1:8910` 运行。

## 端口说明

- **8910**: 后端 FastAPI 服务（同时托管前端静态文件）

## 功能说明

### 落地页
- 点击右上角 `menu` 按钮展开全屏导航
- Features / How It Works / About 带 underline hover 动画
- Launch App 进入主应用

### 主应用
- 创建频道（Channels）
- 创建 AI 队友（AI Teammates）
- 多模型支持（GPT-4, Claude, Gemini 等）
- 实时聊天协作

## 目录结构

```
ai-team-hub/
├── start.bat          # Windows 一键启动脚本
├── backend/           # FastAPI 后端
│   ├── main.py        # 入口文件
│   ├── requirements.txt
│   └── routes/        # API 路由
├── frontend/          # React 前端
│   ├── dist/          # 构建产物
│   ├── src/           # 源码
│   └── package.json
└── data/              # 数据存储
```

## 常见问题

### 1. 端口被占用

如果 8910 端口被占用，可以修改 `backend/main.py` 中的端口号：

```python
uvicorn.run("backend.main:app", host="127.0.0.1", port=8910, reload=True)
```

### 2. 前端构建失败

```batch
cd frontend
rmdir /s /q node_modules
npm install
npm run build
```

### 3. 后端依赖安装失败

```batch
cd backend
rmdir /s /q .venv
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

## 技术栈

- **后端**: FastAPI + SQLAlchemy + SQLite
- **前端**: React 18 + Vite + Tailwind CSS + GSAP + Framer Motion
- **API**: RESTful + WebSocket
