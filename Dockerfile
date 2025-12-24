FROM ubuntu:22.04
LABEL authors="Jule"

# 核心修复1：配置阿里云源（转义符+语法规范）
RUN sed -i 's/archive.ubuntu.com/mirrors.aliyun.com/g' /etc/apt/sources.list && \
    sed -i 's/security.ubuntu.com/mirrors.aliyun.com/g' /etc/apt/sources.list && \
    apt-get clean && apt-get update -y

# 核心修复2：安装基础依赖（单独RUN，避免命令串联错误）
RUN apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    gnupg \
    unzip \
    wget \
    fontconfig \
    fonts-noto-cjk \
    fonts-liberation \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpangocairo-1.0-0 \
    libpango-1.0-0 \
    libgtk-3-0 \
    libxshmfence1 && \
    rm -rf /var/lib/apt/lists/*

# 核心修复3：安装Node.js（单独RUN，避免和基础依赖冲突）
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && \
    apt-get update -y && apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/* && \
    # 配置国内npm源，解决npm install慢/失败
    npm config set registry https://registry.npmmirror.com

# 核心修复4：工作目录+业务文件拷贝（规范执行顺序）
WORKDIR /app
COPY package.json ./
COPY server.js ./

# 核心修复5：安装npm依赖+Playwright（有package.json才执行，避免报错）
RUN if [ -f package.json ]; then npm install; fi && \
    npx playwright install chromium --with-deps

# 业务环境变量
ENV BROWSER_WORKERS=2
ENV MAX_CONTEXTS=4

# 暴露端口
EXPOSE 3000

# 启动命令
CMD ["node", "server.js"]