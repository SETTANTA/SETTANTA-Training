# SETTANTA Training

Web app da palestra: scheda settimanale, carichi, RIR, ultima seduta, progressione e timer di recupero automatico.
Online su GitHub Pages: https://settanta.github.io/SETTANTA-Training/

## Sul telefono
Apri il link in Safari → Condividi → **Aggiungi alla schermata Home**. Funziona anche senza segnale.
I dati restano sul telefono: ogni tanto **Impostazioni → Esporta backup** e salva il file su iCloud Drive.

## Come funziona
- **Serie**: scrivi kg, ripetizioni e RIR, poi ✓. I campi vuoti prendono il valore in grigio (il suggerito).
- **Timer**: parte da solo al ✓ con il recupero dell'esercizio; a fine recupero suona (se il telefono non è in silenzioso).
- **Progressione** (doppia progressione): stesso carico finché *tutte* le serie arrivano in cima al range, poi +1 gradino
  (2,5 kg bilanciere/macchine, 2 kg manubri, 1 kg isolamento, 5 kg leg press) e si riparte dal fondo del range.
  Se metà delle serie restano sotto il range, suggerisce di scalare. Trazioni assistite: si progredisce togliendo assistenza.
- **Blocco**: 6 settimane. RIR bersaglio 2–3 (sett. 1–2), ~2 (3–4), 1–2 (5–6), poi settimana di scarico.

## File
| File | Cosa |
|---|---|
| `index.html` | la pagina |
| `app.js` | scheda (in cima, `PLAN`), logica e salvataggi |
| `app.css` | stile |
| `sw.js` | offline; **alza `CACHE`** a ogni nuova versione |
| `manifest.webmanifest` | nome e icone della web app |
| `icons/` | icone generate; `icons/sorgente/` contiene gli originali |

Per cambiare esercizi, serie o recuperi si modifica `PLAN` in `app.js`.
Nuova versione: aggiorna `VERSION` in `app.js`, i `?v=` in `index.html` e `sw.js`, e `CACHE` in `sw.js`.
