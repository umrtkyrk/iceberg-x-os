import type {
  ForumBadge,
  ForumMember,
  ForumTopic,
  Rarity,
  StageKey,
} from "./types";
import { initials } from "./forumModel";

const ago = (hours: number): string =>
  new Date(Date.now() - hours * 3600000).toISOString();
const badge = (
  id: string,
  name: string,
  icon: string,
  rarity: Rarity,
): ForumBadge => ({
  id: `sample-${id}`,
  name,
  icon,
  rarity,
  description: "Tasarım önizlemesi için kurgusal bir başarım.",
  earnedAt: ago(72),
});
const BUILDER = badge("builder", "Builder", "hammer", "Common");
const DEEP_DIVER = badge("deep-diver", "Deep Diver", "telescope", "Rare");
const TEAM_GLUE = badge("team-glue", "Team Glue", "heart-handshake", "Epic");
const ICEBERGER = badge(
  "iceberger",
  "Be an Iceberger",
  "snowflake",
  "Legendary",
);
function member(
  id: string,
  name: string,
  stage: StageKey,
  badges: ForumBadge[],
  skills: string[],
): ForumMember {
  return {
    id: `sample-${id}`,
    cubeId: `sample-profile-${id}`,
    cubeNumber: "DEMO",
    name,
    initials: initials(name),
    stage,
    portalRole:
      stage === "mentor" ? "MENTOR" : stage === "admin" ? "ADMIN" : "CUBE",
    avatarUrl: null,
    cohort: "Örnek topluluk",
    university: "Tasarım profili",
    skills,
    founding: false,
    sample: true,
    badges,
    titles:
      stage === "senior"
        ? [{ category: "UNBLOCKER", label: "Unblocker", rarity: "Rare" }]
        : [],
    quotes:
      stage === "senior"
        ? [
            {
              id: "sample-kudo-selected",
              note: "Sorunu parçalara ayırıp açıklaması sayesinde kendi çözümümü bulabildim. (Örnek anonim takdir)",
              tags: [
                { key: "CLEAR_COMMUNICATOR", label: "Clear Communicator" },
              ],
              period: "Örnek dönem",
            },
          ]
        : [],
    awards:
      stage === "iceberger"
        ? [{ category: "TEAM_GLUE", label: "Team Glue", period: "Örnek dönem" }]
        : [],
    stats: {
      questsCompleted: stage === "iceberger" ? 8 : 2,
      missionContributions: stage === "iceberger" ? 4 : 1,
    },
  };
}
// Entirely fictional personas. They are not directory records or actual forum posts.
export const SAMPLE_MEMBERS: ForumMember[] = [
  member(
    "selin",
    "Selin Yılmaz",
    "iceberger",
    [ICEBERGER, TEAM_GLUE, DEEP_DIVER],
    ["React", "Ürün geliştirme"],
  ),
  member("zeynep", "Zeynep Demir", "cube", [BUILDER], ["TypeScript", "API"]),
  member(
    "emre",
    "Emre Aydın",
    "senior",
    [DEEP_DIVER, TEAM_GLUE, BUILDER],
    ["Node.js", "Araştırma"],
  ),
  member(
    "deniz",
    "Deniz Kaya",
    "candidate",
    [BUILDER, DEEP_DIVER],
    ["Erişilebilirlik", "Tasarım sistemleri"],
  ),
  member(
    "derya",
    "Derya Aksoy",
    "mentor",
    [TEAM_GLUE],
    ["Mentorluk", "Mimari"],
  ),
  member("can", "Can Öztürk", "cube", [], ["Oyun", "Frontend"]),
];
const post = (id: string, authorId: string, body: string, hours: number) => ({
  id,
  authorId: `sample-${authorId}`,
  body,
  createdAt: ago(hours),
});
function topic(
  id: string,
  categoryId: string,
  authorId: string,
  title: string,
  body: string,
  hours: number,
  replies: ForumTopic["replies"],
  pinned = false,
): ForumTopic {
  return {
    id: `sample-topic-${id}`,
    categoryId,
    authorId: `sample-${authorId}`,
    title,
    body,
    createdAt: ago(hours),
    questId: null,
    missionId: null,
    pinned,
    unread: !pinned,
    views: 0,
    tags: ["Örnek sohbet"],
    replies,
  };
}
export const SAMPLE_TOPICS: ForumTopic[] = [
  topic(
    "welcome",
    "announcements",
    "derya",
    "Bir soruyla başlar, birlikte büyür.",
    "Cube Forum'a hoş geldiniz. Burada takıldığımız noktaları konuşuyor, öğrendiklerimizi kalıcı hale getiriyoruz.\n\n**Küçük bir soru da değerli.** Yardım isterken biraz bağlam ve denediklerini paylaş. Ürettiklerini göstermek veya bir kahve molası vermek için de yer var.\n\nBu başlık ve yanıtları tasarımı göstermek için hazırlanmış örneklerdir.",
    36,
    [
      post(
        "sample-welcome-1",
        "selin",
        "Denediğimiz ama işe yaramayan yolları da yazalım. Bazen bir sonraki Cube için en yararlı bilgi o oluyor.",
        30,
      ),
      post(
        "sample-welcome-2",
        "zeynep",
        "Birlikte öğrenmek için güzel bir alan. İlk sorumu Sor & çöz bölümüne bıraktım.",
        29,
      ),
    ],
    true,
  ),
  topic(
    "tokens",
    "help",
    "zeynep",
    "API aynı anda birkaç kez 401 dönüyor; refresh akışını nasıl yönetiyorsunuz?",
    "Token süresi dolunca birden fazla istek refresh işlemini tetikliyor.\n\n`Promise` paylaşarak tek yenileme yapmak mı daha doğru, yoksa istekleri bir kuyrukta mı bekletmeliyim? Küçük bir örnek veya deneyiminizi duymak isterim.",
    5,
    [
      post(
        "sample-token-1",
        "emre",
        "Tek bir refresh promise saklayıp diğer isteklerde onu bekletmek iyi bir başlangıç. Yenileme başarısız olduğunda bekleyen istekleri de sonlandırmayı unutma.",
        4,
      ),
      post(
        "sample-token-2",
        "selin",
        "Aynı isteği sadece bir kez yeniden deneyecek bir sınır da ekle. Böylece token yenilenemediğinde sonsuz döngü oluşmaz.",
        3,
      ),
      post(
        "sample-token-3",
        "zeynep",
        "İki öneriyi de küçük bir örnek üzerinde deneyeceğim; sonucu burada paylaşırım.",
        2,
      ),
    ],
  ),
  topic(
    "design-system",
    "showcase",
    "deniz",
    "İlk mini tasarım sistemim: klavye ile dolaşmayı da denedim",
    "Butonlar, form alanları ve durum kartlarından oluşan küçük bir kütüphane hazırladım.\n\nBu sefer yalnızca görüntüsüne değil, **odak sırasına ve hata mesajlarına** da baktım. Özellikle mobil form akışı için geri bildiriminizi duymak isterim.",
    8,
    [
      post(
        "sample-design-1",
        "selin",
        "Odak halkası belirgin olunca hem fare hem klavye akışı daha kolay izleniyor. Hata metnini alanla ilişkilendirmen de güzel bir sonraki adım olabilir.",
        7,
      ),
      post(
        "sample-design-2",
        "emre",
        "Düğmelerin yükleniyor ve devre dışı durumlarını da yan yana göstermek değerlendirmeyi kolaylaştırır.",
        6,
      ),
    ],
  ),
  topic(
    "pairing",
    "ideas",
    "emre",
    "Haftada bir saat eşli çalışma: kimin hangi konuda desteğe ihtiyacı var?",
    "Herkesin küçük ama takıldığı bir konusu vardır. Bir saatlik eşleşmelerle birbirimizin koduna veya fikrine bakabiliriz.\n\nKatılmak istersen konuşmak istediğin konuyu ve paylaşabileceğin bir deneyimini yaz. Bu bir yarışma değil; birlikte düşünme alanı.",
    15,
    [
      post(
        "sample-pair-1",
        "derya",
        "İlk buluşmada hedefi küçük tutalım: bir problem, bir örnek ve sonunda kısa bir not.",
        13,
      ),
    ],
  ),
  topic(
    "music",
    "lounge",
    "can",
    "Kod molası: bugün kulaklıklarda ne var?",
    "Aynı üç çalma listesine dönüp duruyorum. Yeni bir albüm veya sadece mola verirken iyi gelen bir şarkı bırakır mısınız?\n\nBen bugün sözsüz bir şeylerle başladım. Kahve de hazır. ☕",
    3,
    [
      post(
        "sample-music-1",
        "deniz",
        "Tasarım yaparken hafif caz iyi gidiyor; hata ayıklarken bazen sessizlik daha iyi.",
        2,
      ),
    ],
  ),
];
