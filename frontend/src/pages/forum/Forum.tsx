import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Award,
  Bell,
  Bookmark,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Coffee,
  Crown,
  Flag,
  Flame,
  HeartHandshake,
  Layers,
  LifeBuoy,
  Lightbulb,
  Lock,
  Menu,
  MessageCircle,
  MessagesSquare,
  Megaphone,
  Pin,
  Plus,
  Quote,
  RefreshCw,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
  Users,
  X,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useAuth } from "../../context/AuthContext";
import { MarkdownEditor } from "../../components/MarkdownEditor";
import { BadgeDisc, RarityPill } from "../../components/BadgeMedal";
import { GiveFeedbackButton } from "../../components/peer/GiveFeedbackButton";
import { getAssetUrl } from "../../utils/assets";
import { loadPortalContext, loadPublicMember } from "./portalContext";
import {
  CATEGORIES,
  STAGES,
  initials,
  safePreferences,
  readLocalState,
  canCompose,
} from "./forumModel";
import { SAMPLE_MEMBERS, SAMPLE_TOPICS } from "./fixtures";
import { migrateLegacyState } from "./legacyState";
import type {
  ForumBadge,
  ForumLocalState,
  ForumMember,
  ForumPost,
  ForumQuest,
  ForumSettings,
  ForumTopic,
  PortalContext,
  PortalRole,
  StageKey,
} from "./types";
import "./forum.css";

type View = "feed" | "categories" | "saved" | "following" | "quests" | "people";
type Sort = "latest" | "popular" | "unread";
type ThreadDraft = {
  reply: string;
  replyPage: number;
  editing: string | null;
  editText: string;
};
const icons = { Megaphone, LifeBuoy, Layers, Lightbulb, Coffee };
const date = (value: string) =>
  new Date(value).toLocaleString("tr-TR", {
    timeZone: "Europe/Istanbul",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
function relative(value: string) {
  const minutes = Math.max(
    0,
    Math.floor((Date.now() - new Date(value).getTime()) / 60000),
  );
  return minutes < 1
    ? "Şimdi"
    : minutes < 60
      ? `${minutes} dk`
      : minutes < 1440
        ? `${Math.floor(minutes / 60)} sa`
        : `${Math.floor(minutes / 1440)} gün`;
}
const stageStyle = (stage: StageKey): CSSProperties =>
  ({
    "--stage-color": STAGES[stage].color,
    "--stage-soft": STAGES[stage].soft,
  }) as CSSProperties;
const unknownMember: ForumMember = {
  id: "unknown",
  name: "Bilinmeyen Cube",
  initials: "?",
  stage: "cube",
  portalRole: "CUBE",
  avatarUrl: null,
  cohort: "",
  university: "",
  skills: [],
  founding: false,
  sample: false,
  badges: [],
  titles: [],
  quotes: [],
  awards: [],
  stats: { questsCompleted: 0, missionContributions: 0 },
};

export default function Forum() {
  const { user } = useAuth();
  const [context, setContext] = useState<PortalContext | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let current = true;
    setError(false);
    setContext(null);
    if (!user) return;
    loadPortalContext(user)
      .then((data) => {
        if (current) setContext(data);
      })
      .catch(() => {
        if (current) setError(true);
      });
    return () => {
      current = false;
    };
  }, [user, attempt]);
  if (!user) return null;
  if (error)
    return (
      <section className="cube-forum-v2 cf-loading" role="alert">
        <ShieldCheck />
        <h1>Forum şu an hazırlanamadı.</h1>
        <p>Bağlantını kontrol edip yeniden deneyebilirsin.</p>
        <button onClick={() => setAttempt((n) => n + 1)}>Yeniden dene</button>
      </section>
    );
  if (!context)
    return (
      <section className="cube-forum-v2 cf-loading" role="status">
        <span className="cf-loading-mark">
          <MessagesSquare />
        </span>
        <h1>Topluluk alanın hazırlanıyor</h1>
        <p>Portal profilin, başarımların ve questlerin yükleniyor.</p>
      </section>
    );
  return (
    <ForumBoard
      key={context.viewer.id}
      context={context}
      onRefresh={() => setAttempt((n) => n + 1)}
    />
  );
}

function useLocalForum(userId: string) {
  const key = `cube-forum-ui-v2:${userId}`;
  const [state, setState] = useState<ForumLocalState>(() => {
    try {
      const current = localStorage.getItem(key);
      if (current) return readLocalState(current, SAMPLE_TOPICS);
      const legacy = `cube-forum-preview-v2:${userId}:`;
      const parse = (name: string, fallback: unknown) => {
        try {
          return (
            JSON.parse(localStorage.getItem(legacy + name) || "null") ??
            fallback
          );
        } catch {
          return fallback;
        }
      };
      return migrateLegacyState(
        {
          topics: parse("topics", []),
          saved: parse("saved", []),
          following: parse("following", []),
          settings: parse("preferences", {}),
        },
        userId,
        SAMPLE_TOPICS,
      );
    } catch {
      return readLocalState(null, SAMPLE_TOPICS);
    }
  });
  const [storageError, setStorageError] = useState(false);
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }, [key, state]);
  return { state, setState, storageError };
}

