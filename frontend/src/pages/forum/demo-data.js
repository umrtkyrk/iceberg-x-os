// Fictional design fixtures; unrelated to portal accounts or earned badges.
export const currentUserId = 'mesut';

export const categories = [
  { id: 'announcements', name: 'Duyurular', description: 'Iceberg X’te neler oluyor?', color: '#d10a72', icon: 'Megaphone' },
  { id: 'help', name: 'Sor & çöz', description: 'Birlikte düşünelim, birlikte çözelim.', color: '#2773b7', icon: 'LifeBuoy' },
  { id: 'showcase', name: 'Ürettiklerimiz', description: 'Küçük denemeler, büyük fikirler.', color: '#8952ba', icon: 'Layers' },
  { id: 'ideas', name: 'Fikir atölyesi', description: 'Aklındaki fikri masaya bırak.', color: '#aa7716', icon: 'Lightbulb' },
  { id: 'lounge', name: 'Küpün dışı', description: 'Kahve, oyun ve iş dışındaki her şey.', color: '#c23583', icon: 'Coffee' },
];

export const badges = [
  { id: 'builder', name: 'Üreten', icon: 'Code2', color: '#8952ba', description: 'Fikrini çalışan bir projeye dönüştürdü.' },
  { id: 'helper', name: 'Yardımsever', icon: 'HeartHandshake', color: '#008861', description: 'Bir başka Cube’un önünü açtı.' },
  { id: 'explorer', name: 'Keşifçi', icon: 'Compass', color: '#2773b7', description: 'Yeni araçları ve yöntemleri keşfediyor.' },
  { id: 'first-step', name: 'İlk adım', icon: 'Rocket', color: '#bd6b20', description: 'Toplulukta ilk katkısını paylaştı.' },
  { id: 'spark', name: 'Fikir kıvılcımı', icon: 'Sparkles', color: '#ca3194', description: 'Yeni bir sohbetin kıvılcımını yaktı.' },
  { id: 'consistent', name: 'İstikrarlı', icon: 'Zap', color: '#aa7716', description: 'Öğrenmeye ve paylaşmaya devam ediyor.' },
  { id: 'mentor', name: 'Yol gösteren', icon: 'Trophy', color: '#5665c6', description: 'Deneyimini toplulukla paylaşıyor.' },
];

export const quests = [
  { id: 'first-contribution', title: 'İlk katkını paylaş', category: 'Topluluk', progress: 2, total: 3, color: '#9560c8' },
  { id: 'build-together', title: 'Birlikte bir şey üret', category: 'Üretim', progress: 1, total: 4, color: '#ed0c86' },
  { id: 'help-a-cube', title: 'Bir Cube’a el uzat', category: 'Dayanışma', progress: 3, total: 5, color: '#2773b7' },
];

export const members = [
  { id: 'mesut', name: 'Mesut Umur Tokyürek', username: 'umrtkyrk', role: 'Cube', avatar: null, initials: 'MU', color: '#b35d91', badgeIds: ['builder', 'explorer', 'first-step'], signature: 'Bir fikri somutlaştırmanın en iyi yolu, ilk küpü koymak.' },
  { id: 'selin', name: 'Selin Yılmaz', username: 'seliny', role: 'Iceberger', avatar: null, initials: 'SY', color: '#bd9254', badgeIds: ['mentor', 'helper', 'consistent'], signature: 'Birlikte öğrenmek, birlikte büyümek.' },
  { id: 'emre', name: 'Emre Aydın', username: 'emreaydin', role: 'Senior Cube', avatar: null, initials: 'EA', color: '#9560c8', badgeIds: ['builder', 'helper', 'explorer'], signature: 'Küçük adımlar, çalışan yazılımlar.' },
  { id: 'deniz', name: 'Deniz Kaya', username: 'denizk', role: 'Senior Cube Candidate', avatar: null, initials: 'DK', color: '#5e79b8', badgeIds: ['builder', 'spark'], signature: 'Tasarım, kod ve aradaki güzel sorular.' },
  { id: 'zeynep', name: 'Zeynep Demir', username: 'zeynepd', role: 'Cube', avatar: null, initials: 'ZD', color: '#d2619c', badgeIds: ['first-step', 'explorer'], signature: 'Merak ettiğim şeylerin peşindeyim.' },
  { id: 'mert', name: 'Mert Arslan', username: 'mertars', role: 'Senior Cube', avatar: null, initials: 'MA', color: '#a8884b', badgeIds: ['helper', 'consistent', 'mentor'], signature: 'Önce bir kahve, sonra çözüm.' },
  { id: 'ece', name: 'Ece Şahin', username: 'ecesahin', role: 'Senior Cube Candidate', avatar: null, initials: 'EŞ', color: '#9c72bc', badgeIds: ['spark', 'builder', 'helper'], signature: 'Güzel fikirler paylaştıkça çoğalır.' },
  { id: 'can', name: 'Can Öztürk', username: 'canozturk', role: 'Cube', avatar: null, initials: 'CÖ', color: '#bf8d61', badgeIds: ['first-step'], signature: 'Bugün yeni ne öğreniyoruz?' },
];

