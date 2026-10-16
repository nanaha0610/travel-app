import { useEffect, useRef, useState } from 'react';

import './CreatePage.css';

export default function CameraCapture({ onCapture, onBusy }) {
  const live = useRef(null);
  const media = useRef(null);
  const recorder = useRef(null);
  const timer = useRef(null);
  const clip = useRef('');
  const generation = useRef(0);
  const [phase, setPhase] = useState('idle');
  const [url, setUrl] = useState('');
  const [seconds, setSeconds] = useState(3);
  const [error, setError] = useState('');
  useEffect(() => { onBusy(['opening', 'ready', 'recording', 'processing'].includes(phase)); }, [phase, onBusy]);
  function release() {
    media.current?.getTracks().forEach(track => track.stop());
    media.current = null;
  }
  useEffect(() => () => {
    generation.current++;
    clearInterval(timer.current);
    if (recorder.current) {
      recorder.current.onstop = null;
      recorder.current.ondataavailable = null;
      recorder.current.onerror = null;
      if (recorder.current.state !== 'inactive') recorder.current.stop();
    }
    release();
    if (clip.current) URL.revokeObjectURL(clip.current);
  }, []);

  async function openCamera() {
    setError('');
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setError('HTTPSのページ、またはPCのlocalhostで開いてください。');
      return;
    }
    if (!window.MediaRecorder) {
      setError('このブラウザは録画に対応していません。別のブラウザでお試しください。');
      return;
    }
    const id = ++generation.current;
    setPhase('opening');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24, max: 30 } }, audio: true });
      if (id !== generation.current) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      media.current = stream;
      live.current.srcObject = stream;
      await live.current.play();
      if (id !== generation.current) return;
      if (clip.current) URL.revokeObjectURL(clip.current);
      clip.current = '';
      setUrl('');
      onCapture(null);
      setPhase('ready');
    } catch (e) {
      if (id !== generation.current) return;
      release();
      setError(e.name === 'NotAllowedError'
        ? 'カメラとマイクの使用をブラウザのサイト設定で許可してください。'
        : 'カメラを起動できません。カメラ・マイクの接続や、ほかのアプリが使用していないか確認してください。');
      setPhase(clip.current ? 'preview' : 'idle');
    }
  }
  function cancelCamera() {
    generation.current++;
    release();
    setPhase(clip.current ? 'preview' : 'idle');
  }
  function stop() {
    clearInterval(timer.current);
    if (recorder.current?.state === 'recording') {
      setPhase('processing');
      recorder.current.stop();
    }
  }
  function record() {
    setError('');
    try {
      const mimeType = ['video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'].find(type => MediaRecorder.isTypeSupported(type));
      const capture = new MediaRecorder(media.current, { ...(mimeType ? { mimeType } : {}), videoBitsPerSecond: 1200000, audioBitsPerSecond: 64000 });
      recorder.current = capture;
      const chunks = [];
      const capturedAt = new Date().toISOString();
      capture.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
      capture.onstop = () => {
        clearInterval(timer.current);
        release();
        recorder.current = null;
        const blob = new Blob(chunks, { type: capture.mimeType || chunks[0]?.type });
        if (!blob.size) {
          setError('動画を記録できませんでした。もう一度撮影してください。');
          setPhase('idle');
          return;
        }
        onCapture({ blob, capturedAt, uploadId: crypto.randomUUID() });
        clip.current = URL.createObjectURL(blob);
        setUrl(clip.current);
        setPhase('preview');
      };
      capture.onerror = () => {
        capture.onstop = null;
        clearInterval(timer.current);
        release();
        recorder.current = null;
        setError('録画に失敗しました。もう一度お試しください。');
        setPhase('idle');
      };
      capture.start();
      setSeconds(3);
      setPhase('recording');
      const start = performance.now();
      timer.current = setInterval(() => {
        const remaining = Math.max(0, 3 - (performance.now() - start) / 1000);
        setSeconds(Math.ceil(remaining));
        if (remaining === 0) stop();
      }, 100);
    } catch {
      release();
      setPhase('idle');
      setError('録画を開始できませんでした。カメラを起動し直してください。');
    }
  }
  return (
    <div>
      <div className="capture-frame">
        <video ref={live} autoPlay muted playsInline hidden={!['opening', 'ready', 'recording', 'processing'].includes(phase)} aria-label="カメラの映像" />
        {phase === 'preview' && <video src={url} controls playsInline aria-label="撮影した動画" />}
        {phase === 'idle' && <p>旅先の景色を撮影しよう</p>}
        {phase === 'opening' && <p className="capture-overlay" role="status">カメラの許可を待っています…</p>}
        {phase === 'recording' && <p className="capture-overlay" role="status">● 撮影中 あと{seconds}秒</p>}
      </div>
      <div className="capture-actions">
        {phase === 'idle' && <button onClick={openCamera}>カメラを起動</button>}
        {phase === 'ready' && <button onClick={record}>3秒撮影する</button>}
        {['opening', 'ready'].includes(phase) && <button onClick={cancelCamera}>カメラを閉じる</button>}
        {phase === 'recording' && <button onClick={stop}>撮影を終了</button>}
        {phase === 'processing' && <p role="status">動画を準備しています…</p>}
        {phase === 'preview' && <button onClick={openCamera}>撮り直す</button>}
      </div>
      {error && <p className="capture-error" role="alert">{error}</p>}
      <p className="status-note">音声も録音します。撮影後に「この旅行に保存」を押してください。保存前に画面を移動すると動画は消えます。</p>
    </div>
  );
}
