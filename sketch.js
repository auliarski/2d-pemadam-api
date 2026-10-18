// ===== Pengaturan =====
// Ukuran dunia game (satuan logis). Diatur otomatis agar memenuhi seluruh layar.
const BASE_W = 640, BASE_H = 480;   // ukuran minimal area permainan
let W = BASE_W, H = BASE_H;         // ukuran dunia game saat ini
let S = 1;                          // skala dunia game -> piksel layar
let GROUND = H - 60;                // posisi tanah

function hitungUkuran() {
  S = min(windowWidth / BASE_W, windowHeight / BASE_H);
  W = windowWidth / S;
  H = windowHeight / S;
  GROUND = H - 60;
}
const JUMLAH_API = 5;
const WAKTU_AWAL = 60;     // detik
const NYAWA_AWAL = 3;

let pemadam;               // objek utama
let apiList = [];          // target (api yang harus dipadamkan)
let botolList = [];        // objek bonus (isi ulang air)
let baraList = [];         // rintangan (bara jatuh)
let tetes = [];            // partikel air (efek visual)
let skor, nyawa, waktu, status; // status: 'main' | 'menang' | 'kalah'
let alasan = '';
let timerBotol, timerBara;

function setup() {
  hitungUkuran();
  createCanvas(windowWidth, windowHeight);
  textFont('Arial');
  resetGame();
}

function resetGame() {
  pemadam = { x: W / 2, w: 36, h: 56, speed: 5, arah: 1, air: 100, kebal: 0, nyemprot: false };
  apiList = [];
  for (let i = 0; i < JUMLAH_API; i++) {
    apiList.push({ x: 70 + i * ((W - 140) / (JUMLAH_API - 1)), hp: 100, maxHp: 100, mati: false, seed: random(1000) });
  }
  botolList = [];
  baraList = [];
  tetes = [];
  skor = 0;
  nyawa = NYAWA_AWAL;
  waktu = WAKTU_AWAL;
  status = 'main';
  alasan = '';
  timerBotol = 120;
  timerBara = 60;
}

// Dipanggil saat ukuran jendela berubah: sesuaikan canvas dan posisi objek
function windowResized() {
  let wLama = W;
  hitungUkuran();
  resizeCanvas(windowWidth, windowHeight);
  let rasio = W / wLama;
  if (pemadam) pemadam.x *= rasio;
  for (let f of apiList) f.x *= rasio;
  for (let b of botolList) b.x *= rasio;
  for (let b of baraList) b.x *= rasio;
  tetes = [];
}

function draw() {
  push();
  scale(S);
  gambarLatar();
  if (status === 'main') update();
  gambarApi();
  gambarBotol();
  gambarBara();
  gambarTetes();
  gambarPemadam();
  gambarHUD();
  if (status !== 'main') gambarAkhir();
  pop();
}

