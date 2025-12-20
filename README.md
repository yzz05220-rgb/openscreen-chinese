<p align="center">
  <img src="openscreen.png" alt="OpenScreen Logo" width="64" />
</p>

# <p align="center">OpenScreen 中文版</p>

<p align="center"><strong>免费开源的屏幕录制和视频编辑工具，Screen Studio 的开源替代品</strong></p>

<p align="center">
  🌟 本项目基于 <a href="https://github.com/siddharthvaddem/openscreen">siddharthvaddem/openscreen</a> 进行汉化和功能增强
</p>

---

## ✨ 中文版新增功能

相比原版，中文版新增了以下功能：

- 🌐 **完整中文界面** - 所有 UI 元素已汉化
- 🤖 **AI 智能缩放** - 集成 Gemini AI，自动分析视频内容生成缩放建议
- 🖱️ **鼠标跟随缩放** - 录制时记录鼠标位置，播放时自动跟随鼠标缩放
- 🎨 **AI 图片生成** - 使用 Gemini 生成注释图片
- 🎤 **音频录制** - 支持系统音频、麦克风或同时录制
- ⌨️ **中文输入法快捷键兼容** - 修复了中文输入法下快捷键无法使用的问题

---

## 📥 下载安装

从 [Releases](https://github.com/yzz05220-rgb/openscreen-chinese/releases) 页面下载最新版本的安装包。

### Windows
下载 `OpenScreen-Chinese-x.x.x-Setup.exe`，双击安装即可。

---

## 🎯 核心功能

- 录制整个屏幕或特定应用窗口
- 添加手动缩放（可自定义缩放深度）
- 自定义缩放的持续时间和位置
- 裁剪视频录制以隐藏部分内容
- 选择壁纸、纯色、渐变或自定义图片作为背景
- 运动模糊效果，使平移和缩放更流畅
- 添加注释（文字、箭头、图片）
- 修剪视频片段
- 导出不同宽高比和分辨率

<p align="center">
  <img src="preview.png" alt="OpenScreen App Preview" style="height: 320px; margin-right: 12px;" />
  <img src="preview2.png" alt="OpenScreen App Preview 2" style="height: 320px; margin-right: 12px;" />
  <img src="preview3.png" alt="OpenScreen App Preview 3" style="height: 320px; margin-right: 12px;" />
  <img src="preview4.png" alt="OpenScreen App Preview 4" style="height: 320px; margin-right: 12px;" />
</p>

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
```

---

## 🔧 macOS 安装说明

如果遇到 macOS Gatekeeper 阻止应用运行（因为没有开发者证书），可以在终端运行以下命令：

```bash
xattr -rd com.apple.quarantine /Applications/Openscreen.app
```

然后前往 **系统偏好设置 > 安全性与隐私**，授予"屏幕录制"和"辅助功能"权限。

---

## 🐧 Linux 安装说明

从 Releases 页面下载 `.AppImage` 文件，然后：

```bash
chmod +x Openscreen-Linux-*.AppImage
./Openscreen-Linux-*.AppImage
```

根据桌面环境，可能需要授予屏幕录制权限。

---

## 🏗️ 技术栈

- Electron
- React
- TypeScript
- Vite
- PixiJS
- dnd-timeline
- i18next

---

## 🙏 致谢

本项目基于 [OpenScreen](https://github.com/siddharthvaddem/openscreen) 开发，感谢原作者 [@siddharthvaddem](https://github.com/siddharthvaddem) 的开源贡献！

---

## 📝 许可证

本项目采用 [MIT License](./LICENSE) 开源许可证。
