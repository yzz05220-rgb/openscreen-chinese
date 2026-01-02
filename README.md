<p align="center">
  <img src="openscreen.png" alt="OpenScreen Logo" width="64" />
</p>

# <p align="center">OpenScreen 中文版</p>

<p align="center"><strong>免费开源的屏幕录制和视频编辑工具，Screen Studio 的开源替代品</strong></p>

<p align="center">
  🌟 本项目基于 <a href="https://github.com/siddharthvaddem/openscreen">siddharthvaddem/openscreen</a> 进行汉化和功能增强
</p>

<p align="center">
  <a href="https://github.com/yzz05220-rgb/openscreen-chinese/releases">
    <img src="https://img.shields.io/github/v/release/yzz05220-rgb/openscreen-chinese?style=flat-square" alt="Latest Release" />
  </a>
  <a href="https://github.com/yzz05220-rgb/openscreen-chinese/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/yzz05220-rgb/openscreen-chinese?style=flat-square" alt="License" />
  </a>
  <a href="https://github.com/yzz05220-rgb/openscreen-chinese/stargazers">
    <img src="https://img.shields.io/github/stars/yzz05220-rgb/openscreen-chinese?style=flat-square" alt="Stars" />
  </a>
</p>

---

## ✨ 中文版新增功能

相比原版，中文版新增了以下功能：

### 🌐 界面优化
- **完整中文界面** - 所有 UI 元素已汉化
- **优化的音频设置面板** - 简化的音频模式选择（静音/系统/麦克/全部）
- **改进的透明窗口交互** - 修复了 Windows 平台上的点击穿透问题

### 🎤 音频录制
- **多种音频模式** - 支持静音、仅系统声音、仅麦克风、或同时录制
- **麦克风设备选择** - 自动检测并选择麦克风设备
- **音频设备热插拔** - 自动检测设备变化

### 🤖 AI 功能
- **AI 智能缩放** - 集成 Gemini AI，自动分析视频内容生成缩放建议
- **AI 图片生成** - 使用 Gemini 生成注释图片
- **智能内容识别** - AI 自动识别视频中的重要内容并建议缩放位置

### 🖱️ 鼠标跟随
- **鼠标跟随缩放** - 录制时记录鼠标位置，播放时自动跟随鼠标缩放
- **平滑过渡** - 缩放跟随鼠标移动时的平滑动画效果

### ⌨️ 兼容性改进
- **中文输入法快捷键兼容** - 修复了中文输入法下快捷键无法使用的问题
- **Windows 平台优化** - 改进了透明窗口在 Windows 上的表现

---

## 📥 下载安装

从 [Releases](https://github.com/yzz05220-rgb/openscreen-chinese/releases) 页面下载最新版本的安装包。

### Windows
下载 `OpenScreen-Chinese-x.x.x-Setup.exe`，双击安装即可。

### macOS
下载 `.dmg` 文件，拖拽到应用程序文件夹。

### Linux
下载 `.AppImage` 文件，添加执行权限后运行。

---

## 🎯 核心功能

### 📹 录制功能
- ✅ 录制整个屏幕或特定应用窗口
- ✅ 多种音频录制模式（静音/系统/麦克/全部）
- ✅ 自动检测音频设备
- ✅ 鼠标位置跟踪

### 🎬 编辑功能
- ✅ 添加手动缩放（可自定义缩放深度）
- ✅ AI 智能缩放建议
- ✅ 鼠标跟随缩放
- ✅ 自定义缩放的持续时间和位置
- ✅ 裁剪视频录制以隐藏部分内容
- ✅ 修剪视频片段

### 🎨 视觉效果
- ✅ 选择壁纸、纯色、渐变或自定义图片作为背景
- ✅ 运动模糊效果，使平移和缩放更流畅
- ✅ 添加注释（文字、箭头、图片）
- ✅ AI 生成注释图片
- ✅ 自定义圆角、阴影、边距

### 📤 导出功能
- ✅ 导出不同宽高比和分辨率
- ✅ 多种质量选项
- ✅ 浏览器渲染或 FFmpeg 快速导出

<p align="center">
  <img src="preview.png" alt="OpenScreen App Preview" style="height: 320px; margin-right: 12px;" />
  <img src="preview2.png" alt="OpenScreen App Preview 2" style="height: 320px; margin-right: 12px;" />
  <img src="preview3.png" alt="OpenScreen App Preview 3" style="height: 320px; margin-right: 12px;" />
  <img src="preview4.png" alt="OpenScreen App Preview 4" style="height: 320px; margin-right: 12px;" />
</p>

---

## 🚀 快速开始

### 1. 录制视频
1. 启动应用后，点击"屏幕"选择录制源（整个屏幕或特定窗口）
2. 点击"全部"选择音频模式：
   - **静音** - 不录制任何音频
   - **系统** - 只录制系统声音
   - **麦克** - 只录制麦克风
   - **全部** - 同时录制系统声音和麦克风
3. 点击"录制"开始录制
4. 录制完成后点击"停止"

### 2. 编辑视频
1. 在编辑器中，使用时间轴添加缩放、裁剪、注释
2. 使用 AI 智能缩放功能自动生成缩放建议
3. 调整背景、运动模糊等视觉效果
4. 预览效果

### 3. 导出视频
1. 点击"导出"按钮
2. 选择导出质量和方法
3. 等待导出完成

---

## 🛠️ 从源码构建

```bash
# 克隆仓库
git clone https://github.com/yzz05220-rgb/openscreen-chinese.git
cd openscreen-chinese

# 安装依赖
npm install

# 开发模式运行
npm run dev

# 打包 Windows 版本
npm run build:win

# 打包 macOS 版本
npm run build:mac

# 打包 Linux 版本
npm run build:linux
```

---

## 🔧 平台特定说明

### macOS
如果遇到 macOS Gatekeeper 阻止应用运行（因为没有开发者证书），可以在终端运行以下命令：

```bash
xattr -rd com.apple.quarantine /Applications/Openscreen.app
```

然后前往 **系统偏好设置 > 安全性与隐私**，授予"屏幕录制"和"辅助功能"权限。

### Linux
从 Releases 页面下载 `.AppImage` 文件，然后：

```bash
chmod +x Openscreen-Linux-*.AppImage
./Openscreen-Linux-*.AppImage
```

根据桌面环境，可能需要授予屏幕录制权限。

### Windows
首次运行时，Windows Defender 可能会提示"Windows 已保护你的电脑"，点击"更多信息"然后"仍要运行"即可。

---

## 🏗️ 技术栈

- **框架**: Electron + React + TypeScript
- **构建工具**: Vite
- **图形渲染**: PixiJS
- **时间轴**: dnd-timeline
- **国际化**: i18next
- **AI 集成**: Google Gemini API

---

## 💬 交流群

<p align="center">
  <img src="wechat-qr.jpg" alt="微信交流群" width="300" />
</p>

<p align="center">扫码加入微信交流群，获取最新更新和技术支持</p>

---

## 🙏 致谢

本项目基于 [OpenScreen](https://github.com/siddharthvaddem/openscreen) 开发，感谢原作者 [@siddharthvaddem](https://github.com/siddharthvaddem) 的开源贡献！

---

## 📝 许可证

本项目采用 [MIT License](./LICENSE) 开源许可证。

---

## 🌟 Star History

[![Star History Chart](https://api.star-history.com/svg?repos=yzz05220-rgb/openscreen-chinese&type=Date)](https://star-history.com/#yzz05220-rgb/openscreen-chinese&Date)
