// Day boundaries follow the viewer's device timezone, as in the capture screen.
export function localDateKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function groupVideosByDay(videos) {
  const days = new Map();
  const ordered = [...videos].sort((a, b) => new Date(a.captured_at) - new Date(b.captured_at)
    || String(a.id).localeCompare(String(b.id), 'en', { numeric: true }));
  for (const video of ordered) {
    const day = localDateKey(video.captured_at);
    if (!day) continue;
    if (!days.has(day)) days.set(day, []);
    days.get(day).push(video);
  }
  return days;
}
