# Cube Forum ekip çalışma düzeni

Forum geliştirmesi `umrtkyrk/iceberg-x-os` fork'unda yapılır. `yemrealtanay/iceberg-x-os` yalnızca upstream referansıdır. Bu görev kapsamında orijinal repoya push, PR, merge, deploy veya uzak repo senkronizasyonu yapılmaz. Bu çalışma sınırı, üst projedeki iki üretim reposunu eşitleme yönergelerinden önceliklidir; `scripts/sync-remotes.sh --apply` bu fork çalışması için kullanılmaz.

## Ekip

- Mesut Umur Tokyürek: `umrtkyrk`
- Medine Kaynak: `u230709007` (collaborator davetini GitHub'da kabul etmeli)

## Yerel kurulum ve uzak repolar

```bash
git clone https://github.com/umrtkyrk/iceberg-x-os.git
cd iceberg-x-os
git remote add upstream https://github.com/yemrealtanay/iceberg-x-os.git
git remote set-url --push upstream https://example.invalid/upstream-push-disabled
git config remote.pushDefault origin
git config push.default current
git switch --track origin/codex/forum-mvp
```

`origin` fork'tur. `upstream` orijinalden yalnızca güncelleme almak içindir. Git ayarları yereldir; her ekip üyesi kendi klonunda yapmalıdır. URL'yi doğrudan yazarak yapılan push işlemleri bu uzak repo ayarlarıyla engellenmez; hedef her zaman fork olmalıdır.

## Dallar ve PR'lar

`main`, başlangıçta upstream ile aynı tutulur. `codex/forum-mvp`, forumun ortak entegrasyon dalıdır. Her geliştirici bu daldan ayrı bir `codex/forum-...` dalı açar, değişikliklerini kendi dalına gönderir ve diğer ekip üyesinden inceleme ister.

PR açarken hedefi özellikle kontrol edin:

- Base repository: **umrtkyrk/iceberg-x-os**
- Base branch: **codex/forum-mvp**

GitHub, fork'tan PR açarken varsayılan olarak upstream'i önerebilir. Bu görevde hedef fork olarak seçilir. Hazır olduğunda fork'un `main` dalına geçiş ayrıca değerlendirilir; üretim portalına katkı gönderilmez.

## Forum kapsamı

Konu/yanıt, kategoriler, Markdown, soft-delete, üç kazanılmış rozetten sıralı vitrin, imza, takip/@mention/yanıt bildirimleri, rapor ve moderasyon. Önceki tasarım gereksinimleri olan quest etiketi ve iş dışı sohbet alanı korunur. Feature flag, additive migration, rol ve sahiplik kontrolleri, hata sanitizasyonu ve backend testleri gereklidir. Beğeni/reaksiyon, görsel yükleme, e-posta özeti ve Radar/MVCubes puanlaması MVP dışındadır.

Mevcut `mock-forum` ayrı bir tasarım referansıdır. Henüz portal uygulamasına taşınmış değildir. Feature flag ve forum API'si de henüz uygulanmamıştır.

## Kontroller

Frontend değişikliklerinde `cd frontend && npm run build`; backend değişikliklerinde ilgili testler ve derleme çalıştırılır. `.env`, token, parola, yerel veritabanı ve yüklenen dosyalar commit edilmez. Lokal incelemede üretim veritabanı kullanılmaz.

Temiz veritabanı kurulumunda upstream'in mevcut migration sırası `Quest` tablosunu oluşturmadan değiştirdiği için hata verebilir. Bu ayrı bir başlangıç sorunudur; orijinal repodaki migration dosyaları bu görev kapsamında değiştirilmez.
