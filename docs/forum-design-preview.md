> Historical reference. For the active ui-v3 implementation, setup and verified scope see [forum-ui-v3.md](forum-ui-v3.md).

# Cube Forum: portal içinde tasarım önizlemesi

`umrtkyrk/mock-forum` tasarımı bu fork'un React 18 uygulamasına taşındı. Portal oturumu gerektirir; üst menü ve footer portalın mevcut Layout bileşeninden gelir. `Community > Forum`, `/forum` rotasını açar.

## Açma

Önizleme varsayılan olarak kapalıdır. `frontend/.env.local` oluşturun:

```dotenv
VITE_CUBE_FORUM_PREVIEW=true
```

```bash
cd frontend
npm ci
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

Portal API'si yerel `http://localhost:5001` adresinde çalışmalıdır. Portal hesabıyla giriş yaptıktan sonra `http://localhost:5173/forum` adresini açın. Flag değiştiğinde Vite sunucusunu yeniden başlatın; build için flag derleme anında okunur. Değer `true` olmadığında menü ve route eklenmez; doğrudan `/forum` isteği mevcut catch-all ile dashboard'a döner. `.env.local` Git'e dahil edilmez.

Bu flag yalnızca frontend tasarım önizlemesini kontrol eder. Gelecekteki forum API'sinin feature flag veya yetki uygulaması değildir.

## Taşınan tasarım

Kategoriler, topluluk akışı, arama, quest filtresi, kaydetme/takip, konu ve yanıt oluşturma/düzenleme, yanıt sayfalaması, rapor formu, imza ve üçlü rozet vitrini önizlemesi. Mobil gezinme ve modal klavye odağı korunur. Portalın ortak MarkdownEditor bileşeni ve güvenli Markdown renderer kullanılır; görsel render edilmez.

Portal kullanıcısının kimliği, avatarı, gelişim aşaması ve kazanılmış rozetleri mevcut oturum ve profil API'sinden okunur. Avatar aşaması kullanıcı tarafından seçilmez. Kişinin vitrin seçimi yalnızca kendi kazanılmış rozetlerine göre süzülür. Adaylık `is_senior_candidate` ve `current_level` üzerinden belirlenir. Sunucuya profil yazılmaz.

Örnek konular/profiller `demo-data.js` içindedir; bunlar gerçek portal kullanıcı kayıtları değildir. Konu, yanıt, örnek bildirim, rapor formu, imza ve vitrin tercihlerinin etkileşimleri bu aşamada frontend demosudur. Yerel değişiklikler kullanıcı kimliğine ayrılan `cube-forum-preview-v2:<userId>:` anahtarlarıyla tarayıcıda saklanır. Takip ve rapor işlemleri diğer Cubelara veya moderatörlere iletilmez. Silme, görevdeki veritabanı soft-delete davranışını henüz uygulamaz.

Üç sahte rozet kazanmış gibi gösterilmez: hesabın kazanılmış rozeti yoksa vitrin boş durum gösterir. Örnek çevrimiçi/XP/puan istatistikleri kaldırıldı; kartlarda önizlemedeki gerçek yerel katkı sayıları kullanılır.

## Kod sınırları

- `frontend/src/pages/forum/Forum.tsx`: typed portal adapter; loading/error/retry durumları.
- `ForumPreview.jsx` + `ForumPreview.d.ts`: eski tasarımı koruyan JSX görünümü ve typed prop sınırı. Portalın TypeScript strict ayarları gevşetilmedi; retained JSX'in tamamı TypeScript'e dönüştürülmüş değildir.
- `previewModel.ts`: yerel tercih doğrulama ve duyuru UI kuralı. Backend izin kontrolünün yerine geçmez.
- `forum.css`: tüm selector'lar `.cube-forum` ile sınırlı, animasyon adları da ayrılmıştır. Global body/root veya portal buton stilleri değiştirilmez.

Yeni npm bağımlılığı, iframe, yeni React runtime veya veritabanı migration'ı eklenmedi. Normal portal sayfaları ve backend değiştirilmedi.

## Kontroller ve sonraki aşama

```bash
cd frontend
npm run test:forum
npm run check:forum
npm run build
```

Testler projedeki TypeScript derleyicisini kullanır; Node'un yerleşik TypeScript type-stripping desteğini gerektirmez. Yerel kontroller Node 24 ile çalıştırıldı; mevcut Dockerfile Node 18 kullanır ve bu çalışmada değiştirilmedi. Klasik portal backend kurulum ve test adımları ayrıca geçerlidir.

Sonraki iş: görev belgesindeki additive forum veri modeli, gerçek API, soft-delete, sunucu yetkileri/rate limit, bildirim hedefleri, rapor kuyruğu ve moderasyon. Bu PR bunların tamamlandığını iddia etmez. Üretim reposuna push, PR veya deploy yapılmaz; ekip PR hedefi `umrtkyrk/iceberg-x-os` olmalıdır.

Genel `tsc -b` kontrolünde başlangıç portalından gelen 54 hata devam eder; başlangıç referansında 55 hata vardır. Entegrasyon yeni hata eklemez. `check:forum` yeni adapter ve yardımcıları strict ayarlarla ayrıca denetler.
