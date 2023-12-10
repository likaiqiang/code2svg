## 项目概述

本项目是一个用于帮助开发人员阅读源码的网站工具。它能够分析任意JavaScript或TypeScript项目，你可以搜索合适的github repo并选择入口文件，它会将代码打包，并分析出调用栈超过三层的全局函数。此外，它还提供了代码还原和解释功能，允许用户深入了解源代码的执行过程。

## 功能特点

### 已完成的功能

- **代码打包**: 项目可以接受一个入口文件，并使用Rollup来打包整个项目的代码。

- **调用栈分析**: 该项目可以分析捆绑的代码，识别出全局函数的调用栈，并生成相应的报告。

- **代码还原**: 用户可以通过点击报告中的节点来还原代码，以查看特定函数的实现。

- **代码解释**: 项目集成了ChatGPT，允许用户在代码还原的基础上获取代码解释和注释，以帮助理解代码的逻辑。

### 正在进行中的任务

- **更好的交互**

- **更好的合并与分析代码性能**

## 快速开始

### 使用

1. 访问[网站](https://daxigua.site/)

2. 配置入口文件：在网站上搜索github repo并选择入口文件。

3. 运行分析：启动分析过程，工具将自动执行代码打包和分析。

4. 查看报告：分析完成后，您可以查看call graph，还原代码，并使用ChatGPT解释代码。


## 许可证

本项目根据 [许可证名称] 许可证进行许可。有关详细信息，请参阅 [LICENSE](https://github.com/likaiqiang/codeStackViz/blob/main/LICENSE) 文件。

