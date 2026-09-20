import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, Check, LoaderCircle, ScanLine, ShieldCheck } from 'lucide-react';
import { LABELS, type Move } from './engine';
import Hand from './Hand';
import { canUseSample, GestureStabilizer, MAX_SAMPLE_AGE_MS, type Detection, type GestureSample } from './vision/gesture';

type Props = { canSubmit: boolean; roundKey: string; phase: string; paused: boolean; onSubmit: (move: Move) => void };
type Point = { x: number; y: number };
type WorkerResult = { type: 'result'; detection: Detection; points: Point[]; timestamp: number; roundKey: string };
type WorkerMessage = WorkerResult | { type: 'ready' } | { type: 'error'; stage: string; message: string };
type Status = 'off' | 'permission' | 'loading' | 'ready' | 'error';
const CONNECTIONS = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[0,17],[17,18],[18,19],[19,20]];

function cameraError(error: unknown) {
  const name = (error as { name?: string })?.name;
  if (name === 'NotAllowedError' || name === 'SecurityError') return '未获得摄像头权限。请在浏览器地址栏允许摄像头，然后重试；嵌入页面无法授权时，请在独立浏览器标签页打开游戏。';
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') return '没有找到摄像头。请连接摄像头后重试，或继续使用出拳按钮。';
  if (name === 'NotReadableError' || name === 'TrackStartError') return '摄像头暂时无法使用，可能被其他应用占用。请关闭占用程序后重试。';
  return '摄像头启动失败。请检查设备和浏览器权限后重试，仍可使用原有出拳按钮。';
}

