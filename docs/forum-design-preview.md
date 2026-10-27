# Cube Forum — UI V2

Forum, portalın oturum ve gezinme yapısında `/forum` adresinde çalışır. Yeni görünüm tamamen TypeScript'tir. `ui-v2`, fork'un `forum-mvp` sürümünden başlayan tasarım sürümüdür.

## Yerelde açma

`frontend/.env.local` içinde:

```dotenv
VITE_CUBE_FORUM_PREVIEW=true
```

```bash
cd frontend
npm ci
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

Portal API'sini projenin normal yerel kurulumuyla `http://localhost:5001` adresinde çalıştırın; yerel veritabanı ve yerel hesap kullanın. Sonra giriş yapıp `http://localhost:5173/forum` adresini açın. Şifreler, `.env.local` ve yerel veritabanı Git'e eklenmez. Feature flag varsayılan olarak kapalıdır; API izni yerine geçmez.

## Bu sürümde çalışanlar

- Kademe renginde avatar çerçevesi, yazar alanı ve metin etiketi: Cube mavi, Candidate turkuaz, Senior mor, Iceberger altın. Founding Cube, hesap yetkisinden ve gelişim kademesinden ayrı gösterilir.
- Gerçek kazanılmış rozetler ve Common/Rare/Epic/Legendary görünümü; kişinin kendi rozetlerinden en fazla üç tanesini sıralayabildiği vitrin ve 140 karakterlik imza.
- Hall of Fame'den gerçek topluluk listesi; isteğe bağlı yüklenen açık profil kartında başarımlar, beceriler, görünür unvanlar, MVCubes ödülleri ve kişinin paylaşmayı seçtiği en fazla üç anonim teşekkür.
- Oturumdaki Cube'un gerçek quest ilerlemesi, bağımlılık durumu ve quest etiketi; mentor/admin için kişisel ilerleme iddiası taşımayan quest kataloğu. Kişinin görünür mission'larına bağlantı ve konu etiketi.
- Duyuru, yardım, üretim, fikir ve iş dışı sohbet kategorileri; arama, kademe filtresi, okunmamış/en çok konuşulan sıralaması, kaydetme/takip, sayfalama, konu ve yanıt oluşturma/düzenleme/kaldırma.
- Ortak MarkdownEditor, güvenli Markdown görünümü, klavye ile modal kapatma/odak döngüsü, profil açıldığında korunan konu taslağı ve mobil forum menüsü. Dar ekranlarda profil ve quest kartları akışın altına taşınır.

## Veri ve işlem sınırı

Kimlik, başarımlar, questler ve görünür profil bilgileri mevcut portal API'sinden okunur. Forum, açık profil alanlarını tek tek seçer; ham profil/feedback nesnesini saklamaz. Özel feedback, gönderen kimliği, mentor notu, Radar, değerlendirme puanı ve ayrılış yazışmaları forum kartlarına aktarılmaz.

**Takdir butonları mevcut portalın gerçek feedback formunu açar.** Kullanıcı formu gönderirse portal API'sine gerçek bir kayıt yapılır ve mevcut haftalık hak kuralları uygulanır. Önizlemede bu ayrım butonların yanında açıklanır. UI kontrolünde form yalnızca açılıp kapatıldı; feedback gönderilmedi.

Konu/yanıt, kaydetme/takip, imza ve vitrin tercihi bu sürümde tarayıcıya özeldir. Başka cihazlara veya Cubelara ulaşmaz. @mention bildirim oluşturmaz; rapor formu moderatöre rapor göndermez. Quest etiketlemek ilerleme veya rozet kazandırmaz. UI rol ve sahiplik kuralları sunucu yetkilendirmesi değildir.

Yeni kayıt anahtarı `cube-forum-ui-v2:<authUserId>` biçimindedir. Eski sürümün anahtarları silinmez; gerçek oturum kullanıcısının yazdığı konu/yanıtlar ve tercihleri yeni sürüme taşınır. Eski kurgu mesajları gerçek kullanıcıya atfedilmez. Örnek kişiler ve örnek ödüller açıkça kurgu olarak etiketlenir.

## Kod ve doğrulama

- `Forum.tsx`: forum görünümleri ve etkileşimler.
- `portalContext.ts`: izin verilen açık alanların projeksiyonu, kısmi hata ve kısa süreli profil önbelleği.
- `forumModel.ts`, `legacyState.ts`, `types.ts`: yerel veri doğrulama ve sürüm geçişi.
- `fixtures.ts`: kurgusal örnek içerik.
- `forum.css`: bütün seçiciler `.cube-forum-v2` altında; diğer portal sayfalarını etkilemez.

```bash
cd frontend
npm run test:forum
npm run check:forum
npm run build
```

17 test; açık alan seçimi, gizlilik, kısmi API hataları, quest rol ayrımı, üç kazanılmış rozet sınırı, kayıt kurtarma, soft-delete, eski sürüm geçişi ve CSS izolasyonunu kapsar. `check:forum` yeni kodu portalın strict ayarlarıyla denetler. Portalın tamamına ait eski `tsc -b` hataları bu tasarım çalışmasının kapsamı dışındadır.

Gerçek forum API'si, paylaşılmış veritabanı, sunucu tarafında sahiplik/moderasyon/rapor kuyruğu ve bildirim üretimi sonraki aşamadır. Bu sürüm bunların tamamlandığını iddia etmez. Yeni bağımlılık veya veritabanı migration'ı eklenmemiştir.

Tüm geliştirme `umrtkyrk/iceberg-x-os` fork'undadır. Orijinal repoya push, PR, merge veya deploy yapılmaz. Ayrıntılı özellik eşlemesi `forum-portal-integration.md` içindedir.
