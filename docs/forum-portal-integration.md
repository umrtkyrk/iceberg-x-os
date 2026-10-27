# Forum UI V2 — portal entegrasyonu

Bu sürüm forum tasarımını mevcut Iceberg X kimliği, başarımları ve topluluk bağlamıyla birleştirir.
Forum konuşmaları henüz ortak bir sunucuya kaydedilmez; portal bilgileri mevcut servislerden okunur.

## İncelenen kaynak ve çalışma sınırı

- Asıl kaynak: `yemrealtanay/iceberg-x-os`, `main`, salt okunur `c97a367` görüntüsü.
- Kaynak commit tarihi: 24 Ekim 2026; inceleme tarihi: 27 Ekim 2026.
- Üç inceleme: kademe/başarım, takdir/gizlilik ve diğer portal özelliklerinin envanteri.
- Çalışma hedefi: `umrtkyrk/iceberg-x-os` fork'u ve İngilizce `ui-v2` dalı.
- Kaynak repoya dosya, push, PR veya deployment gönderilmez.
- İnceleme ve otomatik kontroller üretim verisine yazma isteği göndermez.
- Portalın hesap sistemi, izinleri, kademe yönetimi ve bildirim çanı korunur.

## Durum anahtarı

| İşaret | Anlamı |
| --- | --- |
| **Okuma** | Gerçek portal verisi forumun izin verilen modeline aktarılır. |
| **Bağlantı** | Mevcut portal sayfasına gidilir; ikinci bir yönetim ekranı kurulmaz. |
| **Özel / dışarıda** | Forum kartlarına, konuşmalara veya tarayıcı depolamasına taşınmaz. |
| **Yerel** | Yalnızca bu tarayıcıdaki tasarım önizlemesinde çalışır. |

## Özelliklerin foruma eşlenmesi

| Portal özelliği | Durum | Forumdaki karşılığı ve sınırı |
| --- | --- | --- |
| Ad, avatar, kalıcı Cube numarası | Okuma | Konu yazarı, mesaj yazarı, kendi kartın ve profil penceresi. |
| Cube / Candidate / Senior / Iceberger | Okuma | Avatar çerçevesi, kademe etiketi ve mesaj kenar vurgusu. |
| ADMIN / MENTOR / CUBE rolü | Okuma | İzin rolü kademeden ayrı tutulur; forum kademe değiştiremez. |
| Founding Cube | Okuma | Bağımsız kurucu işareti; kademe rengini veya yetkiyi değiştirmez. |
| Alumni / Former Cube | Okuma | Gelen gerçek seviyeye göre etiketlenir; aktif ilerleme basamağı sayılmaz. |
| Kazanılmış rozetler | Okuma | Profilde gerçek başarımlar ve nadirlikleri listelenir. |
| Common / Rare / Epic / Legendary | Okuma | Portalın `BadgeDisc` ve `RarityPill` görselliği yeniden kullanılır. |
| En fazla üç vitrin rozeti | Yerel + okuma | Yalnızca kazanılanlar seçilir; seçim sırası korunur ve tarayıcıda saklanır. |
| Pozitif peer unvanları | Okuma | Sunucunun ürettiği unvan ve nadirlik gösterilir; eşik hesaplanmaz. |
| Alıcının paylaşmayı seçtiği anonim teşekkürler | Okuma | En fazla üç sabitlenmiş pozitif not; gönderen kimliği gösterilmez. |
| MVCubes | Okuma + bağlantı | İzin verilen kategori ve ay ödülleri; genel puan veya sıralama üretilmez. |
| Cube'un atanmış questleri | Okuma | Gerçek kişisel ilerleme ve tamamlanma; konuya quest etiketi bağlanabilir. |
| Staff quest kataloğu | Okuma | Tanımlar gösterilir; başkalarının ilerlemesi staff'ın kişisel ilerlemesi sayılmaz. |
| Mission katkıları | Okuma + bağlantı | Kendi görünür mission seçenekleri ve katkı sayısı; `/missions/:id` bağlantısı. |
| Mission durumları / teslim / ekip yönetimi | Bağlantı | İşlemler mevcut yetkili portal ekranında kalır. |
| Fundamentals ve quiz | Bağlantı | `/fundamentals` üzerinden mevcut öğrenme ve quiz akışına erişilir. |
| Quiz denemeleri ve ayrıntılı sonuçları | Dışarıda | Yeni bir quiz skoru, deneme geçmişi veya forum itibar puanı eklenmez. |
| Cube Vault | Bağlantı | `/vault`; forum arşivdeki üretimin etrafındaki konuşma alanıdır. |
| Directory / Hall of Fame | Okuma + bağlantı | Hafif kişi listesi Hall'dan gelir; `/hall-of-fame` yolculuk bağlantısı korunur. |
| Cohort, üniversite, skills | Okuma | Görünür profil alanları kullanılır; beceriler profil penceresinde gösterilir. |
| Bildirimler | Bağlantı | Portalın mevcut çanı ve `/notification-history`; örnek bir ikinci çan eklenmez. |
| Mentor kimliği | Okuma | Gerçek rol ve varsa Cube kimliği gösterilir; mentor değerlendirmesi alınmaz. |
| Team yönetimi | Özel / dışarıda | `/teams` staff ekranıdır; normal Cube'a yönetim bağlantısı sunulmaz. |
| Günlük güncellemeler / blocker kayıtları | Dışarıda | Forum yanıtı resmi ilerleme güncellemesi veya quest hareketi sayılmaz. |
| Demo Day ve kişisel/ekip reflections | Özel / dışarıda | Kısıtlı gönderimler, öğrenimler ve iyileştirme notları genel akışa alınmaz. |
| Kişisel feedback gelen/giden kutuları | Özel / dışarıda | Sabitlenmemiş notlar ve kişisel geçmiş forum profiline alınmaz. |
| Radar, concern ve büyüme sinyalleri | Özel / dışarıda | Olumsuz gözlemler, iç notlar ve risk/gelişim bilgileri gösterilmez. |
| Mentor scorecard, puanlar, özel notlar | Özel / dışarıda | Forum itibarı veya candidacy çıkarımı için kullanılmaz. |
| Attendance, toplantı davetleri/notları | Özel / dışarıda | Devam oranı ve toplantı katılımı yazar kartına eklenmez. |
| NDA, belge, sözleşme, kişisel dosyalar | Özel / dışarıda | Durum, metadata, dosya URL'si ve inceleme notları taşınmaz. |
| Offboarding ve sertifika yönetimi | Dışarıda | Ham kayıt kullanılmaz; bu sürümde sertifika kartı eklenmez. |
| Recruitment / başvuru / case değerlendirmesi | Özel / dışarıda | Başvuru, yanıt, rubric, skor ve kararlar topluluğa taşınmaz. |
| Hesap, parola ve kullanıcı yönetimi | Bağlantı / dışarıda | Portal oturumu kullanılır; ikinci üyelik veya yetki yönetimi kurulmaz. |

