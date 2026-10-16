import { useState } from 'react';
import { MapServiceError, searchPlaces } from './routeServices.js';

// 場所を検索して、候補から1つ選んでもらう部品です。
// 「出発地」と「目的地」の両方で同じ部品を使い回しています。
// （ボタンを押したときだけ検索する。入力中の自動検索は Nominatim の利用条件で禁止）
export default function PlaceSearch({ id, label, placeholder, selectMessage, onSelect }) {
  const [keyword, setKeyword] = useState('');
  const [search, setSearch] = useState({ status: 'idle', message: '', results: [] });

  async function handleSearch(event) {
    event.preventDefault();
    if (!keyword.trim() || search.status === 'searching') return;
    setSearch({ status: 'searching', message: '検索しています…', results: [] });
    try {
      const results = await searchPlaces(keyword);
      setSearch({
        status: results.length ? 'success' : 'error',
        message: results.length ? selectMessage : '見つかりませんでした。別の言葉でお試しください。',
        results,
      });
    } catch (error) {
      setSearch({
        status: 'error',
        message: error instanceof MapServiceError ? error.message : '予期しないエラーが起きました。もう一度お試しください。',
        results: [],
      });
    }
  }

  function choose(place) {
    setSearch({ status: 'idle', message: '', results: [] });
    onSelect(place);
  }

  return (
    <>
      <form className="route-search" onSubmit={handleSearch} role="search">
        <label htmlFor={id} className="visually-hidden">{label}</label>
        <input
          id={id}
          type="search"
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          enterKeyHint="search"
        />
        <button type="submit" disabled={!keyword.trim() || search.status === 'searching'}>
          {search.status === 'searching' ? '検索中…' : '検索'}
        </button>
      </form>

      <p className={`map-message ${search.status}`} role="status" aria-live="polite">{search.message}</p>
      {search.results.length > 0 && (
        <ul className="search-results">
          {search.results.map((place) => (
            <li key={place.id}>
              <button type="button" onClick={() => choose(place)}>
                <strong>{place.name}</strong>
                <span>{place.address}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
