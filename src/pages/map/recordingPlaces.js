export function groupRecordingPlaces(videos) {
  const places = new Map();
  for (const video of videos) {
    const name = video.place_name || '場所未設定';
    const lat = video.latitude == null || video.latitude === '' ? NaN : Number(video.latitude);
    const lng = video.longitude == null || video.longitude === '' ? NaN : Number(video.longitude);
    const located = Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
    const key = JSON.stringify([name, located ? lat : null, located ? lng : null]);
    if (!places.has(key)) places.set(key, { key, name, lat, lng, located, videos: [] });
    places.get(key).videos.push(video);
  }
  return [...places.values()];
}