// ===== Logika =====
function update() {
  // Waktu
  waktu -= deltaTime / 1000;
  if (waktu <= 0) { waktu = 0; status = 'kalah'; alasan = 'Waktu habis!'; }

  // Kontrol: keyboard (panah / A D) atau mouse (geser = gerak, klik = semprot)
  let gerak = 0;
  if (keyIsDown(LEFT_ARROW) || keyIsDown(65)) gerak -= 1;
  if (keyIsDown(RIGHT_ARROW) || keyIsDown(68)) gerak += 1;
  if (gerak !== 0) {
    pemadam.x += gerak * pemadam.speed;
    pemadam.arah = gerak;
  } else if (movedX !== 0 && mouseX > 0 && mouseX < width) {
    let sebelum = pemadam.x;
    pemadam.x = lerp(pemadam.x, mouseX / S, 0.25);
    if (abs(pemadam.x - sebelum) > 0.3) pemadam.arah = pemadam.x > sebelum ? 1 : -1;
  }
  pemadam.x = constrain(pemadam.x, pemadam.w / 2, W - pemadam.w / 2);

  // Menyemprot air
  pemadam.nyemprot = (keyIsDown(32) || mouseIsPressed) && pemadam.air > 0;
  if (pemadam.nyemprot) {
    pemadam.air = max(0, pemadam.air - 0.45);
    buatTetes();
    for (let f of apiList) {
      if (f.mati) continue;
      let jarak = (f.x - pemadam.x) * pemadam.arah;   // positif = di depan
      if (jarak > -15 && abs(f.x - pemadam.x) < 120) {
        f.hp -= 0.9;
        if (f.hp <= 0) {
          f.hp = 0;
          f.mati = true;
          skor += 100;
        }
      }
    }
  }

  // Api yang belum padam pelan-pelan membesar lagi
  for (let f of apiList) {
    if (!f.mati) f.hp = min(f.maxHp, f.hp + 0.04);
  }

  // Spawn botol air
  timerBotol--;
  if (timerBotol <= 0) {
    timerBotol = random(150, 260);
    botolList.push({ x: random(30, W - 30), y: -20, r: 14, v: 2.3 });
  }

  // Spawn bara (makin banyak jika api masih banyak)
  let apiHidup = apiList.filter(f => !f.mati).length;
  timerBara--;
  if (timerBara <= 0) {
    timerBara = max(25, 85 - apiHidup * 8) + random(0, 20);
    baraList.push({ x: random(20, W - 20), y: -20, r: 11, v: random(2.5, 4.5) + (WAKTU_AWAL - waktu) * 0.02 });
  }

  // Gerak + tabrakan botol
  for (let i = botolList.length - 1; i >= 0; i--) {
    let b = botolList[i];
    b.y += b.v;
    if (tabrak(b)) {
      pemadam.air = min(100, pemadam.air + 40);
      skor += 10;
      botolList.splice(i, 1);
    } else if (b.y > H + 20) botolList.splice(i, 1);
  }

  // Gerak + tabrakan bara
  pemadam.kebal = max(0, pemadam.kebal - 1);
  for (let i = baraList.length - 1; i >= 0; i--) {
    let b = baraList[i];
    b.y += b.v;
    if (tabrak(b)) {
      if (pemadam.kebal === 0) {
        nyawa--;
        pemadam.kebal = 60;
        if (nyawa <= 0) { status = 'kalah'; alasan = 'Nyawa habis!'; }
      }
      baraList.splice(i, 1);
    } else if (b.y > GROUND + 10) baraList.splice(i, 1);
  }

  // Menang jika semua api padam
  if (apiList.every(f => f.mati)) {
    skor += floor(waktu) * 5;   // bonus sisa waktu
    status = 'menang';
  }
}

function pemadamY() { return GROUND - pemadam.h / 2; }

// Deteksi tabrakan objek lingkaran vs kotak pemadam
function tabrak(o) {
  return abs(o.x - pemadam.x) < pemadam.w / 2 + o.r * 0.8 &&
         abs(o.y - pemadamY()) < pemadam.h / 2 + o.r * 0.8;
}

function buatTetes() {
  let x0 = pemadam.x + pemadam.arah * 22;
  let y0 = pemadamY() - 6;
  for (let i = 0; i < 3; i++) {
    tetes.push({
      x: x0, y: y0,
      vx: pemadam.arah * random(4, 7),
      vy: random(-2.5, -0.5),
      umur: 28
    });
  }
}

// ===== Tampilan =====
function gambarLatar() {
  background(24, 28, 38);
  // gedung latar
  noStroke();
  fill(34, 40, 54);
  let jmlGedung = ceil(W / 85) + 1;
  for (let i = 0; i < jmlGedung; i++) {
    let bw = 70, bh = 120 + (i * 53) % 110;
    rect(i * 85 - 10, GROUND - bh, bw, bh);
  }
  // cahaya jendela
  fill(255, 200, 80, 90);
  for (let i = 0; i < jmlGedung; i++) {
    for (let j = 0; j < 3; j++) rect(i * 85 + 8, GROUND - 110 + j * 30, 10, 14);
  }
  // tanah
  fill(60, 52, 48);
  rect(0, GROUND, W, H - GROUND);
  fill(80, 70, 62);
  rect(0, GROUND, W, 6);
}

function gambarApi() {
  for (let f of apiList) {
    if (f.mati) {
      // sisa asap
      fill(150, 150, 150, 80);
      noStroke();
      circle(f.x + sin(frameCount * 0.05 + f.seed) * 4, GROUND - 14, 16);
      continue;
    }
    let s = map(f.hp, 0, 100, 0.35, 1);
    push();
    translate(f.x, GROUND);
    noStroke();
    for (let k = 0; k < 3; k++) {
      let n = noise(f.seed + frameCount * 0.08 + k * 10);
      let tinggi = (50 + n * 35) * s * (1 - k * 0.25);
      let lebar = (34 - k * 9) * s;
      fill(255 - k * 10, 90 + k * 60, 20 + k * 20, 230);
      ellipse(0, -tinggi / 2, lebar, tinggi);
    }
    pop();
    // bar kesehatan api
    fill(0, 120);
    rect(f.x - 20, GROUND + 10, 40, 5, 3);
    fill(255, 120, 30);
    rect(f.x - 20, GROUND + 10, 40 * (f.hp / 100), 5, 3);
  }
}

