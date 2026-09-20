# 本地手势识别资源

- 模型：Google MediaPipe Gesture Recognizer，float16，第 1 版。
- 来源：https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task
- SHA-256：`97952348cf6a6a4915c2ea1496b4b37ebabc50cbbf80571435643c455f2b0482`
- 官方说明：https://developers.google.com/edge/mediapipe/solutions/vision/gesture_recognizer
- MediaPipe Tasks Vision：`@mediapipe/tasks-vision@1.0.1`，Apache-2.0。

`gesture_recognizer.task` 和 `gesture-worker.js` 随项目保存。`runtime.js` 与 `wasm/` 由 Vite 配置调用 `scripts/prepare-vision.mjs` 从锁定的 npm 依赖复制，不需要手动下载，也不提交生成的副本。

摄像头视频仅在浏览器本地的 Web Worker 中推理，不上传或持久化。握拳、V 字手势、张开手掌分别映射为石头、剪刀、布；其他手势及多手画面不作为有效出拳。
