import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function prepareVisionAssets() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const source = join(root, 'node_modules', '@mediapipe', 'tasks-vision');
  const target = join(root, 'public', 'vision');
  if (!existsSync(join(target, 'gesture_recognizer.task'))) {
    throw new Error('缺少 public/vision/gesture_recognizer.task，请完整下载项目中的识别模型。');
  }
  mkdirSync(join(target, 'wasm'), { recursive: true });
  copyFileSync(join(source, 'vision_bundle.js'), join(target, 'runtime.js'));
  for (const name of readdirSync(join(source, 'wasm'))) {
    if (/\.(js|wasm)$/.test(name)) copyFileSync(join(source, 'wasm', name), join(target, 'wasm', name));
  }
}
