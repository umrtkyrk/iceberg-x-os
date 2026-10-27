# Cube Forum ekip çalışma düzeni

Çalışma deposu **umrtkyrk/iceberg-x-os** fork'udur. `yemrealtanay/iceberg-x-os` yalnızca okunur referanstır; bu çalışma kapsamında orijinale push, PR, merge, deploy veya `scripts/sync-remotes.sh --apply` yapılmaz. Bu sınır üst projedeki repo eşitleme yönergelerinden önceliklidir.

## Sürüm dalları

Her yeni arayüz teslimi İngilizce bir sürüm dalında tutulur: `ui-v1`, `ui-v2`, `ui-v3`. Dalın içinde projenin bütün kodu ve geçmişi bulunur. Sonraki geliştirici kararlaştırılmış son sürümün üzerinden yeni dal açar. Dal isimlerinde `codex` kullanılmaz.

Bu çalışmanın başlangıcı `forum-mvp` dalındaki birleştirilmiş forum önizlemesidir; yeni sürüm **ui-v2** dalıdır. Takım arkadaşı bunun üzerinden devam edecekse:

```bash
git fetch origin
git switch -c ui-v3 origin/ui-v2
# Değişiklikler, kontrol ve commit
git push -u origin ui-v3
```

Aynı sürüm dalında eşzamanlı bağımsız geliştirme yapılacaksa önce ekipçe kimin hangi dosyaya dokunacağı konuşulmalıdır. Teslim edilmiş eski sürüm dallarının geçmişi yeniden yazılmaz ve force-push yapılmaz. Yeni dal açmadan önce çalışma alanının temiz olduğu kontrol edilir; kaydedilmemiş işler silinmez.

## Uzak hedefler

```bash
git remote -v
git remote set-url --push upstream https://example.invalid/upstream-push-disabled
git config remote.pushDefault origin
git config push.default current
```

`origin` her zaman fork olmalıdır. `upstream` orijinalden yalnızca okuma içindir. Bu yerel ayarları her ekip üyesi kendi klonunda yapar. URL yazarak push yapmak bu engeli aşabileceğinden hedef kontrol edilir.

Sürüm dalını paylaşmak için PR veya merge zorunlu değildir. Ekip inceleme için PR açarsa **base repository `umrtkyrk/iceberg-x-os`** olmalıdır; base dalını ekip birlikte belirler. GitHub fork'tan PR açarken orijinal repoyu önerebilir.

## Kontroller

```bash
cd frontend
npm run test:forum
npm run check:forum
npm run build
```

Yerel parolalar, `.env`, tokenlar, veri tabanı ve yüklenen dosyalar commit edilmez. Üretim veritabanı yerel incelemede kullanılmaz. Forum UI V2'nin gerçek portal okuma / yerel önizleme sınırları `forum-design-preview.md` içinde açıklanır.
