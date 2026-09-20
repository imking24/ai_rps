/* MediaPipe runs in a classic worker so its WASM loader can use importScripts. */
let recognizer;
self.onmessage = async ({ data }) => {
  if (data.type === 'init') {
    try {
      importScripts('./runtime.js');
      const files = await Vision.FilesetResolver.forVisionTasks(new URL('./wasm', self.location.href).href);
      recognizer = await Vision.GestureRecognizer.createFromOptions(files, {
        baseOptions: {
          modelAssetPath: new URL('./gesture_recognizer.task', self.location.href).href,
          delegate: 'CPU',
        },
        canvas: new OffscreenCanvas(640, 480),
        runningMode: 'VIDEO',
        numHands: 2,
        minHandDetectionConfidence: 0.6,
        minHandPresenceConfidence: 0.6,
        minTrackingConfidence: 0.6,
        cannedGesturesClassifierOptions: { maxResults: 1 },
      });
      self.postMessage({ type: 'ready' });
    } catch (error) {
      self.postMessage({ type: 'error', stage: 'model', message: String(error) });
    }
    return;
  }
  if (data.type !== 'frame') return;
  try {
    if (!recognizer) throw new Error('Model is not ready');
    const result = recognizer.recognizeForVideo(data.bitmap, data.timestamp);
    const top = result.gestures[0]?.[0];
    self.postMessage({
      type: 'result',
      roundKey: data.roundKey,
      timestamp: data.timestamp,
      detection: {
        handCount: result.landmarks.length,
        category: top?.categoryName ?? '',
        score: top?.score ?? 0,
      },
      points: result.landmarks.length === 1 ? result.landmarks[0].map(({ x, y }) => ({ x, y })) : [],
    });
  } catch (error) {
    self.postMessage({ type: 'error', stage: 'inference', message: String(error) });
  } finally {
    data.bitmap.close();
  }
};
