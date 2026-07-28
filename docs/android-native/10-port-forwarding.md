# P2：SSH 端口转发

## 目标

在 Android 基础 SSH 稳定后，启用 local、remote 和 dynamic 端口转发，并复用
`shell360-ssh` 的实现。

## 依赖

- [06-data.md](./06-data.md)
- [07-ssh-terminal.md](./07-ssh-terminal.md)

## 范围

- Local port forwarding。
- Remote port forwarding。
- Dynamic SOCKS forwarding。
- open/close 状态和错误事件。
- 与 Session 生命周期联动。

## Android 限制

- App 进入后台后，系统可能限制进程和网络活动。
- P2 默认只保证 App 前台存活期间的转发。
- 若要求锁屏或长期后台持续转发，需要单独增加 Android foreground service、
  常驻通知和电量策略说明，不包含在本方案中。
- 监听非 loopback 地址需要在 UI 明确风险。

## 安全策略

- Local 和 dynamic 默认监听 `127.0.0.1`。
- 监听 `0.0.0.0` 或局域网地址时二次确认。
- 禁止未经校验的低端口和无效地址。
- Session 断开后立即关闭关联监听器。
- 页面 client release 后关闭其创建的转发。

## Bridge 命令

```text
ssh.portForwarding.openLocal
ssh.portForwarding.closeLocal
ssh.portForwarding.openRemote
ssh.portForwarding.closeRemote
ssh.portForwarding.openDynamic
ssh.portForwarding.closeDynamic
```

状态事件应区分 opening、active、failed 和 closed，避免 UI 只根据 Promise 推断长期状态。

## 测试

- 三种转发的成功和关闭。
- 端口占用和权限错误。
- Session 异常断开后的级联清理。
- 页面 reload 后清理。
- IPv4、IPv6 和 localhost。
- App 切换前后台后的实际行为。

## 验收标准

- 三种端口转发在 App 前台正常工作。
- Session 和页面释放后不存在遗留监听端口。
- 非 loopback 监听有明确风险确认。
- 不承诺未实现 foreground service 时的长期后台运行。
