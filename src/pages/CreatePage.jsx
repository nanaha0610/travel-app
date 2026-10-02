import { useEffect, useRef, useState } from 'react';
import PageShell from '../components/PageShell.jsx';
import './CreatePage.css';

export default function CreatePage() {
  const live = useRef(null);
  const media = useRef(null);
  const recorder = useRef(null);
  const timer = useRef(null);
  const clip = useRef('');
  const generation = useRef(0);
  const [phase, setPhase] = useState('idle');
  const [url, setUrl] = useState('');
  const [seconds, setSeconds] = useState(5);
  const [error, setError] = useState('');
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
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: true });
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
      const capture = new MediaRecorder(media.current, mimeType ? { mimeType } : undefined);
      recorder.current = capture;
      const chunks = [];
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
      setSeconds(5);
      setPhase('recording');
      const start = performance.now();
      timer.current = setInterval(() => {
        const remaining = Math.max(0, 5 - (performance.now() - start) / 1000);
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
    <PageShell title="旅を記録する" description="5秒の動画で、旅の思い出を残そう。">
      <div className="capture-frame">
        <video ref={live} autoPlay muted playsInline hidden={!['opening', 'ready', 'recording', 'processing'].includes(phase)} aria-label="カメラの映像" />
        {phase === 'preview' && <video src={url} controls playsInline aria-label="撮影した動画" />}
        {phase === 'idle' && <p>旅先の景色を撮影しよう</p>}
        {phase === 'opening' && <p className="capture-overlay" role="status">カメラの許可を待っています…</p>}
        {phase === 'recording' && <p className="capture-overlay" role="status">● 撮影中 あと{seconds}秒</p>}
      </div>
      <div className="capture-actions">
        {phase === 'idle' && <button onClick={openCamera}>カメラを起動</button>}
        {phase === 'ready' && <button onClick={record}>5秒撮影する</button>}
        {phase === 'recording' && <button onClick={stop}>撮影を終了</button>}
        {phase === 'processing' && <p role="status">動画を準備しています…</p>}
        {phase === 'preview' && <button onClick={openCamera}>撮り直す</button>}
      </div>
      {error && <p className="capture-error" role="alert">{error}</p>}
      <p className="status-note">音声も録音します。動画はこの画面での確認用です。投稿・保存はまだ行わず、画面を移動すると消えます。</p>
    </PageShell>
  );
}