function ForumBoard({
  context,
  onRefresh,
}: {
  context: PortalContext;
  onRefresh: () => void;
}) {
  const { viewer, people, quests, missions, notices } = context;
  const { state, setState, storageError } = useLocalForum(viewer.id);
  const [view, setView] = useState<View>("feed");
  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("latest");
  const [quest, setQuest] = useState<string | null>(null);
  const [stage, setStage] = useState<StageKey | "all">("all");
  const [menuOpen, setMenuOpen] = useState(false);
  const [compose, setCompose] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profile, setProfile] = useState<ForumMember | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState(false);
  const [toast, setToast] = useState("");
  const [page, setPage] = useState(1);
  const [drafts, setDrafts] = useState<Record<string, ThreadDraft>>({});
  const [params, setParams] = useSearchParams();
  const profileRequest = useRef(0);
  const topics = state.topics.filter((t) => !t.deleted);
  const preferences = safePreferences(
    state.settings,
    viewer.badges.map((b) => b.id),
  );
  const showcase = viewer.badges
    .filter((b) => preferences.badgeIds.includes(b.id))
    .sort(
      (a, b) =>
        preferences.badgeIds.indexOf(a.id) - preferences.badgeIds.indexOf(b.id),
    );
  const getMember = (id: string) =>
    id === viewer.id
      ? viewer
      : SAMPLE_MEMBERS.find((m) => m.id === id) ||
        people.find((m) => m.id === id) ||
        unknownMember;
  const selected = topics.find((t) => t.id === params.get("topic"));
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    setPage(1);
  }, [view, category, query, sort, quest, stage]);
  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [menuOpen]);
  const navigate = (next: View, cat = "all") => {
    setView(next);
    setCategory(cat);
    setQuest(null);
    setStage("all");
    setMenuOpen(false);
  };
  const toggle = (field: "saved" | "following", id: string) =>
    setState((prev) => ({
      ...prev,
      [field]: prev[field].includes(id)
        ? prev[field].filter((item) => item !== id)
        : [...prev[field], id],
    }));
  const closeTopic = () =>
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("topic");
      return next;
    });
  const openTopic = (topic: ForumTopic) => {
    setState((prev) => ({
      ...prev,
      topics: prev.topics.map((t) =>
        t.id === topic.id ? { ...t, unread: false } : t,
      ),
    }));
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("topic", topic.id);
      return next;
    });
  };
  const showProfile = async (member: ForumMember) => {
    const request = ++profileRequest.current;
    if (
      member.id === viewer.id ||
      (member.cubeId && member.cubeId === viewer.cubeId)
    )
      member = viewer;
    setProfile(member);
    setProfileError(false);
    setProfileLoading(false);
    if (member.sample || member.id === viewer.id || !member.cubeId) return;
    setProfileLoading(true);
    try {
      const full = await loadPublicMember(member.cubeId, member.stage);
      if (profileRequest.current === request) setProfile(full);
    } catch {
      if (profileRequest.current === request) setProfileError(true);
    } finally {
      if (profileRequest.current === request) setProfileLoading(false);
    }
  };
  const filtered = topics
    .filter((topic) => {
      if (category !== "all" && topic.categoryId !== category) return false;
      if (view === "saved" && !state.saved.includes(topic.id)) return false;
      if (view === "following" && !state.following.includes(topic.id))
        return false;
      if (sort === "unread" && !topic.unread) return false;
      if (quest && topic.questId !== quest) return false;
      if (stage !== "all" && getMember(topic.authorId).stage !== stage)
        return false;
      const needle = query.toLocaleLowerCase("tr");
      return `${topic.title || ""} ${topic.body || ""} ${(topic.tags || []).join(" ")}`
        .toLocaleLowerCase("tr")
        .includes(needle);
    })
    .sort(
      (a, b) =>
        Number(b.pinned) - Number(a.pinned) ||
        (sort === "popular"
          ? b.replies.filter((p) => !p.deleted).length -
            a.replies.filter((p) => !p.deleted).length
          : +new Date(b.createdAt) - +new Date(a.createdAt)),
    );
  const pageCount = Math.max(1, Math.ceil(filtered.length / 6));
  const activePage = Math.min(page, pageCount);
  const heading =
    view === "saved"
      ? "Kaydettiklerin"
      : view === "following"
        ? "Takip ettiğin konuşmalar"
        : view === "categories"
          ? "Konuşma alanları"
          : view === "quests"
            ? "Quest etrafında buluşalım"
            : view === "people"
              ? "Topluluk"
              : category !== "all"
                ? CATEGORIES.find((c) => c.id === category)?.name
                : "Topluluk akışı";
  const publicCounts = Object.values(context.hallCounts).reduce<number>(
    (sum, count) => sum + (count || 0),
    0,
  );

  return (
    <div className="cube-forum-v2 cf-app">
      <div className="cf-preview-bar">
        <span>
          <span className="cf-status-dot" />
          UI V2 · TASARIM ÖNİZLEMESİ
        </span>
        <p>
          Portal profilin ve başarımların gerçek veridir. Örnek konuşmalar ve
          yeni mesajlar bu tarayıcıda kalır.
        </p>
        <button
          onClick={onRefresh}
          title="Portal verilerini yenile"
          aria-label="Portal verilerini yenile"
        >
          <RefreshCw size={15} />
        </button>
      </div>
      {storageError && (
        <p role="alert" className="cf-notice">
          Tarayıcı kaydetmeye izin vermiyor; bu oturumdaki yeni mesajlar
          yenileyince kaybolabilir.
        </p>
      )}
      {notices.length > 0 && (
        <div className="cf-notice" role="status">
          {notices.join(" ")} <button onClick={onRefresh}>Yeniden dene</button>
        </div>
      )}
      <header className="cf-page-header">
        <div>
          <div className="cf-breadcrumb">
            <Link to="/dashboard">Iceberg X OS</Link>
            <ChevronRight size={13} />
            <span>Community</span>
            <ChevronRight size={13} />
            <strong>Forum</strong>
          </div>
          <h1>
            Cube Forum<span>.</span>
          </h1>
          <p>
            Bir soruyu birlikte çöz. Bir fikri büyüt. Bir Cube’un katkısını
            görünür kıl.
          </p>
        </div>
        <div className="cf-header-actions">
          <button
            className="cf-button cf-button-light"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings2 size={16} />
            Forum profilim
          </button>
          <button
            className="cf-button cf-button-primary"
            onClick={() => setCompose(true)}
          >
            <Plus size={17} />
            Yeni konu
          </button>
        </div>
      </header>
      <div className="cf-layout">
        <aside
          className={`cf-sidebar ${menuOpen ? "is-open" : ""}`}
          aria-label="Forum gezinmesi"
        >
          <div className="cf-sidebar-heading">
            <span className="cf-section-label">TOPLULUK ALANIN</span>
            <button
              className="cf-drawer-close"
              onClick={() => setMenuOpen(false)}
              aria-label="Forum menüsünü kapat"
            >
              <X size={19} />
            </button>
          </div>
          <nav className="cf-primary-nav" aria-label="Forum görünümleri">
            {(
              [
                {
                  id: "feed",
                  name: "Akış",
                  icon: MessagesSquare,
                  count: topics.length,
                },
                { id: "categories", name: "Kategoriler", icon: Layers },
                {
                  id: "following",
                  name: "Takip ettiklerim",
                  icon: Bell,
                  count: state.following.length,
                },
                {
                  id: "saved",
                  name: "Kaydettiklerim",
                  icon: Bookmark,
                  count: state.saved.length,
                },
                { id: "quests", name: "Quest tartışmaları", icon: Target },
                { id: "people", name: "Cubeları keşfet", icon: Users },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                className={
                  view === item.id && category === "all" ? "is-active" : ""
                }
                onClick={() => navigate(item.id)}
              >
                <item.icon size={17} />
                <span>{item.name}</span>
                {"count" in item && <small>{item.count}</small>}
              </button>
            ))}
          </nav>
          <div className="cf-section-label cf-nav-label">KONUŞMA ALANLARI</div>
          <nav className="cf-category-nav" aria-label="Kategoriler">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                className={category === c.id ? "is-active" : ""}
                onClick={() => navigate("feed", c.id)}
              >
                <span
                  className="cf-category-dot"
                  style={{ background: c.color }}
                />
                <span>{c.name}</span>
                <small>
                  {topics.filter((t) => t.categoryId === c.id).length}
                </small>
              </button>
            ))}
          </nav>
          <section className="cf-stage-legend">
            <div className="cf-section-label">HER KATKININ BİR RENGİ VAR</div>
            {(["cube", "candidate", "senior", "iceberger"] as StageKey[]).map(
              (key) => (
                <div key={key}>
                  <span style={{ background: STAGES[key].color }} />
                  {STAGES[key].label}
                </div>
              ),
            )}
            <Link to="/hall-of-fame">
              Yolculuğu keşfet <ArrowUpRight size={13} />
            </Link>
          </section>
          <button
            className="cf-sidebar-self"
            onClick={() => void showProfile(viewer)}
          >
            <Avatar member={viewer} size="sm" />
            <span>
              <strong>{viewer.name.split(" ").slice(0, 2).join(" ")}</strong>
              <small>
                {viewer.cubeNumber
                  ? `Cube #${viewer.cubeNumber}`
                  : viewer.portalRole}
              </small>
            </span>
            <ChevronRight size={15} />
          </button>
        </aside>
        {menuOpen && (
          <button
            className="cf-drawer-backdrop"
            aria-label="Forum menüsünü kapat"
            onClick={() => setMenuOpen(false)}
          />
        )}
        <main className="cf-main">
          <section className="cf-welcome">
            <div>
              <span className="cf-eyebrow">
                <Sparkles size={13} />
                BUILD. BE SEEN. LEVEL UP.
              </span>
              <h2>Birlikte daha fazlasını çöz.</h2>
              <p>
                Questi konuşmaya bağla, deneyimini paylaş.
                <br />
                Burada biriken bilgi, sıradaki Cube’un başlangıç noktası.
              </p>
              <div className="cf-welcome-links">
                <button onClick={() => navigate("feed", "help")}>
                  Bir sorum var <ArrowRight size={14} />
                </button>
                <button onClick={() => navigate("feed", "showcase")}>
                  Bir şey ürettim <ArrowUpRight size={14} />
                </button>
              </div>
            </div>
            <div className="cf-hero-mark" aria-hidden="true">
              <MessagesSquare size={56} strokeWidth={1.1} />
              <span className="cf-hero-spark">✦</span>
              <span className="cf-hero-cube">◇</span>
            </div>
          </section>
          <div className="cf-toolbar">
            <button
              className="cf-mobile-menu"
              onClick={() => setMenuOpen(true)}
              aria-label="Forum menüsünü aç"
            >
              <Menu size={19} />
            </button>
            <label className="cf-search">
              <Search size={18} />
              <input
                type="search"
                aria-label="Forumda ara"
                placeholder="Bir konu, soru veya çözüm ara…"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setView("feed");
                }}
              />
              <kbd>ARA</kbd>
            </label>
            <button
              className="cf-people-shortcut"
              onClick={() => navigate("people")}
              aria-label="Topluluğu keşfet"
            >
              <Users size={18} />
            </button>
          </div>
          <div className="cf-section-heading">
            <div>
              <h2>{heading}</h2>
              <span>
                {view === "people"
                  ? `${people.length} portal profili`
                  : view === "quests"
                    ? `${quests.length} quest`
                    : `${filtered.length} konuşma`}
              </span>
            </div>
            {view === "feed" && (
              <select
                aria-label="Kademe filtresi"
                value={stage}
                onChange={(e) => setStage(e.target.value as StageKey | "all")}
              >
                <option value="all">Tüm kademeler</option>
                {(
                  [
                    "cube",
                    "candidate",
                    "senior",
                    "iceberger",
                    "mentor",
                  ] as StageKey[]
                ).map((s) => (
                  <option key={s} value={s}>
                    {STAGES[s].label}
                  </option>
                ))}
              </select>
            )}
          </div>
          {view === "categories" ? (
            <div className="cf-category-grid">
              {CATEGORIES.map((c) => {
                const Icon =
                  icons[c.icon as keyof typeof icons] || MessagesSquare;
                const list = topics.filter((t) => t.categoryId === c.id);
                return (
                  <button
                    className="cf-category-card"
                    key={c.id}
                    onClick={() => navigate("feed", c.id)}
                  >
                    <span
                      className="cf-category-icon"
                      style={{ color: c.color, background: c.color + "12" }}
                    >
                      <Icon size={22} />
                    </span>
                    <h3>{c.name}</h3>
                    <p>{c.description}</p>
                    <footer>
                      <span>
                        {list.length} konu ·{" "}
                        {list.reduce(
                          (n, t) =>
                            n + t.replies.filter((p) => !p.deleted).length,
                          0,
                        )}{" "}
                        yanıt
                      </span>
                      <ArrowUpRight size={17} />
                    </footer>
                    {c.id === "announcements" && (
                      <small>
                        <Lock size={11} />
                        Konu açma: Mentor / Admin
                      </small>
                    )}
                  </button>
                );
              })}
            </div>
          ) : view === "quests" ? (
            <div className="cf-quest-board">
              {quests.length ? (
                quests.map((q) => (
                  <QuestCard
                    ownProgress={viewer.portalRole === "CUBE"}
                    key={q.id}
                    quest={q}
                    onDiscuss={() => {
                      navigate("feed");
                      setQuest(q.id);
                    }}
                  />
                ))
              ) : (
                <Empty
                  icon={<Target />}
                  title="Henüz bir questin yok."
                  text="Portalda atanan questler burada görünecek."
                  action={
                    <Link to="/quests">
                      Quest Board’a git <ArrowUpRight size={14} />
                    </Link>
                  }
                />
              )}
            </div>
          ) : view === "people" ? (
            <div className="cf-people-grid">
              {people.length ? (
                people.map((member) => (
                  <button
                    key={member.id}
                    className="cf-person-tile"
                    style={stageStyle(member.stage)}
                    onClick={() => void showProfile(member)}
                  >
                    <Avatar member={member} size="lg" />
                    <h3>{member.name}</h3>
                    <StagePill member={member} />
                    <span>
                      #{member.cubeNumber || "—"}
                      {member.founding ? " · Founding Cube" : ""}
                    </span>
                    <small>{member.cohort || "Iceberg X"}</small>
                    <span className="cf-person-open">
                      Profili keşfet <ArrowUpRight size={13} />
                    </span>
                  </button>
                ))
              ) : (
                <Empty
                  icon={<Users />}
                  title="Topluluk yüklenemedi."
                  text="Portalın Directory sayfasından Cubelara ulaşabilirsin."
                  action={<Link to="/directory">Directory’yi aç</Link>}
                />
              )}
            </div>
          ) : (
            <>
              <div
                className="cf-feed-tabs"
                role="tablist"
                aria-label="Konu sıralaması"
              >
                <button
                  role="tab"
                  aria-selected={sort === "latest"}
                  onClick={() => setSort("latest")}
                >
                  <Sparkles size={14} />
                  Son konuşmalar
                </button>
                <button
                  role="tab"
                  aria-selected={sort === "popular"}
                  onClick={() => setSort("popular")}
                >
                  <Flame size={14} />
                  En çok konuşulan
                </button>
                <button
                  role="tab"
                  aria-selected={sort === "unread"}
                  onClick={() => setSort("unread")}
                >
                  <span className="cf-unread-dot" />
                  Okunmamış
                </button>
              </div>
              <div className="cf-filter-row">
                <button
                  className={category === "all" ? "is-active" : ""}
                  onClick={() => setCategory("all")}
                >
                  Tümü
                </button>
                {CATEGORIES.map((c) => (
                  <button
                    key={c.id}
                    className={category === c.id ? "is-active" : ""}
                    onClick={() => setCategory(c.id)}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
              {quest && (
                <div className="cf-active-filter">
                  <Target size={14} />
                  <span>
                    {quests.find((q) => q.id === quest)?.title ||
                      "Quest tartışması"}
                  </span>
                  <button
                    onClick={() => setQuest(null)}
                    aria-label="Quest filtresini kaldır"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
              <div className="cf-topic-list">
                {filtered
                  .slice((activePage - 1) * 6, activePage * 6)
                  .map((topic) => {
                    const author = getMember(topic.authorId);
                    const c = CATEGORIES.find((c) => c.id === topic.categoryId);
                    const linkedQuest = quests.find(
                      (q) => q.id === topic.questId,
                    );
                    const linkedMission = missions.find(
                      (m) => m.id === topic.missionId,
                    );
                    return (
                      <article
                        className="cf-topic-row"
                        key={topic.id}
                        style={stageStyle(author.stage)}
                      >
                        <div className="cf-topic-topline">
                          <span
                            className="cf-topic-category"
                            style={{ color: c?.color }}
                          >
                            {c?.name || "Topluluk"}
                          </span>
                          {topic.pinned && (
                            <span className="cf-pin">
                              <Pin size={11} />
                              Sabit
                            </span>
                          )}
                          {topic.unread && (
                            <span className="cf-unread-label">Yeni</span>
                          )}
                          <time dateTime={topic.createdAt}>
                            {relative(topic.createdAt)}
                          </time>
                          <button
                            className={`cf-save ${state.saved.includes(topic.id) ? "is-saved" : ""}`}
                            onClick={() => toggle("saved", topic.id)}
                            aria-label={
                              state.saved.includes(topic.id)
                                ? "Kaydı kaldır"
                                : "Konuyu kaydet"
                            }
                          >
                            <Bookmark
                              size={16}
                              fill={
                                state.saved.includes(topic.id)
                                  ? "currentColor"
                                  : "none"
                              }
                            />
                          </button>
                        </div>
                        <button
                          className="cf-topic-title"
                          onClick={() => openTopic(topic)}
                        >
                          {topic.title}
                        </button>
                        <p className="cf-topic-excerpt">
                          {topic.body.replace(/[#*`\[\]]/g, "").slice(0, 190)}
                        </p>
                        <div className="cf-topic-meta">
                          <button
                            className="cf-author-mini"
                            onClick={() => void showProfile(author)}
                          >
                            <Avatar member={author} size="xs" />
                            <strong>{author.name}</strong>
                          </button>
                          <StagePill member={author} compact />
                          {author.founding && (
                            <span
                              className="cf-founding-mini"
                              title="Founding Cube"
                            >
                              <Crown size={12} />
                            </span>
                          )}
                          <span className="cf-topic-replies">
                            <MessageCircle size={15} />
                            {topic.replies.filter((p) => !p.deleted).length}
                            <small>yanıt</small>
                          </span>
                        </div>
                        {(linkedQuest || linkedMission) && (
                          <div className="cf-topic-links">
                            {linkedQuest && (
                              <button onClick={() => setQuest(linkedQuest.id)}>
                                <Target size={12} />
                                {linkedQuest.title}
                              </button>
                            )}
                            {linkedMission && (
                              <Link to={`/missions/${linkedMission.id}`}>
                                <Layers size={12} />
                                {linkedMission.title}
                              </Link>
                            )}
                          </div>
                        )}
                      </article>
                    );
                  })}
              </div>
              {!filtered.length && (
                <Empty
                  icon={<MessagesSquare />}
                  title={
                    view === "saved"
                      ? "İyi fikirleri burada biriktir."
                      : view === "following"
                        ? "Bir konuşmaya yakın kal."
                        : "Henüz bir konuşma yok."
                  }
                  text={
                    view === "saved"
                      ? "Bir konudaki yer imi simgesini kullanarak kaydedebilirsin."
                      : view === "following"
                        ? "Bir konuyu açıp “Takip et” seçeneğini kullan."
                        : "Filtreyi değiştirebilir veya bu konuşmayı sen başlatabilirsin."
                  }
                  action={
                    <button
                      onClick={() => {
                        if (
                          query ||
                          category !== "all" ||
                          stage !== "all" ||
                          quest
                        ) {
                          setQuery("");
                          navigate("feed");
                        } else setCompose(true);
                      }}
                    >
                      {query || category !== "all" || stage !== "all" || quest
                        ? "Filtreleri temizle"
                        : "Yeni konu aç"}
                      <ArrowRight size={14} />
                    </button>
                  }
                />
              )}
              <Pagination
                page={activePage}
                pages={pageCount}
                onChange={setPage}
              />
            </>
          )}
          <div className="cf-feed-footnote">
            <ShieldCheck size={14} />
            <span>
              Fikirler konuşulur. Kişiler değil. Birbirimizi ileri taşıyalım.
            </span>
          </div>
        </main>
        <aside
          className="cf-context"
          aria-label="Portal profilin ve topluluk bağlamı"
        >
          <section
            className="cf-context-card cf-self-card"
            style={stageStyle(viewer.stage)}
          >
            <div className="cf-card-label">
              SENİN CUBE ALANIN
              <button
                onClick={() => setSettingsOpen(true)}
                aria-label="Vitrin ve imza ayarları"
              >
                <Settings2 size={15} />
              </button>
            </div>
            <button
              className="cf-self-identity"
              onClick={() => void showProfile(viewer)}
            >
              <Avatar member={viewer} size="lg" />
              <span>
                <strong>{viewer.name}</strong>
                <small>
                  {viewer.cubeNumber
                    ? `Cube #${viewer.cubeNumber}`
                    : "Iceberg X"}
                </small>
              </span>
            </button>
            <div className="cf-self-labels">
              <StagePill member={viewer} />
              {viewer.founding && (
                <span className="cf-founding">
                  <Crown size={11} />
                  Founding Cube
                </span>
              )}
            </div>
            <div className="cf-showcase">
              <BadgeList badges={showcase} />
              <button onClick={() => setSettingsOpen(true)}>
                {showcase.length ? "Vitrini düzenle" : "Üç rozetini seç"}
                <ChevronRight size={12} />
              </button>
            </div>
            <div className="cf-profile-stats">
              <span>
                <strong>{viewer.badges.length}</strong>başarım
              </span>
              <span>
                <strong>{viewer.stats.questsCompleted}</strong>quest
              </span>
              <span>
                <strong>{viewer.stats.missionContributions}</strong>mission
              </span>
            </div>
            {viewer.titles[0] && (
              <div className="cf-peer-highlight">
                <HeartHandshake size={14} />
                <span>{viewer.titles[0].label}</span>
                <small>{viewer.titles[0].rarity}</small>
              </div>
            )}
            <Link
              className="cf-text-link"
              to={viewer.cubeId ? `/cubes/${viewer.cubeId}` : "/dashboard"}
            >
              Portal profilimi aç <ArrowUpRight size={13} />
            </Link>
          </section>
          <section className="cf-context-card">
            <div className="cf-card-label">
              <span>
                <HeartHandshake size={14} />
                KATKI GÖRÜNÜR OLSUN
              </span>
            </div>
            {viewer.quotes[0] ? (
              <PublicQuote quote={viewer.quotes[0]} />
            ) : (
              <>
                <p className="cf-context-copy">
                  Bir Cube yolunu açtıysa, iyi bir çözüm paylaştıysa ya da seni
                  dinlediyse…
                </p>
                <p className="cf-context-callout">
                  Bir teşekkür, düşündüğünden daha çok şey değiştirir.
                </p>
              </>
            )}
            {viewer.portalRole === "CUBE" &&
            ["cube", "senior", "candidate"].includes(viewer.stage) ? (
              <GiveFeedbackButton variant="soft" label="Bir Cube’u takdir et" />
            ) : (
              <Link className="cf-text-link" to="/mvcubes">
                MVCubes’ı keşfet <ArrowUpRight size={13} />
              </Link>
            )}
            <p className="cf-field-hint">
              Takdir gönderimi portalda gerçek bir işlemdir.
            </p>
            <p className="cf-privacy-hint">
              <ShieldCheck size={12} />
              Yalnızca paylaşılması seçilen teşekkürler görünür. Gönderenin
              kimliği gösterilmez.
            </p>
          </section>
          <section className="cf-context-card">
            <div className="cf-card-label">
              <span>
                <Target size={14} />
                QUEST BAĞLANTILARI
              </span>
              <Link to="/quests" aria-label="Tüm questleri aç">
                <ArrowUpRight size={14} />
              </Link>
            </div>
            {quests.slice(0, 3).map((q) => (
              <button
                className="cf-quest-mini"
                key={q.id}
                onClick={() => {
                  navigate("feed");
                  setQuest(q.id);
                }}
              >
                <span
                  className={`cf-quest-state ${q.completed ? "is-done" : ""}`}
                >
                  {q.completed ? <Check size={13} /> : <Target size={13} />}
                </span>
                <span>
                  <strong>{q.title}</strong>
                  <small>
                    {viewer.portalRole !== "CUBE"
                      ? "Quest kataloğu"
                      : q.completed
                        ? "Tamamlandı"
                        : `${q.current} / ${q.target}`}
                  </small>
                </span>
                <ChevronRight size={14} />
              </button>
            ))}
            {!quests.length && (
              <p className="cf-context-copy">
                Portalda atanan questler burada görünecek.
              </p>
            )}
            <Link className="cf-text-link" to="/quests">
              Quest Board’u aç <ArrowUpRight size={13} />
            </Link>
          </section>
          {missions.length > 0 && (
            <section className="cf-context-card">
              <div className="cf-card-label">
                <span>
                  <Layers size={14} />
                  BİRLİKTE ÜRETTİKLERİN
                </span>
              </div>
              {missions.slice(0, 2).map((m) => (
                <Link
                  className="cf-mission-mini"
                  key={m.id}
                  to={`/missions/${m.id}`}
                >
                  <span>
                    <strong>{m.title}</strong>
                    <small>{m.status.replace(/_/g, " ")}</small>
                  </span>
                  <ArrowUpRight size={13} />
                </Link>
              ))}
            </section>
          )}
          <section className="cf-context-card cf-portal-links">
            <div className="cf-card-label">PORTALDA DEVAM ET</div>
            <Link to="/fundamentals">
              <BookOpen size={16} />
              <span>
                Fundamentals <small>Öğren, quiz’e katıl</small>
              </span>
              <ArrowUpRight size={13} />
            </Link>
            <Link to="/vault">
              <Layers size={16} />
              <span>
                Cube Vault <small>Biriken üretim ve bilgi</small>
              </span>
              <ArrowUpRight size={13} />
            </Link>
            <Link to="/hall-of-fame">
              <Trophy size={16} />
              <span>
                Hall of Fame <small>Her Cube’un yolculuğu</small>
              </span>
              <ArrowUpRight size={13} />
            </Link>
            <Link to="/notification-history">
              <Bell size={16} />
              <span>
                Bildirimler <small>Portalındaki gelişmeler</small>
              </span>
              <ArrowUpRight size={13} />
            </Link>
          </section>
          <div className="cf-community-total">
            <Users size={16} />
            <span>
              {publicCounts
                ? `${publicCounts} profil aynı yolculukta.`
                : "Birlikte, daha ileri."}
            </span>
          </div>
        </aside>
      </div>
      {params.get("topic") && !selected && (
        <div className="cf-notice" role="status">
          Bu konu bu tarayıcıda bulunamadı.{" "}
          <button onClick={closeTopic}>Akışa dön</button>
        </div>
      )}
      {selected && !profile && !compose && !settingsOpen && (
        <Thread
          key={selected.id}
          initialDraft={drafts[selected.id]}
          onRemember={(draft) =>
            setDrafts((prev) => ({ ...prev, [selected.id]: draft }))
          }
          topic={selected}
          viewer={viewer}
          getMember={getMember}
          showcase={showcase}
          signature={preferences.signature}
          quest={quests.find((q) => q.id === selected.questId)}
          isFollowing={state.following.includes(selected.id)}
          onFollow={() => toggle("following", selected.id)}
          onClose={closeTopic}
          onProfile={(member) => void showProfile(member)}
          onChange={(next) =>
            setState((prev) => ({
              ...prev,
              topics: prev.topics.map((t) => (t.id === next.id ? next : t)),
            }))
          }
          notify={setToast}
        />
      )}
      {compose && (
        <Composer
          role={viewer.portalRole}
          quests={quests}
          missions={missions}
          defaultCategory={category}
          onClose={() => setCompose(false)}
          onCreate={(data) => {
            const topic: ForumTopic = {
              ...data,
              id: crypto.randomUUID(),
              authorId: viewer.id,
              createdAt: new Date().toISOString(),
              views: 0,
              unread: false,
              pinned: false,
              tags: [],
              replies: [],
            };
            setState((prev) => ({ ...prev, topics: [topic, ...prev.topics] }));
            setCompose(false);
            setQuery("");
            navigate("feed");
            setSort("latest");
            setToast("Konun bu tarayıcıdaki önizlemeye eklendi.");
          }}
        />
      )}
      {settingsOpen && (
        <ProfileSettings
          viewer={viewer}
          settings={preferences}
          onClose={() => setSettingsOpen(false)}
          onSave={(settings) => {
            setState((prev) => ({
              ...prev,
              settings: safePreferences(
                settings,
                viewer.badges.map((b) => b.id),
              ),
            }));
            setSettingsOpen(false);
            setToast("Vitrin ve imzan bu tarayıcıda kaydedildi.");
          }}
        />
      )}
      {profile && (
        <MemberProfile
          member={profile}
          showcase={
            profile.id === viewer.id ? showcase : profile.badges.slice(0, 3)
          }
          viewer={viewer}
          loading={profileLoading}
          error={profileError}
          onRetry={() => void showProfile(profile)}
          onClose={() => {
            profileRequest.current++;
            setProfile(null);
          }}
        />
      )}
      {toast && (
        <div className="cf-toast" role="status">
          <CheckCircle2 size={17} />
          <span>{toast}</span>
          <button onClick={() => setToast("")} aria-label="Bildirimi kapat">
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

function Avatar({
  member,
  size = "md",
}: {
  member: ForumMember;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [member.avatarUrl]);
  return (
    <span
      className={`cf-avatar cf-avatar-${size}`}
      style={stageStyle(member.stage)}
      aria-hidden="true"
    >
      <span>
        {member.avatarUrl && !failed ? (
          <img
            src={getAssetUrl(member.avatarUrl) || undefined}
            alt=""
            onError={() => setFailed(true)}
          />
        ) : (
          member.initials || initials(member.name)
        )}
      </span>
      {member.founding && size !== "xs" && (
        <i>
          <Crown size={size === "xl" ? 13 : 9} />
        </i>
      )}
    </span>
  );
}
function StagePill({
  member,
  compact = false,
}: {
  member: ForumMember;
  compact?: boolean;
}) {
  return (
    <span
      className={`cf-stage-pill ${compact ? "is-compact" : ""}`}
      style={stageStyle(member.stage)}
    >
      <span />
      {STAGES[member.stage].label}
    </span>
  );
}
function BadgeList({
  badges,
  large = false,
}: {
  badges: ForumBadge[];
  large?: boolean;
}) {
  return (
    <div className={`cf-badge-list ${large ? "is-large" : ""}`}>
      {badges.slice(0, 3).map((b) => (
        <span
          key={b.id}
          className="cf-badge-token"
          title={`${b.name} · ${b.rarity}`}
        >
          <BadgeDisc icon={b.icon} rarity={b.rarity} size="sm" />
          <span className="cf-sr-only">
            {b.name} · {b.rarity}
          </span>
        </span>
      ))}
    </div>
  );
}
function Markdown({ text }: { text: string }) {
  return (
    <div className="cf-markdown">
      <ReactMarkdown skipHtml components={{ img: () => null }}>
        {text}
      </ReactMarkdown>
    </div>
  );
}
function Empty({
  icon,
  title,
  text,
  action,
}: {
  icon: ReactNode;
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="cf-empty">
      <span>{icon}</span>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}
function Pagination({
  page,
  pages,
  onChange,
}: {
  page: number;
  pages: number;
  onChange: (page: number) => void;
}) {
  if (pages < 2) return null;
  return (
    <nav className="cf-pagination" aria-label="Sayfalama">
      <button
        disabled={page === 1}
        onClick={() => onChange(page - 1)}
        aria-label="Önceki sayfa"
      >
        <ChevronLeft size={16} />
      </button>
      <span>
        {page} / {pages}
      </span>
      <button
        disabled={page === pages}
        onClick={() => onChange(page + 1)}
        aria-label="Sonraki sayfa"
      >
        <ChevronRight size={16} />
      </button>
    </nav>
  );
}
function PublicQuote({ quote }: { quote: ForumMember["quotes"][number] }) {
  return (
    <figure className="cf-public-quote">
      <Quote size={18} />
      <blockquote>“{quote.note}”</blockquote>
      <figcaption>
        <span>Anonim teşekkür</span>
        {quote.period && <time>{quote.period}</time>}
      </figcaption>
      <div>
        {quote.tags.map((t) => (
          <span key={t.key}>{t.label}</span>
        ))}
      </div>
    </figure>
  );
}
function QuestCard({
  quest,
  onDiscuss,
  ownProgress,
}: {
  ownProgress: boolean;
  quest: ForumQuest;
  onDiscuss: () => void;
}) {
  const progress = Math.min(
    100,
    Math.max(0, quest.target ? (quest.current / quest.target) * 100 : 0),
  );
  return (
    <article
      className={`cf-quest-card ${quest.completed ? "is-complete" : ""}`}
    >
      <div className="cf-quest-card-top">
        <span>
          {quest.completed ? (
            <CheckCircle2 size={20} />
          ) : quest.locked ? (
            <Lock size={20} />
          ) : (
            <Target size={20} />
          )}
        </span>
        <RarityPill rarity={quest.difficulty} />
      </div>
      <h3>{quest.title}</h3>
      <p>{quest.description}</p>
      {ownProgress ? (
        <>
          <div className="cf-quest-progress-label">
            <span>
              {quest.completed
                ? "Tamamlandı"
                : quest.locked
                  ? "Önceki quest bekleniyor"
                  : "İlerleme"}
            </span>
            <strong>
              {quest.current} / {quest.target}
            </strong>
          </div>
          <div
            className="cf-progress"
            role="progressbar"
            aria-label={quest.title}
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <span style={{ width: `${progress}%` }} />
          </div>
        </>
      ) : (
        <p className="cf-field-hint">
          Quest kataloğu · Kişisel ilerleme değildir.
        </p>
      )}
      <footer>
        <button onClick={onDiscuss}>
          Questi konuş <MessageCircle size={14} />
        </button>
        <Link to="/quests">
          Detay <ArrowUpRight size={13} />
        </Link>
      </footer>
      <small>Bir konuya etiketlemek quest ilerlemesini değiştirmez.</small>
    </article>
  );
}

function Dialog({
  title,
  description,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    const key = (event: KeyboardEvent) => {
      const dialogs = document.querySelectorAll(
        '[role="dialog"][aria-modal="true"]',
      );
      if (dialogs[dialogs.length - 1] !== ref.current) return;
      if (event.key === "Escape") close.current();
      if (event.key !== "Tab") return;
      const nodes = Array.from(
        ref.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]),a[href],input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex="0"]',
        ) || [],
      ).filter((node) => node.getClientRects().length);
      if (!nodes.length) {
        event.preventDefault();
        return;
      }
      if (
        event.shiftKey &&
        (document.activeElement === nodes[0] ||
          document.activeElement === ref.current)
      ) {
        event.preventDefault();
        nodes[nodes.length - 1]?.focus();
      } else if (
        !event.shiftKey &&
        document.activeElement === nodes[nodes.length - 1]
      ) {
        event.preventDefault();
        nodes[0].focus();
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      document.body.style.overflow = overflow;
      if (before?.isConnected) before.focus();
    };
  }, []);
  return (
    <div
      className="cf-dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={`cf-dialog ${wide ? "is-wide" : ""}`}
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
      >
        <header className="cf-dialog-header">
          <div>
            <h2>{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <button onClick={onClose} aria-label="Kapat">
            <X size={21} />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}

function Composer({
  role,
  quests,
  missions,
  defaultCategory,
  onClose,
  onCreate,
}: {
  role: PortalRole;
  quests: ForumQuest[];
  missions: PortalContext["missions"];
  defaultCategory: string;
  onClose: () => void;
  onCreate: (
    data: Pick<
      ForumTopic,
      "title" | "body" | "categoryId" | "questId" | "missionId"
    >,
  ) => void;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState(
    defaultCategory !== "all" && canCompose(role, defaultCategory)
      ? defaultCategory
      : "help",
  );
  const [quest, setQuest] = useState("");
  const [mission, setMission] = useState("");
  return (
    <Dialog
      title="Yeni bir konuşma başlat"
      description="Biraz bağlam, net bir soru. Devamını birlikte getirelim."
      onClose={onClose}
    >
      <form
        className="cf-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (
            title.trim().length >= 8 &&
            body.trim().length >= 15 &&
            canCompose(role, category)
          )
            onCreate({
              title: title.trim(),
              body: body.trim(),
              categoryId: category,
              questId: quest || null,
              missionId: mission || null,
            });
        }}
      >
        <div className="cf-form-row">
          <label>
            Kategori
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {CATEGORIES.filter((c) => canCompose(role, c.id)).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Quest etiketi <small>isteğe bağlı</small>
            <select value={quest} onChange={(e) => setQuest(e.target.value)}>
              <option value="">Quest seçilmedi</option>
              {quests.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.title}
                </option>
              ))}
            </select>
          </label>
        </div>
        {missions.length > 0 && (
          <label>
            Mission bağlantısı <small>isteğe bağlı</small>
            <select
              value={mission}
              onChange={(e) => setMission(e.target.value)}
            >
              <option value="">Mission seçilmedi</option>
              {missions.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          Konu başlığı
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            minLength={8}
            maxLength={140}
            required
            placeholder="Neyi konuşmak istersin?"
          />
          <small>{title.length} / 140</small>
        </label>
        <label htmlFor="cf-topic-body">Mesajın</label>
        <MarkdownEditor
          id="cf-topic-body"
          value={body}
          onChange={(value) => setBody(value.slice(0, 10000))}
          rows={7}
          required
          placeholder="Ne denedin, nerede takıldın, neyi paylaşmak istiyorsun?"
        />
        <p className="cf-field-hint">
          En az 15 karakter. Markdown kullanabilirsin. Bu önizlemede mesajın
          yalnızca kendi tarayıcına kaydedilir.
        </p>
        <footer className="cf-form-actions">
          <button
            type="button"
            className="cf-button cf-button-light"
            onClick={onClose}
          >
            Vazgeç
          </button>
          <button
            className="cf-button cf-button-primary"
            disabled={title.trim().length < 8 || body.trim().length < 15}
          >
            <Send size={15} />
            Konuyu paylaş
          </button>
        </footer>
      </form>
    </Dialog>
  );
}

function ProfileSettings({
  viewer,
  settings,
  onClose,
  onSave,
}: {
  viewer: ForumMember;
  settings: ForumSettings;
  onClose: () => void;
  onSave: (settings: ForumSettings) => void;
}) {
  const [selected, setSelected] = useState(settings.badgeIds);
  const [signature, setSignature] = useState(settings.signature);
  const move = (index: number, step: number) =>
    setSelected((prev) => {
      const next = [...prev];
      [next[index], next[index + step]] = [next[index + step], next[index]];
      return next;
    });
  return (
    <Dialog
      title="Katkın, senin imzan."
      description="Kazandıklarından üçünü öne çıkar. Her mesajının altına küçük bir iz bırak."
      onClose={onClose}
    >
      <form
        className="cf-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSave(
            safePreferences(
              { badgeIds: selected, signature },
              viewer.badges.map((b) => b.id),
            ),
          );
        }}
      >
        <div className="cf-settings-preview" style={stageStyle(viewer.stage)}>
          <Avatar member={viewer} size="lg" />
          <div>
            <h3>{viewer.name}</h3>
            <StagePill member={viewer} />
            <small>Çerçeve rengi portal kademenden gelir.</small>
          </div>
        </div>
        <div className="cf-subheading">
          <h3>Vitrin rozetlerin</h3>
          <span>{selected.length} / 3</span>
        </div>
        {viewer.badges.length ? (
          <div className="cf-badge-picker">
            {viewer.badges.map((b) => (
              <button
                key={b.id}
                type="button"
                aria-pressed={selected.includes(b.id)}
                className={selected.includes(b.id) ? "is-selected" : ""}
                disabled={!selected.includes(b.id) && selected.length >= 3}
                onClick={() =>
                  setSelected((prev) =>
                    prev.includes(b.id)
                      ? prev.filter((id) => id !== b.id)
                      : [...prev, b.id],
                  )
                }
              >
                <BadgeDisc icon={b.icon} rarity={b.rarity} size="md" />
                <strong>{b.name}</strong>
                <RarityPill rarity={b.rarity} />
                {selected.includes(b.id) && (
                  <span className="cf-pick-order">
                    {selected.indexOf(b.id) + 1}
                  </span>
                )}
              </button>
            ))}
          </div>
        ) : (
          <div className="cf-inline-empty">
            <Award size={23} />
            <p>Henüz kazanılmış bir rozetin yok.</p>
            <Link to="/quests">
              İlk questini keşfet <ArrowUpRight size={13} />
            </Link>
          </div>
        )}
        {selected.length > 1 && (
          <div className="cf-badge-order">
            {selected.map((id, i) => (
              <div key={id}>
                <span>
                  {i + 1}. {viewer.badges.find((b) => b.id === id)?.name}
                </span>
                <button
                  type="button"
                  disabled={!i}
                  aria-label="Rozeti sola taşı"
                  onClick={() => move(i, -1)}
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  type="button"
                  disabled={i === selected.length - 1}
                  aria-label="Rozeti sağa taşı"
                  onClick={() => move(i, 1)}
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
        <label>
          Forum imzan
          <textarea
            value={signature}
            onChange={(e) => setSignature(e.target.value)}
            maxLength={140}
            rows={3}
            placeholder="Her katkının altında görünecek kısa bir not."
          />
          <small>{signature.length} / 140</small>
        </label>
        <p className="cf-field-hint">
          <ShieldCheck size={13} />
          Yalnızca kendi kazanılmış rozetlerin seçilebilir. Bu tercih bu
          tarayıcıda saklanır.
        </p>
        <footer className="cf-form-actions">
          <button
            type="button"
            className="cf-button cf-button-light"
            onClick={onClose}
          >
            Vazgeç
          </button>
          <button className="cf-button cf-button-primary">
            <Check size={15} />
            Kaydet
          </button>
        </footer>
      </form>
    </Dialog>
  );
}

function MemberProfile({
  member,
  showcase,
  viewer,
  loading,
  error,
  onRetry,
  onClose,
}: {
  member: ForumMember;
  showcase: ForumBadge[];
  viewer: ForumMember;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  onClose: () => void;
}) {
  const eligible =
    viewer.portalRole === "CUBE" &&
    ["cube", "senior", "candidate"].includes(viewer.stage) &&
    member.portalRole === "CUBE" &&
    ["cube", "senior", "candidate"].includes(member.stage) &&
    member.id !== viewer.id &&
    member.cubeId !== viewer.cubeId &&
    !!member.cubeId &&
    !member.sample;
  return (
    <Dialog
      title="Cube profili"
      description={
        member.sample
          ? "Örnek forum kişisi · Bu kart gerçek bir kullanıcıya ait değildir."
          : "Portalda görünür olan başarımlar ve kişinin paylaşmayı seçtiği teşekkürler."
      }
      onClose={onClose}
    >
      <div className="cf-member-profile">
        <div className="cf-member-cover" style={stageStyle(member.stage)}>
          <Avatar member={member} size="xl" />
          <div>
            <div className="cf-member-number">
              {member.cubeNumber ? `CUBE #${member.cubeNumber}` : "ICEBERG X"}
            </div>
            <h3>{member.name}</h3>
            <div className="cf-member-labels">
              <StagePill member={member} />
              {member.founding && (
                <span className="cf-founding">
                  <Crown size={12} />
                  Founding Cube
                </span>
              )}
              {member.portalRole !== "CUBE" && (
                <span className="cf-permission-label">{member.portalRole}</span>
              )}
            </div>
            <p>
              {[member.cohort, member.university].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>
        {loading && (
          <p className="cf-profile-loading" role="status">
            Görünür profil bilgileri yükleniyor…
          </p>
        )}
        {error && (
          <p className="cf-notice" role="alert">
            Profil detayları yüklenemedi.{" "}
            <button onClick={onRetry}>Yeniden dene</button>
          </p>
        )}
        {!loading && !error && (
          <>
            <div className="cf-member-stats">
              <span>
                <strong>{member.badges.length}</strong>kazanılmış rozet
              </span>
              <span>
                <strong>{member.stats.questsCompleted}</strong>tamamlanan quest
              </span>
              <span>
                <strong>{member.stats.missionContributions}</strong>mission
                katkısı
              </span>
            </div>
            <section>
              <div className="cf-subheading">
                <h4>
                  <Award size={16} />
                  Başarımları
                </h4>
                {member.sample && <small>Örnek</small>}
              </div>
              {member.badges.length ? (
                <div className="cf-earned-badges">
                  {member.badges.map((b) => (
                    <div key={b.id}>
                      <BadgeDisc icon={b.icon} rarity={b.rarity} size="sm" />
                      <span>
                        <strong>{b.name}</strong>
                        <small>{b.missionTitle || b.description}</small>
                      </span>
                      <RarityPill rarity={b.rarity} />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="cf-muted">Henüz görünür bir rozet yok.</p>
              )}
              {showcase.length > 0 && <BadgeList badges={showcase} large />}
            </section>
            {member.titles.length > 0 && (
              <section>
                <h4>
                  <HeartHandshake size={16} />
                  Takım arkadaşlarından gelen unvanlar
                </h4>
                <div className="cf-title-list">
                  {member.titles.map((title) => (
                    <span key={title.category}>
                      <Sparkles size={13} />
                      <strong>{title.label}</strong>
                      <RarityPill rarity={title.rarity} />
                    </span>
                  ))}
                </div>
              </section>
            )}
            {member.awards.length > 0 && (
              <section>
                <h4>
                  <Trophy size={16} />
                  MVCubes
                </h4>
                <div className="cf-award-list">
                  {member.awards.map((a, i) => (
                    <span key={`${a.category}-${a.period}-${i}`}>
                      <Crown size={14} />
                      {a.label}
                      <small>{a.period}</small>
                    </span>
                  ))}
                </div>
              </section>
            )}
            <section>
              <h4>
                <Quote size={16} />
                Paylaşmayı seçtiği teşekkürler
              </h4>
              {member.quotes.length ? (
                member.quotes.map((q) => <PublicQuote key={q.id} quote={q} />)
              ) : (
                <p className="cf-muted">
                  Henüz paylaşılmış bir anonim teşekkür yok.
                </p>
              )}
              <p className="cf-privacy-hint">
                <ShieldCheck size={12} />
                Kimden geldiği gösterilmez. Özel feedback, mentor notu ve
                değerlendirme puanları burada yer almaz.
              </p>
            </section>
            {member.skills.length > 0 && (
              <div className="cf-skills">
                {member.skills.slice(0, 8).map((skill) => (
                  <span key={skill}>{skill}</span>
                ))}
              </div>
            )}
          </>
        )}
        {eligible && (
          <p className="cf-field-hint">
            Takdir gönderimi portalda kaydedilir ve feedback hakkından kullanır.
          </p>
        )}
        <footer className="cf-profile-actions">
          {!member.sample && member.cubeId && (
            <Link
              className="cf-button cf-button-light"
              to={`/cubes/${member.cubeId}`}
              onClick={onClose}
            >
              Portal profili <ArrowUpRight size={14} />
            </Link>
          )}
          {eligible && (
            <GiveFeedbackButton
              receiver={{
                id: member.cubeId!,
                name: member.name,
                avatarUrl: member.avatarUrl,
              }}
              variant="solid"
              label="Katkısını takdir et"
            />
          )}
        </footer>
      </div>
    </Dialog>
  );
}

function Thread({
  initialDraft,
  onRemember,
  topic,
  viewer,
  getMember,
  showcase,
  signature,
  quest,
  isFollowing,
  onFollow,
  onClose,
  onProfile,
  onChange,
  notify,
}: {
  initialDraft?: ThreadDraft;
  onRemember: (draft: ThreadDraft) => void;
  topic: ForumTopic;
  viewer: ForumMember;
  getMember: (id: string) => ForumMember;
  showcase: ForumBadge[];
  signature: string;
  quest?: ForumQuest;
  isFollowing: boolean;
  onFollow: () => void;
  onClose: () => void;
  onProfile: (member: ForumMember) => void;
  onChange: (topic: ForumTopic) => void;
  notify: (text: string) => void;
}) {
  const [reply, setReply] = useState(initialDraft?.reply || "");
  const [replyPage, setReplyPage] = useState(initialDraft?.replyPage || 1);
  const [editing, setEditing] = useState<string | null>(
    initialDraft?.editing || null,
  );
  const [editText, setEditText] = useState(initialDraft?.editText || "");
  const draftRef = useRef<ThreadDraft>({ reply, replyPage, editing, editText });
  draftRef.current = { reply, replyPage, editing, editText };
  useEffect(() => () => onRemember(draftRef.current), []);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [report, setReport] = useState<string | null>(null);
  const [reason, setReason] = useState("Saygısız veya incitici içerik");
  const replies = topic.replies;
  const pages = Math.max(1, Math.ceil(replies.length / 5));
  const posts: ForumPost[] = [
    {
      id: topic.id,
      authorId: topic.authorId,
      body: topic.body,
      createdAt: topic.createdAt,
      edited: topic.edited,
    },
    ...replies.slice((replyPage - 1) * 5, replyPage * 5),
  ];
  const saveEdit = (post: ForumPost) => {
    if (!editText.trim() || post.authorId !== viewer.id) return;
    if (post.id === topic.id)
      onChange({ ...topic, body: editText.trim(), edited: true });
    else
      onChange({
        ...topic,
        replies: topic.replies.map((r) =>
          r.id === post.id ? { ...r, body: editText.trim(), edited: true } : r,
        ),
      });
    setEditing(null);
  };
  return (
    <Dialog title="Konu ve yanıtlar" onClose={onClose} wide>
      <div className="cf-thread">
        <button className="cf-thread-back" onClick={onClose}>
          <ArrowLeft size={14} />
          Akışa dön
        </button>
        <div className="cf-thread-category">
          {CATEGORIES.find((c) => c.id === topic.categoryId)?.name}
          {topic.pinned && (
            <span>
              <Pin size={12} />
              Sabit konu
            </span>
          )}
          {quest && (
            <Link to="/quests">
              <Target size={12} />
              {quest.title}
            </Link>
          )}
        </div>
        <h3>{topic.title}</h3>
        <div className="cf-thread-toolbar">
          <span>
            <MessageCircle size={14} />
            {replies.filter((r) => !r.deleted).length} yanıt
          </span>
          <button className={isFollowing ? "is-active" : ""} onClick={onFollow}>
            <Bell size={14} />
            {isFollowing ? "Takip ediliyor" : "Takip et"}
          </button>
          <button
            onClick={() => {
              void navigator.clipboard.writeText(window.location.href).then(
                () => notify("Konu bağlantısı kopyalandı."),
                () => notify("Bağlantıyı adres çubuğundan kopyalayabilirsin."),
              );
            }}
          >
            <ArrowUpRight size={14} />
            Bağlantıyı kopyala
          </button>
        </div>
        {posts.map((post, i) => {
          const member = getMember(post.authorId);
          const badges =
            member.id === viewer.id ? showcase : member.badges.slice(0, 3);
          return (
            <article
              key={post.id}
              className={`cf-post ${post.deleted ? "is-deleted" : ""}`}
              style={stageStyle(member.stage)}
            >
              <aside className="cf-post-author">
                <button onClick={() => onProfile(member)}>
                  <Avatar member={member} size="lg" />
                  <strong>{member.name}</strong>
                </button>
                <span className="cf-author-number">
                  {member.cubeNumber
                    ? `#${member.cubeNumber}`
                    : member.sample
                      ? "Örnek profil"
                      : "Iceberg X"}
                </span>
                <StagePill member={member} />
                {member.founding && (
                  <span className="cf-founding">
                    <Crown size={11} />
                    Founding Cube
                  </span>
                )}
                <BadgeList badges={badges} />
                {member.titles[0] && (
                  <span className="cf-post-peer-title">
                    <HeartHandshake size={12} />
                    {member.titles[0].label}
                  </span>
                )}
                {member.awards[0] && (
                  <span className="cf-post-award">
                    <Trophy size={12} />
                    MVCube · {member.awards[0].period}
                  </span>
                )}
                <button
                  className="cf-author-details"
                  onClick={() => onProfile(member)}
                >
                  Başarımları ve teşekkürleri <ChevronRight size={12} />
                </button>
              </aside>
              <div className="cf-post-content">
                <div className="cf-post-date">
                  <time dateTime={post.createdAt}>
                    {date(post.createdAt)}
                    {post.edited ? " · düzenlendi" : ""}
                  </time>
                  <span>#{i ? (replyPage - 1) * 5 + i + 1 : 1}</span>
                </div>
                {post.deleted ? (
                  <p className="cf-deleted-message">
                    Bu yanıt yazarı tarafından kaldırıldı.
                  </p>
                ) : editing === post.id ? (
                  <div className="cf-inline-edit">
                    <label htmlFor="cf-edit-body">Mesajı düzenle</label>
                    <MarkdownEditor
                      id="cf-edit-body"
                      value={editText}
                      onChange={(value) =>
                        setEditText(
                          value.slice(0, post.id === topic.id ? 10000 : 5000),
                        )
                      }
                      rows={5}
                      required
                    />
                    <div>
                      <button
                        className="cf-button cf-button-light"
                        onClick={() => setEditing(null)}
                      >
                        Vazgeç
                      </button>
                      <button
                        className="cf-button cf-button-primary"
                        disabled={!editText.trim()}
                        onClick={() => saveEdit(post)}
                      >
                        Kaydet
                      </button>
                    </div>
                  </div>
                ) : (
                  <Markdown text={post.body} />
                )}
                {member.id === viewer.id && signature && !post.deleted && (
                  <div className="cf-signature">
                    <span>İMZA</span>
                    <p>{signature}</p>
                  </div>
                )}
                {!post.deleted && (
                  <div className="cf-post-actions">
                    <button
                      onClick={() => {
                        setReply(
                          (prev) =>
                            `${prev}${prev ? "\n" : ""}${member.cubeNumber ? `@cube-${member.cubeNumber}` : member.name} `,
                        );
                        document.getElementById("cf-reply-body")?.focus();
                      }}
                    >
                      <MessageCircle size={13} />
                      Yanıtla
                    </button>
                    {post.authorId === viewer.id && (
                      <>
                        <button
                          onClick={() => {
                            setEditing(post.id);
                            setEditText(post.body);
                          }}
                        >
                          Düzenle
                        </button>
                        <button onClick={() => setConfirm(post.id)}>
                          Kaldır
                        </button>
                      </>
                    )}
                    <button onClick={() => setReport(post.id)}>
                      <Flag size={12} />
                      Bildir
                    </button>
                  </div>
                )}
              </div>
            </article>
          );
        })}
        {!replies.length && (
          <div className="cf-thread-empty">
            İlk yanıt, konuşmanın yönünü değiştirebilir.
          </div>
        )}
        <Pagination page={replyPage} pages={pages} onChange={setReplyPage} />
        <form
          className="cf-reply-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!reply.trim()) return;
            onChange({
              ...topic,
              replies: [
                ...topic.replies,
                {
                  id: crypto.randomUUID(),
                  authorId: viewer.id,
                  body: reply.trim(),
                  createdAt: new Date().toISOString(),
                },
              ],
            });
            setReply("");
            setReplyPage(Math.ceil((topic.replies.length + 1) / 5));
            notify("Yanıtın yerel önizlemeye eklendi.");
          }}
        >
          <div className="cf-reply-heading">
            <Avatar member={viewer} size="sm" />
            <span>
              <strong>Konuşmaya bir iz bırak.</strong>
              <small>{STAGES[viewer.stage].label} olarak yanıtlıyorsun.</small>
            </span>
            <StagePill member={viewer} />
          </div>
          <label htmlFor="cf-reply-body" className="cf-sr-only">
            Yanıtın
          </label>
          <MarkdownEditor
            id="cf-reply-body"
            value={reply}
            onChange={(value) => setReply(value.slice(0, 5000))}
            rows={4}
            required
            placeholder="Bir çözüm, iyi bir soru veya bir teşekkür…"
          />
          <footer>
            <small>
              Bu yanıt bu tarayıcıda saklanır. @mention bildirim göndermez.
            </small>
            <button
              className="cf-button cf-button-primary"
              disabled={!reply.trim()}
            >
              <Send size={15} />
              Yanıtı paylaş
            </button>
          </footer>
        </form>
        {confirm && (
          <div className="cf-confirm" role="alert">
            <strong>
              {confirm === topic.id
                ? "Konu bu önizlemeden kaldırılsın mı?"
                : "Bu yanıt kaldırılsın mı?"}
            </strong>
            <span>Portal kayıtları etkilenmez.</span>
            <div>
              <button
                className="cf-button cf-button-light"
                onClick={() => setConfirm(null)}
              >
                Vazgeç
              </button>
              <button
                className="cf-button cf-button-danger"
                onClick={() => {
                  if (confirm === topic.id) {
                    onChange({ ...topic, deleted: true });
                    onClose();
                  } else
                    onChange({
                      ...topic,
                      replies: topic.replies.map((p) =>
                        p.id === confirm && p.authorId === viewer.id
                          ? { ...p, deleted: true, body: "" }
                          : p,
                      ),
                    });
                  setConfirm(null);
                }}
              >
                Kaldır
              </button>
            </div>
          </div>
        )}
        {report && (
          <div
            className="cf-report"
            role="region"
            aria-label="Yerel bildirim önizlemesi"
          >
            <h4>Topluluğu birlikte koruyalım.</h4>
            <label>
              Bildirme nedeni
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              >
                {[
                  "Saygısız veya incitici içerik",
                  "Spam veya reklam",
                  "Yanlış kategori",
                  "Başka bir sorun",
                ].map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <p>Bu tasarım önizlemesidir. Rapor moderatöre gönderilmez.</p>
            <div>
              <button
                className="cf-button cf-button-light"
                onClick={() => setReport(null)}
              >
                Vazgeç
              </button>
              <button
                className="cf-button cf-button-primary"
                onClick={() => {
                  setReport(null);
                  notify(
                    "Rapor akışı denendi; moderatöre bildirim gönderilmedi.",
                  );
                }}
              >
                Akışı dene
              </button>
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}
