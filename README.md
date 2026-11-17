# makefun-gta6-01-20261117

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Ikhsan1971/makefun-gta6-01-20261117/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Ikhsan1971/makefun-gta6-01-20261117/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An original open-world crime game — a fictional neon port
city, three contracts, traffic, stealable cars, a wanted level with police pursuit,
and a HUD with a minimap. Plain static files under `game/`; no build step, no network,
no dependencies. All art is drawn in code (Canvas 2D) and all sound is synthesized
(Web Audio). No real places, people, brands or games are depicted.

## Run

    node serve.ts            # serves game/ at http://localhost:8080
    # or any static file server pointed at game/, e.g.:
    # cd game && python3 -m http.server 8080

Open http://localhost:8080 in desktop Chrome and press **Enter**.

## Controls

| Input | Action |
| --- | --- |
| WASD / arrow keys | Move on foot · accelerate / brake / steer in a car |
| E | Steal a nearby car · step out of your car |
| F / mouse click | Punch |
| Esc / P | Pause (R restarts the night while paused) |
| Enter | Confirm on the title / game-over / contract-complete screens |

Goal: close the three contracts around the harbor — **Tide Tables** (deliver the
ledger), **Crate Count** (recover four cargo crates), **Neon Getaway** (punch the
three timekeeping gates). Theft, assault and hitting people with a car raise your
wanted level (HEAT stars); cruisers hunt you until you shake them. Health and cash
are on the HUD; your best night (cash, contracts closed, city-clear) is kept in
`localStorage`.

## Screenshots

`screenshots/` holds four real captures of the game, taken with the built-in
deterministic stages (same seed every time):

| File | Stage | Shows |
| --- | --- | --- |
| `1-cover.jpg` | `?shot=cover&seed=1337` | On foot in the city, HUD |
| `2-car.jpg` | `?shot=car&seed=1337` | Driving, 2-star HEAT, minimap |
| `3-chase.jpg` | `?shot=chase&seed=1337` | Mission objective + 3-star police pursuit |
| `4-result.jpg` | `?shot=result&seed=1337` | Contracts complete, progression |

Recapture them with headless Chrome:

    node serve.ts --port 8123 &
    for s in cover car chase result; do
      google-chrome-stable --headless=new --disable-gpu --no-sandbox \
        --window-size=1280,720 --hide-scrollbars --virtual-time-budget=3000 \
        --screenshot=/tmp/$s.png "http://localhost:8123/?shot=$s&seed=1337"
    done
    magick /tmp/cover.png -quality 82 screenshots/1-cover.jpg   # and the rest

(Any JPEG encoder works; each file must stay ≤ 256 KiB, ≤ 1280 px on its long side.)

## Tests

    node tests/smoke.mjs     # headless simulation checks (no browser needed)

Verifies: the city generates with buildings/cars/pedestrians, the player stays in the
world, car theft raises heat, the full three-contract chain pays out and sets the
completion flag, police respond to a wanted level, lethal damage ends the run, and the
best-run save is written to `localStorage`.

## Dossier

    mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

`main.ts` copies `game/` and `screenshots/` to the output dir and writes
`dossier.json` with the kit's vendored `vendor/makefun-game.ts` (unchanged).

## Layout

    game/index.html    shell page (canvas + status line)
    game/styles.css    page chrome
    game/src/config.js tuning constants and palette
    game/src/city.js   procedural city generation + static pre-render + collision
    game/src/entities.js player, traffic, pedestrians, police AI, wanted logic
    game/src/missions.js the three contracts, markers, rewards
    game/src/render.js world/HUD/screens rendering, minimap
    game/src/input.js  keyboard + mouse
    game/src/audio.js  synthesized Web Audio SFX and engine hum
    game/src/save.js   localStorage best-run persistence
    game/src/shots.js  deterministic ?shot= stages for screenshots
    game/src/main.js   boot, state machine, frame loop
    tests/smoke.mjs    headless gameplay smoke test

---

<sub>Entered on [make.fun](https://make.fun/?ref=ajkq5baq&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