## Gerçek okuma sözleşmeleri

Tüm endpointler mevcut `api` istemcisiyle `/api` altında çağrılır.

| Kaynak | Kullanılan bölüm |
| --- | --- |
| Mevcut AuthContext | Gerçek kullanıcı ID'si, rol, ad, avatar ve varsa Cube profil ID'si. |
| `GET /cubes/public/:identifier` | Açıkça seçilen profil, kazanılmış rozetler, iki katkı sayacı ve görünür missionlar. |
| `GET /hall-of-fame` | Profil ID'siyle kademe eşlemesi, candidacy, hafif kişiler ve aşama sayıları. |
| `GET /quests` | Rolüne göre kişisel atamalar veya staff için quest tanımları. |
| `GET /cubes/:id/peer-summary` | Yalnızca pozitif unvanlar, public pinned notlar ve tanınan aylık ödüller. |

- Public profile cevabında `is_senior_candidate` yoktur; adaylık Hall üyeliğinden tamamlanır.
- `viewer.id` Auth kullanıcısının ID'sidir; `cubeId` CubeProfile ID'sidir. Birbirine karıştırılmaz.
- Kademe renkleri izin vermez; tüm gerçek işlemlerin son kontrolü mevcut backend'dedir.
- Hall kişi listesi tüm staff, Former ve Alumni kullanıcılarının eksiksiz directory'si değildir.
- `GET /cubes` ham directory cevabı forumun veri kaynağı yapılmaz; NDA ve iletişim alanları taşır.
- `GET /cubes/:id` rol duyarlı ayrıntılar içerir; genel yazar kartının kaynağı yapılmaz.
- Eksik veya bozuk alanlar normalize edilir; kısmi servis hataları genel bir bildirimle karşılanır.
- Profil detayları istek üzerine yüklenir; hata durumunda sıfır başarımlar gerçekmiş gibi gösterilmez.

## Kademe ve görsel kararlar

| Kademe | Forum rengi | Kullanımı |
| --- | --- | --- |
| Cube | Mavi `#2563eb` | Çerçeve, etiket, konu kenarı ve yazar alanı. |
| Senior Cube candidate | Cyan `#0e7490` | Açık adaylık etiketiyle birlikte aynı vurgu alanları. |
| Senior Cube | Violet `#7c3aed` | Aynı vurgu alanları; ayrı bir yetki tanımlamaz. |
| Iceberger | Altın `#a16207` | Sarı/altın zemin ve okunabilir koyu altın vurgular. |

