# xterm

此文件夹下的文件直接拷贝自 [xterm.js](https://github.com/xtermjs/xterm.js) 源码，用于虚拟键盘的键盘事件解析：

- `Keyboard.ts` ← https://github.com/xtermjs/xterm.js/blob/master/src/common/input/Keyboard.ts
- `EscapeSequences.ts` ← https://github.com/xtermjs/xterm.js/blob/master/src/common/data/EscapeSequences.ts

后续 xterm.js 更新时，只需用上游对应文件替换这两个文件即可。
