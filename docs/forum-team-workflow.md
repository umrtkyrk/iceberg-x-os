# Cube Forum ekip çalışma düzeni

Forum geliştirmesi `umrtkyrk/iceberg-x-os` fork'unda yapılır. `yemrealtanay/iceberg-x-os` yalnızca upstream referansıdır. Bu görev kapsamında orijinal repoya push, PR, merge, deploy veya uzak repo senkronizasyonu yapılmaz. Bu çalışma sınırı, üst projedeki iki üretim reposunu eşitleme yönergelerinden önceliklidir; `scripts/sync-remotes.sh --apply` bu fork çalışması için kullanılmaz.

## Ekip

- Mesut Umur Tokyürek: `umrtkyrk`
- Medine Kaynak: `u230709007`

## Yerel kurulum ve uzak repolar

```bash
git clone https://github.com/umrtkyrk/iceberg-x-os.git
cd iceberg-x-os
git remote add upstream https://github.com/yemrealtanay/iceberg-x-os.git
git remote set-url --push upstream https://example.invalid/upstream-push-disabled
git config remote.pushDefault origin
git config push.default current
git switch --track origin/forum-mvp
```

`origin` fork'tur. `upstream` orijinalden yalnızca güncelleme almak içindir. Git ayarları yereldir; her ekip üyesi kendi klonunda yapmalıdır. URL'yi doğrudan yazarak yapılan push işlemleri bu uzak repo ayarlarıyla engellenmez; hedef her zaman fork olmalıdır.

## Dallar ve PR'lar

`main`, fork'un son yayın sürümüdür; `forum-mvp` ortak entegrasyon dalıdır. Her yeni tasarım veya düzeltme ayrı bir branch'te yapılır ve PR ile `forum-mvp` içine alınır. Fork yayını için `forum-mvp` → aynı fork'un `main` dalına ayrıca PR açılır. Her iki dal korunur; gerekli GitHub inceleme ve kontrolleri atlanmaz.

PR açarken hedefi özellikle kontrol edin:

- Base repository: **umrtkyrk/iceberg-x-os**
- Base branch: özellik/düzeltme için **forum-mvp**, fork yayını için **main**

GitHub, fork'tan PR açarken varsayılan olarak upstream'i önerebilir. Hedef her zaman aynı fork olarak seçilir; üretim portalına katkı gönderilmez. Eski tasarımlar ve branch temizliği [arşiv listesinde](repository-branches.md) açıklanır; farklı commit içeren çalışma önce doğrulanmış uzak etiketle korunur.

## Forum kapsamı

Konu/yanıt, kategoriler, Markdown, soft-delete, üç kazanılmış rozetten sıralı vitrin, imza, takip/@mention/yanıt bildirimleri, rapor ve moderasyon. Önceki tasarım gereksinimleri olan quest etiketi ve iş dışı sohbet alanı korunur. Feature flag, additive migration, rol ve sahiplik kontrolleri, hata sanitizasyonu ve backend testleri gereklidir. Beğeni/reaksiyon, e-posta özeti ve Radar/MVCubes puanlaması uygulanmamıştır; görsel yükleme ve kabul edilen cevap ise ilk MVP tanımının üzerinde mevcut ek özelliklerdir.

Mevcut `mock-forum`, UI V4 ve UI V5 tarihsel tasarım referanslarıdır. Güncel API, feature flag, yetki, moderasyon ve güvenli yerel kurulum için [forum kılavuzuna](forum.md), 2–3 dakikalık sunum için [demo senaryosuna](forum-demo.md) bakın. İlk görevde kapsam dışı olan görsel yükleme/paste ve kabul edilen cevap, son real-api sürümünde ek özellik olarak mevcuttur; diğer kapsam dışı maddeler uygulanmamıştır.

## Kontroller

Frontend değişikliklerinde `cd frontend && npm run build`; backend değişikliklerinde ilgili testler ve derleme çalıştırılır. `.env`, token, parola, yerel veritabanı ve yüklenen dosyalar commit edilmez. Lokal incelemede üretim veritabanı kullanılmaz.

Temiz veritabanında eski portal migration sırası `Quest` tablosunu oluşturmadan değiştirir. Tarihsel dosyalar yeniden yazılmaz: boş localhost şeması için `npm run db:forum:init --prefix backend` kullanılır. Mevcut migration geçmişi olan yerel portalda önce `db:forum:plan`, sonra `db:forum:migrate` çalıştırılır. Bu komutlar bekleyen kategori-adı UPDATE adımlarını uygulamadan geçmişe kaydeder ve var olan adları/açıklamaları korur. Doğrudan tarihsel SQL zincirini çalıştırmak bu korumayı atlar; tam yöntem ve testler forum kılavuzundadır.
