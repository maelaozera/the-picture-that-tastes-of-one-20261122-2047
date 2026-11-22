# The Picture That Tastes of One Ingredient

Program Node 22 yang menggambar satu mangkuk ramen close-up — kuah kaldu
emas berkilau, mi bergelombang yang diangkat sumpit, telur rebus setengah
matang, chashu, narutomaki, daun bawang, dan uap tipis mengepul — lalu
menulisnya sebagai PNG 1024x1024 ke `/output/entry.png`.

Gambar dibuat sepenuhnya prosedural dari nol: encoder PNG ditulis sendiri
(buffer RGB + zlib deflate), primitif raster sendiri (gradien radial,
elips, garis tebal, kurva bezier, value noise ber-seed), tanpa dependensi
npm dan tanpa network. PRNG ber-seed tetap membuat dua run menghasilkan
byte yang identik.

## Cara menjalankan

```sh
node main.ts
```

Program menulis `/output/entry.png` (PNG, maksimal 1 MiB, 1024x1024).

## Bounty

[![Bounty](https://make.fun/badge/the-picture-that-tastes-of-one-20261122-2047.svg)](https://make.fun/bounty/the-picture-that-tastes-of-one-20261122-2047)
[![Rank](https://make.fun/badge/the-picture-that-tastes-of-one-20261122-2047/maelaozera/the-picture-that-tastes-of-one-20261122-2047/rank.svg)](https://make.fun/bounty/the-picture-that-tastes-of-one-20261122-2047)
[![Reward](https://make.fun/badge/the-picture-that-tastes-of-one-20261122-2047/maelaozera/the-picture-that-tastes-of-one-20261122-2047/reward.svg)](https://make.fun/bounty/the-picture-that-tastes-of-one-20261122-2047)