Bu eşleme forum için kullanıcı talebidir; portalın genel Hall paleti değiştirilmez.
Mesaj gövdesi nötr ve okunabilir kalır; renk tek başına kademe bilgisi taşımaz.
Portal magentası `#e6007e`, sade açık zemin ve küçük koyu karşılama alanı kullanılır.
Masaüstünde gezinme, konuşmalar ve portal bağlamı üç sütunda yer alır.
Dar ekranda profil/takdir/quest kartları akışın altına geçer; özellikler kaldırılmaz.
Mobil gezinme kapalıyken görünmez ve odaklanılamaz; dialoglarda Escape ve odak sınırı vardır.

## Takdir ve gizlilik

- Pozitif unvan, MVCubes ödülü ve public pinned not ayrı tanınma türleridir.
- Üç vitrin rozeti ile üç public teşekkür sınırı birbirinden bağımsızdır.
- Public API cevabı bütünüyle güvenli forum modeli sayılmaz; alanlar tek tek seçilir.
- `offboarding_record`, award reason/awarder, mentor notu, `self` özeti ve quiz ayrıntısı atılır.
- Anonim notlarda gönderen, hash, kesin zaman, bağlam ve bireysel değerlendirme aktarılmaz.
- Açıkça boş dönen pinned koleksiyon önceki notları temizler; geri çekilen paylaşım korunmaz.
- Mevcut `GiveFeedbackButton` ve `PeerFeedbackComposer` yeniden kullanılır.
- Aksiyon gerçek, uygun Cube/Senior ve aday profilleriyle sınırlandırılır; örnek kişilere gönderilmez.
- Kendi kendine gönderim ve rol/seviye kuralları mevcut portal kontrollerine tabidir.
- **Takdir gönderimi gerçek portal işlemidir ve feedback hakkını kullanır.** Forumun yerel mesajlarıyla karıştırılmaz.
- İnceleme ve görsel QA sırasında gerçek takdir gönderimi yapılmaz.

## Forumda bugün çalışanlar ve kalan iş

- **Yerel:** konu/yanıt ekleme, kendi mesajını düzenleme/kaldırma, arama ve filtreleme.
- **Yerel:** kaydetme, takip, okunmamış durumu, sayfalama, vitrin seçimi ve imza.
- **Yerel:** raporlama akışı; moderatöre kayıt veya bildirim göndermez.
- Konular, yanıtlar ve tercihler kullanıcıya ait tarayıcı anahtarında saklanır; cihazlar arasında paylaşılmaz.
- Profil/başarım/quest verileri portal okumalarıdır; ham API cevapları localStorage'a yazılmaz.
- Örnek konuşmalar örnek kimlikler kullanır; gerçek Directory kişileri yazmış gibi sunulmaz.
- Gerçek quest/mission etiketi bağlamak ilerleme, ödül, formal update veya bildirim üretmez.
- Takip ve `@mention` henüz sunucu bildirimi göndermez; konu URL'si diğer cihazda veri oluşturmaz.
- **Bekleyen backend:** ortak topics/posts API'si, sunucu sahiplik/izin kontrolü ve kalıcı kayıt.
- **Bekleyen backend:** moderasyon, rapor kuyruğu, takip/mention bildirimleri ve hedef topic metadata'sı.
- **Bekleyen backend:** cihazlar arası vitrin/imza/tercih kaydı ve gerçek zamanlı güncellemeler.

## Kod ve doğrulama

- `frontend/src/pages/forum/Forum.tsx`: tipli ekranlar, mesajlar, profil, vitrin ve composer akışları.
- `types.ts` / `forumModel.ts`: açık modeller, kademe paleti, izin ve yerel veri doğrulaması.
- `portalContext.ts`: public alan seçimi, rol duyarlı quest normalizasyonu ve hata sınırları.
- `legacyState.ts`: eski önizleme verisinin kontrollü aktarımı; `fixtures.ts`: ayrı örnek kişiler.
- `forum.css`: `.cube-forum-v2` altında sınırlı, portalın diğer ekranlarına taşmayan stiller.
- Mevcut `MarkdownEditor`, `BadgeDisc`, `RarityPill`, avatar asset çözümü ve peer composer korunur.
- Testler normalize edilen veride özel alanların dışarıda kalmasını, candidacy ve rol ayrımını sınar.
- Rozet sahipliği/üç sınırı, staff quest ayrımı, bozuk yerel veri ve kaynak sözleşmeleri doğrulanır.
- Build/typecheck ve tarayıcı kontrollerinin güncel sonucu PR açıklamasında ayrıca belirtilir.
- İnceleme referansları: `backend/prisma/schema.prisma`, `cubes.routes.ts`, `quests.routes.ts`,
  `peerFeedback.routes.ts`, `hallOfFame.service.ts`, `peer.service.ts` ve ilgili frontend sayfaları.

Geliştirme ve ekip incelemesi fork'un `ui-v2` dalında sürdürülür; merge hedefi fork olmalıdır.