export default function CameraInput(props: Props) {
  const latest = useRef(props);
  latest.current = props;
  const [status, setStatus] = useState<Status>('off');
  const [hint, setHint] = useState('握拳是石头，伸出 V 字是剪刀，张开手掌是布。');
  const [sample, setSample] = useState<GestureSample | null>(null);
  const [points, setPoints] = useState<Point[]>([]);
  const [aspect, setAspect] = useState(4 / 3);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const generation = useRef(0);
  const animation = useRef(0);
  const watchdog = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stabilizer = useRef(new GestureStabilizer());
  const sampleRef = useRef<GestureSample | null>(null);
  const previousPhase = useRef(props.phase);

  const reset = useCallback(() => {
    stabilizer.current.reset();
    sampleRef.current = null;
    setSample(null);
    setPoints([]);
  }, []);

  const release = useCallback(() => {
    generation.current++;
    cancelAnimationFrame(animation.current);
    if (watchdog.current) clearTimeout(watchdog.current);
    watchdog.current = null;
    workerRef.current?.terminate();
    workerRef.current = null;
    for (const track of streamRef.current?.getTracks() ?? []) {
      track.onended = null;
      track.stop();
    }
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    stabilizer.current.reset();
    sampleRef.current = null;
  }, []);

  const close = useCallback((message = '摄像头已关闭，随时可以重新开启。') => {
    release();
    reset();
    setStatus('off');
    setHint(message);
  }, [release, reset]);

  useEffect(() => {
    const hidden = () => { if (document.hidden) close('页面已隐藏，摄像头已关闭。返回后可重新开启。'); };
    const pagehide = () => close();
    document.addEventListener('visibilitychange', hidden);
    window.addEventListener('pagehide', pagehide);
    return () => {
      document.removeEventListener('visibilitychange', hidden);
      window.removeEventListener('pagehide', pagehide);
      release();
    };
  }, [close, release]);

  useEffect(() => { reset(); }, [props.roundKey, props.paused, reset]);
  useEffect(() => {
    if (props.phase === 'menu' && previousPhase.current !== 'menu') close();
    previousPhase.current = props.phase;
  }, [props.phase, close]);

  useEffect(() => {
    if (status !== 'ready') return;
    const timer = setInterval(() => {
      if (sampleRef.current && performance.now() - sampleRef.current.observedAt > MAX_SAMPLE_AGE_MS) {
        reset();
        setHint('画面暂未更新，请保持手部在镜头内。');
      }
    }, 150);
    return () => clearInterval(timer);
  }, [status, reset]);

  async function open() {
    release();
    reset();
    const token = generation.current;
    const fail = (message: string) => {
      if (generation.current !== token) return;
      release();
      reset();
      setStatus('error');
      setHint(message);
    };
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      fail('当前页面无法使用摄像头。请通过 HTTPS 或本机 http://127.0.0.1:5173 打开游戏。');
      return;
    }
    if (!window.Worker || !window.createImageBitmap || !window.OffscreenCanvas) {
      fail('当前浏览器不支持本地手势识别。请使用新版 Chrome 或 Edge，或继续使用出拳按钮。');
      return;
    }
    setStatus('permission');
    setHint('请允许浏览器使用摄像头；不会开启麦克风。');
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 20, max: 30 } } });
    } catch (error) { fail(cameraError(error)); return; }
    if (generation.current !== token) { stream.getTracks().forEach(track => track.stop()); return; }
    streamRef.current = stream;
    for (const track of stream.getVideoTracks()) track.onended = () => fail('摄像头已断开或权限已被撤销，请重新连接后开启。');
    try {
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();
      if (generation.current !== token) return;
      setAspect(video.videoWidth / video.videoHeight || 4 / 3);
      setStatus('loading');
      setHint('画面已连接，正在加载本地识别模型……');
      const worker = new Worker('/vision/gesture-worker.js');
      workerRef.current = worker;
      let busy = false;
      let lastVideoTime = -1;
      let lastSent = 0;
      worker.onerror = event => {
        event.preventDefault();
        fail('识别模块加载失败。请刷新页面或重新启动游戏后重试。');
      };
      const loop = () => {
        if (generation.current !== token) return;
        animation.current = requestAnimationFrame(loop);
        if (latest.current.paused || document.hidden || busy || video.readyState < 2 || video.currentTime === lastVideoTime || performance.now() - lastSent < 100) return;
        busy = true;
        lastVideoTime = video.currentTime;
        lastSent = performance.now();
        const roundKey = latest.current.roundKey;
        const timestamp = lastSent;
        void createImageBitmap(video).then(bitmap => {
          if (generation.current !== token) { bitmap.close(); return; }
          worker.postMessage({ type: 'frame', bitmap, timestamp, roundKey }, [bitmap]);
        }).catch(() => fail('读取摄像头画面失败，请关闭后重新开启。'));
      };
      worker.onmessage = ({ data }: MessageEvent<WorkerMessage>) => {
        if (generation.current !== token) return;
        if (data.type === 'ready') {
          if (watchdog.current) clearTimeout(watchdog.current);
          watchdog.current = null;
          setStatus('ready');
          setHint('请将一只手完整放入画面，掌心朝向镜头。');
          loop();
        } else if (data.type === 'error') {
          fail(data.stage === 'model' ? '识别模型加载失败。请确认模型文件完整，并使用新版浏览器重试。' : '手势识别暂时中断，请关闭摄像头后重新开启。');
        } else {
          busy = false;
          if (data.roundKey !== latest.current.roundKey || latest.current.paused) return;
          const now = performance.now();
          if (now - data.timestamp > MAX_SAMPLE_AGE_MS) { reset(); return; }
          const next = stabilizer.current.update(data.detection, data.timestamp);
          sampleRef.current = next;
          setSample(next);
          setPoints(data.points);
          if (data.detection.handCount > 1) setHint('检测到多只手，请只保留一只手入镜。');
          else if (!data.detection.handCount) setHint('未检测到手，请将手完整放入画面。');
          else if (!next) setHint('手势尚不明确，请做出石头、剪刀或布。');
          else setHint(next.stable ? `已识别为${LABELS[next.move]}，可确认后出拳。` : '请稍微保持手势，正在确认识别结果……');
        }
      };
      watchdog.current = setTimeout(() => fail('识别模型加载超时，请检查浏览器是否支持 WebAssembly，或关闭后重试。'), 45000);
      worker.postMessage({ type: 'init' });
    } catch (error) { fail(cameraError(error)); }
  }

  const enabled = status !== 'off' && status !== 'error';
  const usable = status === 'ready' && !props.paused && props.canSubmit && canUseSample(sample, performance.now());
  const submit = () => {
    const current = sampleRef.current;
    if (!latest.current.canSubmit || latest.current.paused || !canUseSample(current, performance.now())) return;
    reset();
    latest.current.onSubmit(current.move);
  };

  return <section className={`camera-input ${enabled ? 'camera-enabled' : ''}`} aria-label="摄像头手势识别">
    <div className="camera-heading"><span><Camera size={17}/><b>摄像头出拳</b><small>可选</small></span><button className={enabled ? 'text-button' : 'secondary camera-open'} onClick={enabled ? () => close() : open}>{enabled ? <><CameraOff size={15}/>关闭摄像头</> : <><Camera size={15}/>{status === 'error' ? '重试摄像头' : '开启摄像头'}</>}</button></div>
    <div className="camera-content" hidden={!enabled}>
      <div className="camera-preview" style={{ aspectRatio: aspect }}>
        <video ref={videoRef} muted playsInline autoPlay aria-label="摄像头实时预览"/>
        <svg className="camera-landmarks" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">{CONNECTIONS.map(([a,b]) => points[a] && points[b] ? <line key={`${a}-${b}`} x1={points[a].x*100} y1={points[a].y*100} x2={points[b].x*100} y2={points[b].y*100}/> : null)}{points.map((point,index) => <circle key={index} cx={point.x*100} cy={point.y*100} r=".7"/>)}</svg>
        {status === 'permission' || status === 'loading' ? <div className="camera-loading"><LoaderCircle size={24}/><span>{status === 'permission' ? '等待摄像头授权' : '正在加载识别模型'}</span></div> : <span className="camera-live"><i/>实时预览</span>}
      </div>
      <div className="camera-result">
        <span className="camera-result-label">识别到的手势</span>
        <div className={`camera-detected ${sample?.stable ? 'stable' : ''}`} aria-live="polite">{sample ? <><Hand move={sample.move}/><strong>{LABELS[sample.move]}</strong><span>{sample.stable ? <><Check size={14}/>识别稳定</> : '正在确认'}</span></> : <><ScanLine size={38}/><strong>等待手势</strong></>}</div>
        <div className="camera-confidence">{sample ? `识别置信度 ${Math.round(sample.confidence*100)}%` : '保持手部清晰，避免逆光'}</div>
        <div className="camera-stability" aria-hidden="true"><span style={{ width: `${(sample?.progress ?? 0)*100}%` }}/></div>
        <button className="primary camera-submit" disabled={!usable} onClick={submit}>使用{sample?.stable ? `「${LABELS[sample.move]}」` : '此手势'}出拳</button>
        {!props.canSubmit && <small className="camera-round-hint">{props.phase === 'menu' ? '可先练习识别，开始游戏后再出拳' : props.phase === 'result' ? '点击“下一局”后可再次出拳' : '正在揭晓本局结果'}</small>}
      </div>
    </div>
    <p className={`camera-hint ${status === 'error' ? 'camera-error' : ''}`} role="status">{hint}</p>
    <p className="camera-privacy"><ShieldCheck size={13}/>画面仅在本机识别，不录制、不上传；识别结果须确认后才出拳。</p>
  </section>;
}
