# Senior Language OS v2

Dil içeriğinden bağımsız çalışan 30 günlük öğrenme motoru.

## Çekirdek modüller
- Sentence Engine: chunk/slot tabanlı üretim
- Active Recall: cevap açılana kadar geçen süreyi ölçer; hedef <3 sn
- Listening Lab: dinle -> dictation -> transcript -> tekrar dinle
- Mutation Drill: tek bileşeni değiştirerek yapı otomasyonu
- Speaking Mission: senaryo varyasyonları, 4-3-2 zamanlayıcı, aynı görevi ikinci tur
- Local voice recording: tarayıcı mikrofonuyla haftalık/mission kaydı
- Error Loop: tekrar eden hataları sayar, en önemli 3 hatayı öne çıkarır
- Personal Lexicon: öğrencinin kendi hayatından çıkan ifadeler
- 30-day phases + local progress
- JSON language packs
- Production-ready 30-day English pack

## Dil ekleme
`packs/demo.json` dosyasını kopyalayın ve hedef dile göre `engine`, `recall`, `listening`, `drills`, `mission` alanlarını doldurun. Uygulama kodunu çatallamayın.

## Çalıştırma
En güvenlisi klasörde basit bir HTTP server açmaktır:
`python3 -m http.server 8000`
Sonra `http://localhost:8000` adresini açın.

Not: TTS tarayıcının speechSynthesis özelliğini, ses kaydı MediaRecorder/getUserMedia özelliğini kullanır. Bunlar tarayıcı desteğine ve mikrofon iznine bağlıdır.

## Repository structure

```text
.
├── index.html
├── app.js
├── styles.css
├── language-pack.schema.json
├── packs/
│   ├── demo.json
│   └── english-30-day.json
├── VIDEO_INTEGRATION.md
├── ROADMAP.md
└── README.md
```

## Product principle

The engine is language-agnostic. A new language should be added as a language pack instead of forking the application.


## Varsayılan kurs

Uygulama artık `packs/english-30-day.json` paketini varsayılan olarak açar. Paket 30 gün / 6 faz / günlük 60 dakika yapısındadır.
