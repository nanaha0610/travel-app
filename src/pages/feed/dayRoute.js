// Use Japan time for the trip day, independently of the viewer's time zone.
export function tripDay(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('sv-SE', {timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
}
export function dayRoute(videos, current) {
  const day=tripDay(current.captured_at);
  const places=[];
  for(const video of videos){
    if(tripDay(video.captured_at)!==day)continue;
    const name=video.place_name?.trim()||'場所未設定';
    if(places.at(-1)!==name)places.push(name);
  }
  return {day,places};
}