function gambarBotol() {
  for (let b of botolList) {
    push();
    translate(b.x, b.y);
    noStroke();
    fill(80, 170, 255);
    rect(-8, -12, 16, 24, 4);
    fill(220);
    rect(-4, -17, 8, 6, 2);
    fill(255, 255, 255, 140);
    rect(-5, -8, 3, 14, 2);
    pop();
  }
}

function gambarBara() {
  for (let b of baraList) {
    noStroke();
    fill(255, 140, 30, 90);
    circle(b.x, b.y - 8, b.r * 2.4);
    fill(255, 80, 20);
    circle(b.x, b.y, b.r * 2);
    fill(255, 220, 90);
    circle(b.x, b.y, b.r);
  }
}

function gambarTetes() {
  noStroke();
  for (let i = tetes.length - 1; i >= 0; i--) {
    let t = tetes[i];
    t.x += t.vx;
    t.y += t.vy;
    t.vy += 0.25;
    t.umur--;
    fill(130, 200, 255, map(t.umur, 0, 28, 0, 230));
    circle(t.x, t.y, 6);
    if (t.umur <= 0 || t.y > GROUND) tetes.splice(i, 1);
  }
}

function gambarPemadam() {
  // kedip saat kebal
  if (pemadam.kebal > 0 && floor(frameCount / 4) % 2 === 0) return;
  push();
  translate(pemadam.x, pemadamY());
  scale(pemadam.arah, 1);
  noStroke();
  // tangki air di punggung
  fill(70, 130, 200);
  rect(-24, -14, 12, 28, 4);
  // badan
  fill(210, 50, 40);
  rect(-14, -16, 28, 40, 5);
  fill(240, 220, 60);
  rect(-14, 6, 28, 5);
  // kaki
  fill(40, 40, 50);
  rect(-12, 24, 10, 6);
  rect(2, 24, 10, 6);
  // kepala + helm
  fill(240, 200, 160);
  circle(0, -24, 18);
  fill(240, 200, 40);
  arc(0, -26, 24, 20, PI, TWO_PI);
  rect(-13, -27, 26, 3);
  // selang
  fill(60);
  rect(10, -8, 18, 6, 3);
  pop();
}

function gambarHUD() {
  noStroke();
  fill(255);
  textSize(18);
  textAlign(LEFT, CENTER);
  text('Skor: ' + skor, 14, 20);
  text('Api: ' + apiList.filter(f => !f.mati).length + ' / ' + JUMLAH_API, 14, 42);
  textAlign(CENTER, CENTER);
  fill(waktu < 10 ? color(255, 90, 90) : 255);
  text('Waktu: ' + ceil(waktu) + ' d', W / 2, 20);
  fill(255);
  textAlign(RIGHT, CENTER);
  text('Nyawa: ' + '♥'.repeat(max(nyawa, 0)), W - 14, 20);

  // bar air
  fill(0, 140);
  rect(W - 154, 36, 140, 12, 6);
  fill(90, 180, 255);
  rect(W - 154, 36, 140 * (pemadam.air / 100), 12, 6);
  fill(255);
  textSize(12);
  textAlign(RIGHT, CENTER);
  text('Air', W - 160, 42);

  if (status === 'main') {
    fill(255, 255, 255, 140);
    textSize(13);
    textAlign(CENTER, CENTER);
    text('← → / A D / mouse: gerak   |   SPASI / klik: semprot air   |   F: layar penuh', W / 2, H - 14);
  }
}

function gambarAkhir() {
  fill(0, 190);
  rect(0, 0, W, H);
  fill(255);
  textAlign(CENTER, CENTER);
  textSize(40);
  text(status === 'menang' ? 'SEMUA API PADAM!' : 'GAME OVER', W / 2, H / 2 - 50);
  textSize(20);
  if (status === 'kalah') text(alasan, W / 2, H / 2 - 10);
  text('Skor akhir: ' + skor, W / 2, H / 2 + 20);
  textSize(16);
  text('Tekan R atau klik untuk main lagi', W / 2, H / 2 + 60);
}

function keyPressed() {
  if (status !== 'main' && (key === 'r' || key === 'R')) resetGame();
  if (key === 'f' || key === 'F') fullscreen(!fullscreen()); // layar penuh browser
  if (key === ' ') return false; // cegah halaman scroll
}
function mousePressed() {
  if (status !== 'main') resetGame();
}