export const initialTopics = [
  {
    id: 'welcome', title: 'Aynı küpün etrafında: Iceberg X Forum’a hoş geldiniz 👋',
    body: 'Burası sorularımızın, ürettiklerimizin ve “bunu bir de size sorayım” dediğimiz her şeyin ortak alanı.\n\nBir konuda takıldığında Sor & çöz’e uğra, yeni bir şey çıkardığında Ürettiklerimiz’de paylaş. İşten biraz uzaklaşmak istersen Küpün dışı seni bekliyor. Konularına ilgili quest’i bağlamayı ve profilinde seni anlatan üç rozeti seçmeyi unutma.\n\nİlk yorumunda kendinden ve şu sıralar merak ettiğin bir şeyden bahset. Tanışalım!',
    categoryId: 'announcements', authorId: 'selin', questId: 'first-contribution', pinned: true, unread: false,
    createdAt: '2026-10-15T08:00:00Z', views: 428, tags: ['hoş geldin', 'topluluk'],
    replies: [
      { id: 'welcome-r1', authorId: 'mesut', body: 'Selam herkese! Mesut ben. Şu aralar topluluk deneyimleri ve frontend ile ilgileniyorum. Burada birlikte bir şeyler üretmek için heyecanlıyım.', createdAt: '2026-10-15T09:10:00Z' },
      { id: 'welcome-r2', authorId: 'zeynep', body: 'Merhaba! Ben Zeynep. İlk quest’imdeyim, biraz tasarım biraz da React öğreniyorum. Sorularla geleceğim :)', createdAt: '2026-10-15T10:24:00Z' },
      { id: 'welcome-r3', authorId: 'emre', body: 'Hoş geldiniz! Takıldığınız yerde mutlaka konu açın. Aynı soruya takılan başka birileri de vardır.', createdAt: '2026-10-15T11:03:00Z' },
      { id: 'welcome-r4', authorId: 'can', body: 'Can ben, topluluğa yeni katıldım. Hem ürün geliştirmek hem de ekiptekileri daha yakından tanımak istiyorum.', createdAt: '2026-10-16T08:42:00Z' },
    ],
  },
  {
    id: 'api-auth', title: 'API isteği 401 dönüyor; token yenilemeyi nerede yönetmeliyim?',
    body: 'React projemde access token süresi bitince aynı anda birkaç istek 401 dönüyor. Refresh işlemini bir interceptor içinde yönetiyorum ama istekler birbirini tetikliyor.\n\nTek bir refresh isteği açıp diğerlerini bekletmek için kullandığınız bir yaklaşım var mı? Özellikle eşzamanlı istek tarafındaki deneyimlerinizi merak ediyorum.',
    categoryId: 'help', authorId: 'zeynep', questId: 'help-a-cube', pinned: false, unread: true,
    createdAt: '2026-10-17T05:38:00Z', views: 86, tags: ['API', 'React', 'yardım'],
    replies: [
      { id: 'api-auth-r1', authorId: 'emre', body: 'Refresh için ortak bir promise tutabilirsin. İlk 401 yenilemeyi başlatır, sonraki istekler aynı promise’i bekler. Her isteğe tekrar deneme işareti de ekle ki sonsuz döngüye girmesin.', createdAt: '2026-10-17T05:51:00Z' },
      { id: 'api-auth-r2', authorId: 'mert', body: 'Bir de refresh başarısız olursa bekleyen tüm istekleri reddetmeyi unutma. Yoksa arayüzde bitmeyen yükleme durumları kalıyor. Küçük bir örnek repo paylaşırsan beraber bakabiliriz.', createdAt: '2026-10-17T06:03:00Z' },
      { id: 'api-auth-r3', authorId: 'zeynep', body: 'Ortak promise kısmı tam eksik parça sanırım. Önce bunu deneyeceğim, sonucu buraya eklerim. Teşekkürler!', createdAt: '2026-10-17T06:13:00Z' },
    ],
  },
  {
    id: 'design-system', title: 'İlk mini tasarım sistemimi yaptım. Bir göz atar mısınız?',
    body: 'Hafta sonu renkler, tipografi ve birkaç temel bileşenden oluşan küçük bir UI kit hazırladım. Buton, input ve kart bileşenlerini React tarafında da çalışır hale getirdim.\n\nÖzellikle koyu temadaki kontrastlar ve buton durumları hakkında yorumlarınızı duymak isterim. Bu haftaki hedefim erişilebilir klavye kullanımı eklemek.',
    categoryId: 'showcase', authorId: 'deniz', questId: 'build-together', pinned: false, unread: true,
    createdAt: '2026-10-17T04:52:00Z', views: 124, tags: ['tasarım', 'frontend', 'geri bildirim'],
    replies: [
      { id: 'design-system-r1', authorId: 'ece', body: 'Eline sağlık! Renklerin kullanım amacını da isimlere taşımak faydalı oluyor: primary, surface, text-muted gibi. Sonra tema eklemek çok daha kolay.', createdAt: '2026-10-17T05:02:00Z' },
      { id: 'design-system-r2', authorId: 'mesut', body: 'Bu kit ile küçük bir ekran çıkarmayı deneyebiliriz. Gerçek kullanımda hangi parçaların eksik olduğunu daha hızlı görürüz.', createdAt: '2026-10-17T05:20:00Z' },
      { id: 'design-system-r3', authorId: 'deniz', body: 'Harika fikir, quest’i de bunun için bağladım. Küçük bir profil ekranıyla başlayabiliriz.', createdAt: '2026-10-17T05:27:00Z' },
    ],
  },
  {
    id: 'focus-playlist', title: 'Kulaklıklar takıldı: bugün ne dinliyoruz? 🎧',
    body: 'Odaklanırken hep aynı üç listeye dönüyorum. Yeni müzik keşfetmek için ortak bir başlık açayım dedim.\n\nKod yazarken, tasarım yaparken ya da otobüste camdan bakarken iyi giden bir albüm bırakın. Benim bugünkü seçimim: Khruangbin — The Universe Smiles Upon You. Sözsüz çalışmayı sevenlere iyi geliyor.',
    categoryId: 'lounge', authorId: 'mert', questId: null, pinned: false, unread: false,
    createdAt: '2026-10-17T04:18:00Z', views: 192, tags: ['müzik', 'kahve molası'],
    replies: [
      { id: 'focus-playlist-r1', authorId: 'ece', body: 'Nils Frahm — Spaces. Özellikle uzun bir tasarım işi açtığımda çok iyi gidiyor.', createdAt: '2026-10-17T04:26:00Z' },
      { id: 'focus-playlist-r2', authorId: 'can', body: 'Ben bugün oyun müzikleri tarafındayım. Minecraft soundtrack’i şaşırtıcı derecede iyi odaklatıyor.', createdAt: '2026-10-17T04:35:00Z' },
      { id: 'focus-playlist-r3', authorId: 'selin', body: 'Ortak bir listeye dönüştürsek mi bunu? Herkes üç parça eklesin, haftanın Iceberg radyosu olsun.', createdAt: '2026-10-17T05:02:00Z' },
      { id: 'focus-playlist-r4', authorId: 'deniz', body: 'Tycho — Dive bırakıyorum. Kahve + sabah ışığı ile birlikte tavsiye edilir.', createdAt: '2026-10-17T05:48:00Z' },
    ],
  },
  {
    id: 'pair-sessions', title: 'Haftada bir saatlik eşli çalışma buluşmaları yapsak?',
    body: 'Herkesin üzerinde çalıştığı küçük bir proje var. Haftada bir saat eşleşip birbirimizin koduna veya tasarımına baksak nasıl olur?\n\nDeneyim seviyesi şartı olmadan, o günün sorusunu birlikte çözmeye odaklanabiliriz. Ben ilk oturumda bir React formunun durum yönetimini getirebilirim. Katılmak isteyenler hangi konuyla gelmek istediklerini yazsın.',
    categoryId: 'ideas', authorId: 'ece', questId: 'build-together', pinned: false, unread: true,
    createdAt: '2026-10-16T15:42:00Z', views: 153, tags: ['birlikte üret', 'eşli çalışma'],
    replies: [
      { id: 'pair-sessions-r1', authorId: 'emre', body: 'Ben varım. İlk 10 dakikada hedefi netleştirip kalan sürede tek bir probleme odaklanırsak verimli olur.', createdAt: '2026-10-16T16:03:00Z' },
      { id: 'pair-sessions-r2', authorId: 'zeynep', body: 'Ben de katılmak isterim! Yeni başlayanlar için de uygun olması çok iyi olur.', createdAt: '2026-10-16T16:20:00Z' },
    ],
  },
  {
    id: 'first-quest', title: 'İlk quest bitti! Öğrendiklerimi küçük bir notta topladım',
    body: 'İlk katkı quest’ini tamamlarken en çok başlamakta zorlandım. Sonra hedefi küçülttüm: tek bir ekran, tek bir kullanıcı akışı, bir çalışan örnek.\n\nÜç notum var: önce neyi çözdüğünü yaz, takıldığın noktayı mümkün olduğunca küçük bir örneğe indir ve paylaşmak için kusursuz olmasını bekleme. Yeni başlayan birinin işine yarar diye buraya bırakıyorum.',
    categoryId: 'showcase', authorId: 'can', questId: 'first-contribution', pinned: false, unread: false,
    createdAt: '2026-10-16T13:10:00Z', views: 98, tags: ['ilk katkı', 'öğrendiklerim'],
    replies: [
      { id: 'first-quest-r1', authorId: 'selin', body: 'Eline sağlık Can! Öğrendiğini paylaşmak da en az yaptığın iş kadar değerli. Bir sonraki adımda neyi denemek istiyorsun?', createdAt: '2026-10-16T13:28:00Z' },
      { id: 'first-quest-r2', authorId: 'can', body: 'Teşekkürler! Bir sonraki adımda form verilerini localStorage’da saklayıp sayfa yenilense de kaybetmemeyi deneyeceğim.', createdAt: '2026-10-16T13:41:00Z' },
    ],
  },
  {
    id: 'react-forms', title: 'Küçük projelerde form kütüphanesi kullanıyor musunuz?',
    body: 'Dört alanlı bir kayıt formunda useState ile başladım. Doğrulama, hata mesajları ve dokunulmuş alanlar derken kod hızla büyüdü.\n\nReact Hook Form’a geçmeye değer mi, yoksa küçük formlar için kendi hook’unuzu mu yazıyorsunuz? Karar verirken hangi noktaya bakıyorsunuz?',
    categoryId: 'help', authorId: 'mesut', questId: 'help-a-cube', pinned: false, unread: false,
    createdAt: '2026-10-16T11:26:00Z', views: 207, tags: ['React', 'frontend', 'form'],
    replies: [
      { id: 'react-forms-r1', authorId: 'deniz', body: 'Ben alan sayısından çok davranışa bakıyorum. Koşullu alanlar ve asenkron doğrulama varsa küçük formda bile kütüphane işimi kolaylaştırıyor.', createdAt: '2026-10-16T11:46:00Z' },
      { id: 'react-forms-r2', authorId: 'emre', body: 'Dört basit alan için yerleşik HTML doğrulamasını da değerlendirebilirsin. Projede zaten bir form kütüphanesi varsa onunla devam etmek tutarlılık sağlar.', createdAt: '2026-10-16T12:05:00Z' },
      { id: 'react-forms-r3', authorId: 'ece', body: 'Hata mesajlarını alanla ilişkilendirmek ve ilk hataya odaklanmak gibi erişilebilirlik detaylarını da hesaba katmak güzel olur.', createdAt: '2026-10-16T12:22:00Z' },
    ],
  },
  {
    id: 'coffee-map', title: 'İstanbul’da laptop açmalık sakin mekân önerileri',
    body: 'Bir gün evden çıkıp çalışmak istiyorum ama masası minicik ya da müziği çok yüksek yerlerden yoruldum.\n\nPrizi bulunan, kahvesi güzel ve uzun oturunca huzursuz hissettirmeyen mekân önerilerinizi alırım. Semti ve yoğun olduğu saatleri de eklerseniz harika olur. Ben Kadıköy civarındayım ama iyi kahve için yolu uzatabilirim.',
    categoryId: 'lounge', authorId: 'zeynep', questId: null, pinned: false, unread: false,
    createdAt: '2026-10-16T09:08:00Z', views: 176, tags: ['İstanbul', 'mekân önerisi', 'kahve'],
    replies: [
      { id: 'coffee-map-r1', authorId: 'mert', body: 'Moda’da hafta içi sabah saatlerini öneririm. Mekândan bağımsız olarak 10.00’dan önce gitmek priz bulma ihtimalini çok artırıyor :)', createdAt: '2026-10-16T09:32:00Z' },
      { id: 'coffee-map-r2', authorId: 'selin', body: 'Bir gün küçük bir birlikte çalışma buluşması da yapabiliriz. Sessiz çalışma + öğlen kahve molası güzel olur.', createdAt: '2026-10-16T10:04:00Z' },
    ],
  },
  {
    id: 'knowledge-notes', title: 'İyi forum cevaplarını ortak bilgi notlarına dönüştürelim mi?',
    body: 'Bazı konularda çok iyi çözümler birikiyor ve birkaç hafta sonra aynı soruyu tekrar soruyoruz. Çözüme ulaşmış başlıkların altına kısa bir “ne işe yaradı?” özeti ekleyebiliriz.\n\nBu notlar ileride yeni katılanlar için küçük bir başlangıç rehberine dönüşebilir. İlk denemeyi API kimlik doğrulama başlığıyla yapmak istiyorum. Format için fikirleriniz var mı?',
    categoryId: 'ideas', authorId: 'emre', questId: 'help-a-cube', pinned: false, unread: false,
    createdAt: '2026-10-15T14:17:00Z', views: 143, tags: ['bilgi paylaşımı', 'topluluk'],
    replies: [
      { id: 'knowledge-notes-r1', authorId: 'ece', body: 'Sorun / denenenler / çalışan çözüm şeklinde üç kısa bölüm yeterli olabilir. Uzun bir belgeye dönüşmesin, ilgili yanıta yönlendirsin.', createdAt: '2026-10-15T14:51:00Z' },
    ],
  },
  {
    id: 'demo-friday', title: 'Cuma demo buluşması: bitmiş olması gerekmiyor',
    body: 'Bu haftaki demo buluşmasında herkes üzerinde çalıştığı bir şeyi beş dakikada paylaşabilir. Çalışan bir özellik, ilk taslak veya henüz çözemediğin bir problem de olabilir.\n\nKatılmak isteyenler bu başlığa proje adını ve hangi konuda geri bildirim istediğini yazsın. Birlikte bakıp gelecek hafta için küçük bir sonraki adım belirleyelim.',
    categoryId: 'announcements', authorId: 'selin', questId: 'build-together', pinned: false, unread: false,
    createdAt: '2026-10-15T10:06:00Z', views: 261, tags: ['demo', 'topluluk buluşması'],
    replies: [
      { id: 'demo-friday-r1', authorId: 'deniz', body: 'UI kit ile katılıyorum. Koyu tema kontrastları için geri bildirim toplamak istiyorum.', createdAt: '2026-10-15T10:35:00Z' },
      { id: 'demo-friday-r2', authorId: 'mesut', body: 'Ben de küçük forum denememi göstermek isterim. İlk ziyaretçinin nereden başlayacağını anlayıp anlamadığına bakabiliriz.', createdAt: '2026-10-15T11:12:00Z' },
    ],
  },
  {
    id: 'weekend-games', title: 'Hafta sonu bir oyun akşamı? Masa oyunu da olur 🎲',
    body: 'Haftayı biraz kapatalım. Cumartesi akşamı kısa bir oyun buluşması yapmak isteyen var mı? Herkesin kolayca katılabileceği bir şey seçelim.\n\nGartic Phone, Codenames veya sizin öneriniz olabilir. Rekabet seviyemiz “kaybedince bir tur daha” civarında olsun yeter.',
    categoryId: 'lounge', authorId: 'can', questId: null, pinned: false, unread: true,
    createdAt: '2026-10-15T08:42:00Z', views: 119, tags: ['oyun', 'hafta sonu', 'geyik'],
    replies: [
      { id: 'weekend-games-r1', authorId: 'mert', body: 'Codenames için her zaman varım. Ama bir kelimeyi beş dakika açıklarsam kimse şaşırmasın.', createdAt: '2026-10-15T09:02:00Z' },
      { id: 'weekend-games-r2', authorId: 'ece', body: 'Gartic Phone diyorum. Çizim yeteneğimizden bağımsız olarak güzel anılar çıkar :)', createdAt: '2026-10-15T09:28:00Z' },
      { id: 'weekend-games-r3', authorId: 'zeynep', body: 'Ben de varım! Cumartesi 20.00 sonrası benim için uygun.', createdAt: '2026-10-15T10:01:00Z' },
    ],
  },
];

export const initialNotifications = [
  { id: 'notification-1', title: 'Emre soruna yanıt verdi', body: '“Küçük projelerde form kütüphanesi…” konusuna yeni bir yanıt geldi.', topicId: 'react-forms', read: false },
  { id: 'notification-2', title: 'Deniz seninle üretmek istiyor', body: 'Mini tasarım sistemi konusunda sohbet devam ediyor.', topicId: 'design-system', read: false },
  { id: 'notification-3', title: 'Topluluğa hoş geldin!', body: 'İlk mesajını bırak, diğer Cube’larla tanış.', topicId: 'welcome', read: true },
];
