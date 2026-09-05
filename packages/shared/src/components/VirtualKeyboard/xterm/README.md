# xterm

此文件夹下的文件直接拷贝自 [xterm.js](https://github.com/xtermjs/xterm.js) 源码，用于虚拟键盘的键盘事件解析：

- `Keyboard.ts` ← https://github.com/xtermjs/xterm.js/blob/master/src/common/input/Keyboard.ts
- `EscapeSequences.ts` ← https://github.com/xtermjs/xterm.js/blob/master/src/common/data/EscapeSequences.ts

后续 xterm.js 更新时，只需用上游对应文件替换这两个文件即可。

## 维护策略（减少漂移风险）

当 xterm 目录文件作为上游镜像使用时，建议遵循以下原则：

1. 尽量不修改本目录下的上游拷贝文件。
2. 兼容性修复优先放在 VirtualKeyboard 的适配层完成。
3. 上游升级时保持“可直接替换”，减少手工合并冲突。

所谓“在 resolveInput 侧做最小补偿（仅补 code），而不改拷贝文件本身”，指的是：

1. 在 VirtualKeyboard 的输入映射阶段，补齐 KeyboardEvent.code（例如 Digit2、Digit6、Minus）。
2. 然后继续调用 xterm 的 evaluateKeyboardEvent 进行序列解析。
3. 这样既能修复 Ctrl+@、Ctrl+^、Ctrl+\_ 等组合输入，又不会污染上游镜像文件。

该策略的核心价值：

1. 降低与上游差异，长期更易维护。
2. 升级 xterm.js 时冲突更少。
3. 问题定位边界清晰：上游逻辑在 xterm 目录，项目定制在适配层。
