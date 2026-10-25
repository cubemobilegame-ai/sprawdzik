# EduSkan – wersja testowa na Vercel

Aplikacja dla nauczycieli: skan pracy aparatem, automatyczne sprawdzanie przez Claude API.

## Pliki
- `index.html` – cała aplikacja
- `api/ai.js` – serwer, który trzyma klucz API i wysyła zdjęcia do Claude (nic nie zapisuje)
- `vercel.json` – serwer w Frankfurcie (UE), limit czasu 120 s

## Zmienne środowiskowe (Vercel → Settings → Environment Variables)
| Nazwa | Wartość |
|---|---|
| `ANTHROPIC_API_KEY` | klucz z console.anthropic.com (zaczyna się od `sk-ant-`) |
| `APP_CODE` | dowolny kod, np. `4821` – aplikacja poprosi o niego przy pierwszym uruchomieniu |
| `MODEL_FAST` (opcjonalnie) | domyślnie `claude-haiku-5-5` |
| `MODEL_PRECISE` (opcjonalnie) | domyślnie `claude-sonnet-5-5` |
| `USD_PLN` (opcjonalnie) | kurs do liczenia kosztu, domyślnie `3.7` |

Po dodaniu lub zmianie zmiennych zrób Redeploy.

## Jak liczony jest skan
1. Cała praca czytana przez `MODEL_FAST` (Haiku) – zwięzła odpowiedź JSON.
2. Wątpliwe, błędne i częściowe zadania: drugi odczyt `MODEL_FAST` na powiększonych wycinkach.
3. Tryb dokładny (domyślny): zadania nadal niepewne (maks. 3) czyta `MODEL_PRECISE` (Sonnet), tylko wycinki.

Pod wynikiem każdego skanu widać jego koszt brutto.
