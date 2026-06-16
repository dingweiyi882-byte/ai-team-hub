@echo off
chcp 65001 >nul 2>&1
title AI Team Hub - 启动器
color 0A

echo ============================================
echo   AI Team Hub - 团队协作平台
echo ============================================
echo.

:: ── 代理环境检查 ──
if "%HTTP_PROXY%"=="" if "%HTTPS_PROXY%"=="" (
    echo [信息] 未检测到系统代理
    echo        如果在学校代理网络下安装依赖失败，请先设置代理：
    echo         set HTTP_PROXY=http://你的代理地址:端口
    echo         set HTTPS_PROXY=http://你的代理地址:端口
    echo.
) else (
    echo [✓] 检测到系统代理已配置
)

:: ── 环境检测 ──
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Python 3.8+
    echo 下载: https://www.python.org/downloads/release/python-3120/
    echo 安装时务必勾选 "Add Python to PATH"
    pause
    exit /b 1
)

node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Node.js 18+
    echo 下载: https://nodejs.org/
    pause
    exit /b 1
)

echo [✓] 环境检测通过
echo.

cd /d "%~dp0"

:: ── 后端依赖 ──
if not exist "backend\.venv" (
    echo [1/3] 正在安装后端 Python 依赖...
    python -m venv "backend\.venv"
    if %errorlevel% neq 0 (
        echo [×] Python 虚拟环境创建失败
        pause
        exit /b 1
    )
    call "backend\.venv\Scripts\activate.bat"
    :: 代理环境下 pip 使用代理
    if not "%HTTP_PROXY%"=="" (
        pip install --proxy=%HTTP_PROXY% -r "backend\requirements.txt"
    ) else (
        pip install -r "backend\requirements.txt"
    )
    if %errorlevel% neq 0 (
        echo [×] 后端依赖安装失败
        echo 如果是网络问题，请设置代理后重试
        pause
        exit /b 1
    )
    echo [✓] 后端依赖安装完成
) else (
    echo [✓] 后端依赖已安装
)

:: ── 前端构建检查 ──
if not exist "frontend\dist" (
    if not exist "frontend\node_modules" (
        echo [2/3] 正在安装前端 Node.js 依赖...
        cd frontend
        :: 代理环境下 npm 使用代理
        if not "%HTTP_PROXY%"=="" (
            npm config set proxy %HTTP_PROXY%
            npm config set https-proxy %HTTP_PROXY%
        )
        npm install
        if %errorlevel% neq 0 (
            echo [×] 前端依赖安装失败
            echo 如果是网络问题，请设置代理后重试
            pause
            exit /b 1
        )
        cd ..
        echo [✓] 前端依赖安装完成
    )
    echo [3/3] 正在构建前端...
    cd frontend
    npm run build
    cd ..
    echo [✓] 前端构建完成
) else (
    echo [✓] 前端已构建
)

:: ── 启动 ──
echo.
echo ============================================
echo   服务地址: http://127.0.0.1:8910
echo   启动后端服务...
echo ============================================
echo.

call "backend\.venv\Scripts\activate.bat"
python -m backend.main

echo.
echo 服务已停止。
pause
