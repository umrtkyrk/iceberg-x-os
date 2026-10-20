// Adapted from umrtkyrk/mock-forum. Browser-only design preview; not the forum API.
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowDownWideNarrow, ArrowLeft, ArrowRight, ArrowUpRight, Bell, Bookmark, Check, CheckCheck, ChevronDown, ChevronLeft, ChevronRight, Code2, Coffee, Compass, Copy, ExternalLink, Eye, Flag, Flame, Hash, HeartHandshake, Home, Layers, LifeBuoy, Lightbulb, LockKeyhole, Megaphone, Menu, MessageCircle, MessagesSquare, Pin, Plus, Rocket, Search, Send, Settings2, ShieldCheck, Sparkles, Target, Trophy, Users, X, Zap } from 'lucide-react';
import { categories, badges as sampleBadges, quests, members, initialTopics, initialNotifications } from './demo-data.js';
import ReactMarkdown from 'react-markdown';
import { MarkdownEditor } from '../../components/MarkdownEditor';
import { getBadgeIcon } from '../../utils/badgeIcons';
import { sanitisePreferences, parseStored, canStartTopic } from './previewModel';
const DesignContext = createContext(null);
const useDesign = () => useContext(DesignContext);

const icons = { Megaphone, LifeBuoy, Layers, Lightbulb, Coffee, Rocket, Code2, HeartHandshake, Zap, Compass, Sparkles, Trophy, Target, ShieldCheck };
const roles = { Cube: { color: '#94a3b8', label: 'Cube' }, 'Senior Cube Candidate': { color: '#38bdf8', label: 'Senior Cube Candidate' }, 'Senior Cube': { color: '#a78bfa', label: 'Senior Cube' }, Iceberger: { color: '#67e8f9', label: 'Iceberger' }, Mentor: { color: '#fbbf24', label: 'Mentor' }, Admin: { color: '#e6007e', label: 'Admin' }, Alumni: { color: '#f59e0b', label: 'Alumni' }, 'Former Cube': { color: '#94a3b8', label: 'Former Cube' } };
const now = () => new Date().toISOString();
const formatCount = n => n >= 1000 ? `${(n / 1000).toFixed(1).replace('.', ',')}b` : n;
const byId = (items, id) => items.find(item => item.id === id);
function relativeTime(value) {
  const minutes = Math.floor(Math.max(0, Date.now() - new Date(value)) / 60000);
  if (minutes < 1) return 'Şimdi';
  if (minutes < 60) return `${minutes} dk önce`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)} sa önce`;
  return `${Math.floor(minutes / 1440)} gün önce`;
}

function useStored(key, initial) {
  const [value, setValue] = useState(() => {
    try { return parseStored(localStorage.getItem(key), initial); }
    catch { return initial; }
  });
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Private browsing can disable storage. */ } }, [key, value]);
  return [value, setValue];
}

function Icon({ name, ...props }) { const Component = icons[name] || getBadgeIcon(name); return <Component {...props} />; }
function Brand() { return <div className="brand"><img src="/images/xicon.jpg" alt="Iceberg X" width="40" height="40" /><strong>ICEBERG X</strong></div>; }
function Avatar({ member, size = 'md', status = false }) {
  const person = member || { name: 'Bilinmeyen Cube', role: 'Cube', badgeIds: [] };
  return <span className={`avatar avatar-${size}`} title={`${person.name} · ${person.role}`} style={{ '--ring': roles[person.role]?.color || '#f5b928', '--avatar-bg': person.color || '#f9cde4' }}>
    <span className="avatar-face">{person.avatar && <img src={person.avatar} alt="" onError={e => { e.currentTarget.style.display = 'none'; }} />}{person.initials || person.name?.split(' ').slice(0, 2).map(n => n[0]).join('')}</span>{status && <i className="online-dot" />}
  </span>;
}
function Badge({ id, large = false }) {
  const { earnedBadges } = useDesign(); const badge = byId([...earnedBadges, ...sampleBadges], id);
  if (!badge) return null;
  return <span className={`badge-medal ${large ? 'large' : ''}`} title={badge.name} style={{ '--badge-color': badge.color }}><Icon name={badge.icon} size={large ? 19 : 12} strokeWidth={1.8} /></span>;
}
function BadgeRow({ ids, large = false }) { return <div className="badge-row">{ids?.slice(0, 3).map(id => <Badge key={id} id={id} large={large} />)}</div>; }
function Modal({ title, subtitle, onClose, children, wide = false }) {
  const ref = useRef(null);
  useEffect(() => {
    const before = document.activeElement;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current?.focus();
    const listener = e => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab') {
        const nodes = ref.current?.querySelectorAll('button:not([disabled]), input, select, textarea, [tabindex="0"]');
        if (!nodes?.length) return;
        const first = nodes[0], last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', listener);
    return () => { document.body.style.overflow = oldOverflow; document.removeEventListener('keydown', listener); before?.focus(); };
  }, [onClose]);
  return <div className="modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}><section ref={ref} tabIndex={-1} className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
    <header className="modal-header"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button className="icon-button" aria-label="Kapat" onClick={onClose}><X size={21} /></button></header>{children}
  </section></div>;
}
function Markdown({ text }) { return <div className="markdown"><ReactMarkdown skipHtml components={{ img: () => null }}>{text || ''}</ReactMarkdown></div>; }

export default function ForumPreview(props) { return <DesignContext.Provider value={props}><ForumDesign key={props.viewer.id} /></DesignContext.Provider>; }
function ForumDesign() {
  const { viewer, earnedBadges } = useDesign();
  const currentUserId = viewer.id;
  const storageKey = 'cube-forum-preview-v2:' + currentUserId + ':';
  const [topics, setTopics] = useStored(storageKey + 'topics', initialTopics);
  const [saved, setSaved] = useStored(storageKey + 'saved', []);
  const [following, setFollowing] = useStored(storageKey + 'following', []);
  const [preferences, setPreferences] = useStored(storageKey + 'preferences', {badgeIds: [], signature: ''});
  const safePreferences = sanitisePreferences(preferences, earnedBadges.map(b => b.id));
  const profile = { ...viewer, ...safePreferences };
  const setProfile = next => setPreferences(sanitisePreferences(next, earnedBadges.map(b => b.id)));
  const [notifications, setNotifications] = useStored(storageKey + 'notifications', initialNotifications);
  const [activePage, setActivePage] = useState('feed');
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeQuest, setActiveQuest] = useState(null);
  const [sort, setSort] = useState('latest');
  const [query, setQuery] = useState('');
  const [mobileMenu, setMobileMenu] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  useEffect(() => { if (!mobileMenu) return; const close = e => { if (e.key === 'Escape') setMobileMenu(false); }; document.addEventListener('keydown', close); return () => document.removeEventListener('keydown', close); }, [mobileMenu]);
  const [modal, setModal] = useState(null);
  const [selectedTopicId, setSelectedTopicId] = useState(null);
  const [toast, setToast] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [requestedTopicId] = useState(() => new URLSearchParams(location.search).get('konu'));
  useEffect(() => {
    if (!requestedTopicId) return;
    if (topics.some(t => t.id === requestedTopicId)) { setSelectedTopicId(requestedTopicId); setModal('topic'); }
    else setToast('Bu konu bu tarayıcıda bulunamadı. Yeni demo konuları yalnızca oluşturuldukları tarayıcıda saklanır.');
  }, [requestedTopicId]);
  const notify = message => setToast(message);
  useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(''), 3500); return () => clearTimeout(id); }, [toast]);
  const getMember = id => id === currentUserId ? profile : byId(members, id) || { id, name: 'Bilinmeyen Cube', role: 'Cube', badgeIds: [], signature: '' };
  const selectedTopic = byId(topics, selectedTopicId);
  const unreadNotifications = notifications.filter(n => !n.read).length;
  const filtered = useMemo(() => {
    let list = topics.filter(topic => {
      if (activeCategory !== 'all' && topic.categoryId !== activeCategory) return false;
      if (activeQuest && (activeQuest === 'all' ? !topic.questId : topic.questId !== activeQuest)) return false;
      if (activePage === 'saved' && !saved.includes(topic.id)) return false;
      if (activePage === 'following' && !following.includes(topic.id)) return false;
      if (sort === 'unread' && !topic.unread) return false;
      const content = `${topic.title} ${topic.body} ${topic.tags.join(' ')}`.toLocaleLowerCase('tr');
      return content.includes(query.toLocaleLowerCase('tr'));
    });
    return [...list].sort((a, b) => Number(b.pinned) - Number(a.pinned) || (sort === 'popular' ? b.views - a.views : new Date(b.createdAt) - new Date(a.createdAt)));
  }, [topics, activeCategory, activePage, activeQuest, query, sort, saved, following]);
  const navigate = (page, category = 'all') => { setActivePage(page); setActiveCategory(category); setActiveQuest(null); setShowAll(false); setMobileMenu(false); };
  const openTopic = topic => { setSelectedTopicId(topic.id); setTopics(items => items.map(t => t.id === topic.id ? { ...t, unread: false } : t)); setModal('topic'); };
  const toggleSave = id => { setSaved(list => list.includes(id) ? list.filter(item => item !== id) : [...list, id]); };
  const toggleFollow = id => { setFollowing(list => list.includes(id) ? list.filter(item => item !== id) : [...list, id]); };
  const pageTitle = activePage === 'saved' ? 'Kaydedilenler' : activePage === 'following' ? 'Takip ettiklerim' : activePage === 'categories' ? 'Kategoriler' : activeCategory !== 'all' ? byId(categories, activeCategory)?.name : 'Forum';
  const activeFilterCount = activeCategory !== 'all' || activeQuest || query || activePage !== 'feed';

  return <div className="cube-forum app-shell">
    <div className="forum-preview-notice" role="note"><strong>Tasarım önizlemesi</strong><span>Örnek konular. Yeni konu, yanıt ve tercihler yalnızca bu tarayıcıda saklanır; diğer Cubelara gönderilmez.</span></div>
    <div className="forum-toolbar">
      <button className="icon-button forum-menu-toggle" aria-label="Forum menüsünü aç" aria-expanded={mobileMenu} onClick={() => setMobileMenu(!mobileMenu)}><Menu size={21}/></button>
      <span className="portal-crumb">Community <ChevronRight size={14}/> <strong>Cube Forum</strong></span>
      <label className="global-search"><Search size={17}/><input aria-label="Forumda ara" placeholder="Konu, soru veya fikir ara…" value={query} onChange={e => { setQuery(e.target.value); setActivePage('feed'); setActiveCategory('all'); setActiveQuest(null); setShowAll(true); }}/></label>
      <div className="notification-wrap"><button className="icon-button notification-button" aria-label="Örnek forum bildirimleri" aria-expanded={notificationOpen} onClick={() => setNotificationOpen(!notificationOpen)}><Bell size={20}/>{unreadNotifications > 0 && <i/>}</button>{notificationOpen && <div className="notification-panel"><div className="panel-title"><h3>Örnek bildirimler</h3><button className="text-button" onClick={() => setNotifications(items => items.map(n => ({...n,read:true})))}>Tümünü oku</button></div>{notifications.map(n => <button key={n.id} className={'notification-item ' + (!n.read ? 'unread' : '')} onClick={() => {setNotifications(items => items.map(item => item.id === n.id ? {...item,read:true} : item)); setNotificationOpen(false); const topic = byId(topics,n.topicId); if(topic) openTopic(topic);}}><MessageCircle size={17}/><span><strong>{n.title}</strong><small>{n.body}</small></span></button>)}</div>}</div>
      <button className="user-avatar-button" aria-label="Forum profilimi düzenle" onClick={() => setModal('profile')}><Avatar member={profile} size="sm"/></button>
    </div>

    {mobileMenu && <div className="sidebar-backdrop" onClick={() => setMobileMenu(false)} />}
    <aside className={`sidebar ${mobileMenu ? 'sidebar-open' : ''}`}>
      <div className="workspace-label"><span className="workspace-icon"><MessagesSquare size={19} /></span><div><strong>Cube Forum</strong><small>Birlikte daha ileri.</small></div><button className="icon-button forum-drawer-close" aria-label="Forum menüsünü kapat" onClick={() => setMobileMenu(false)}><X size={18}/></button></div>
      <nav className="primary-nav" aria-label="Ana menü">
        <button className={activePage === 'feed' && activeCategory === 'all' ? 'active' : ''} onClick={() => navigate('feed')}><Home size={18} />Topluluk akışı<span className="nav-count">{topics.filter(t => t.unread).length}</span></button>
        <button className={activePage === 'categories' ? 'active' : ''} onClick={() => navigate('categories')}><Layers size={18} />Kategoriler</button>
        <button className={activePage === 'following' ? 'active' : ''} onClick={() => navigate('following')}><MessageCircle size={18} />Takip ettiklerim{following.length > 0 && <span className="nav-count">{following.length}</span>}</button>
        <button className={activePage === 'saved' ? 'active' : ''} onClick={() => navigate('saved')}><Bookmark size={18} />Kaydedilenler{saved.length > 0 && <span className="nav-count">{saved.length}</span>}</button>
      </nav>
      <div className="nav-section-label">KONUŞMA ALANLARI <span>05</span></div>
      <nav className="category-nav" aria-label="Kategoriler">{categories.map(category => <button key={category.id} className={activeCategory === category.id ? 'active' : ''} onClick={() => navigate('feed', category.id)}><span className="category-dot" style={{ background: category.color }} />{category.name}<span>{topics.filter(t => t.categoryId === category.id).length}</span></button>)}</nav>
      <div className="nav-section-label quest-section-label">BİRLİKTE ÜRET <ArrowUpRight size={13} /></div>
      <button className={`quest-nav ${activeQuest ? 'active' : ''}`} onClick={() => { navigate('feed'); setActiveQuest('all'); }}><Target size={18} />Quest tartışmaları<span className="quest-counter">{quests.length}</span></button>
      <div className="sidebar-bottom"><div className="community-note"><span className="note-icon"><Sparkles size={19} /></span><strong>Bir cevap, çok şey değiştirir.</strong><p>Bildiklerini paylaş.<br />Bir Cube'un yolunu aydınlat.</p><button onClick={() => navigate('feed', 'help')}>Bir Cube'a destek ol <ArrowUpRight size={15} /></button></div><button className="sidebar-profile" onClick={() => setModal('profile')}><Avatar member={profile} size="sm" status /><span><strong>{profile.name.split(' ').slice(0, 2).join(' ')}</strong><small>{profile.role}</small></span><Settings2 size={16} /></button><div className="sidebar-footer">ICEBERG X COMMUNITY <span>© 2026</span></div></div>
    </aside>

    <main className="main-content">
      <div className="page-heading"><div className="page-title-row"><h1>{pageTitle}<span className="heading-dot">.</span></h1><span className="community-status"><i /> Tasarım alanı</span></div><button className="button button-dark new-topic" onClick={() => setModal('create')}><Plus size={18} />Yeni konu aç</button></div>
      {activePage === 'feed' && activeCategory === 'all' && !activeQuest && !query && <section className="welcome-banner"><div className="banner-copy"><span className="eyebrow"><span /> FİKİRLERİN BULUŞMA NOKTASI</span><h2>Birlikte öğren.<br />Paylaş. <span>İz bırak.</span></h2><p>Bir soruyla başlar, bir topluluğa dönüşür.<br />Burası senin sesin, senin alanın.</p><button className="banner-link" onClick={() => setModal('guide')}>Topluluğu keşfet <ArrowUpRight size={16} /></button></div><div className="banner-art" aria-hidden="true"><svg viewBox="0 0 420 270"><defs><pattern id="dots" x="0" y="0" width="18" height="18" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="0.7" fill="#aab2c1" opacity=".22" /></pattern><linearGradient id="cube-face" x1="0" x2="1" y2="1"><stop stopColor="#fff0f7"/><stop offset="1" stopColor="#f8a6d1"/></linearGradient></defs><rect width="420" height="270" fill="url(#dots)"/><ellipse cx="238" cy="150" rx="154" ry="66" transform="rotate(-27 238 150)" fill="none" stroke="#d9afc8" strokeOpacity=".33"/><ellipse cx="238" cy="150" rx="113" ry="113" fill="none" stroke="#d9afc8" strokeOpacity=".14"/><path d="m211 56 88 50-88 51-88-51Z" fill="url(#cube-face)"/><path d="m123 106 88 51v98l-88-51Z" fill="#ef69af"/><path d="m211 157 88-51v98l-88 51Z" fill="#d10a72"/><path d="m211 56 88 50-88 51-88-51Zm0 101v98m-88-149v98l88 51 88-51v-98" fill="none" stroke="#ffe1f0" strokeOpacity=".65"/><path d="m211 76 55 31-55 32-55-32Z" fill="none" stroke="#b23b7d" strokeOpacity=".45"/><path d="m174 98 24 14 39-23" fill="none" stroke="#a81265" strokeWidth="2"/><path d="m314 43 7-19 6 19 19 6-19 7-6 19-7-19-19-7Z" fill="#ed0c86"/><circle cx="100" cy="173" r="5" fill="#ed0c86"/><circle cx="342" cy="172" r="3" fill="#f5b928"/><path d="m106 60 4-10 4 10 10 4-10 4-4 10-4-10-10-4Z" fill="#f1a5d0"/></svg><span className="art-label art-label-top"><Code2 size={13} /> build together</span><span className="art-label art-label-bottom"><Sparkles size={12} /> grow together</span></div><span className="banner-coordinate">41°00′ N / 29°00′ E · BİRLİKTE YUKARI</span></section>}

      <div className="content-grid"><div className="feed-column">
        {activePage === 'categories' ? <section className="category-directory"><div className="section-heading"><h2>Her konuşmanın bir yeri var.</h2><p>Sorunu sor, ürettiğini paylaş veya biraz mola ver.</p></div>{categories.map(category => <button key={category.id} className="directory-card" onClick={() => navigate('feed', category.id)}><span className="category-icon" style={{ '--category-color': category.color }}><Icon name={category.icon} size={23} /></span><div><h3>{category.name}</h3><p>{category.description}</p><small>{topics.filter(t => t.categoryId === category.id).length} konu · {topics.filter(t => t.categoryId === category.id).reduce((sum, t) => sum + t.replies.length, 0)} yanıt</small></div><ChevronRight size={20} /></button>)}</section> : <>
          <div className="feed-topline"><h2>{activePage === 'saved' ? 'Dönüp bakmaya değer' : activePage === 'following' ? 'Sohbeti kaçırma' : activeCategory !== 'all' ? byId(categories, activeCategory)?.description : activeQuest ? 'Quest etrafında buluşalım' : 'Toplulukta neler oluyor?'}<span>{filtered.length}</span></h2><button className="subtle-icon" aria-label="Sıralamayı değiştir" onClick={() => setSort(sort === 'popular' ? 'latest' : 'popular')}><ArrowDownWideNarrow size={17} /></button></div>
          <div className="feed-tabs" role="tablist" aria-label="Konu sıralaması"><button role="tab" aria-selected={sort === 'latest'} className={sort === 'latest' ? 'active' : ''} onClick={() => setSort('latest')}><Sparkles size={15} />Son konular</button><button role="tab" aria-selected={sort === 'popular'} className={sort === 'popular' ? 'active' : ''} onClick={() => setSort('popular')}><Flame size={16} />Popüler</button><button role="tab" aria-selected={sort === 'unread'} className={sort === 'unread' ? 'active' : ''} onClick={() => setSort('unread')}><span className="tab-unread-dot" />Okunmamış</button><span className="tabs-spacer" /><span className="feed-view-label">SON AKTİVİTE</span></div>
          <div className="filter-bar"><button className={activeCategory === 'all' ? 'filter-chip active' : 'filter-chip'} onClick={() => setActiveCategory('all')}>Tümü</button>{categories.map(category => <button key={category.id} className={`filter-chip ${activeCategory === category.id ? 'active' : ''}`} onClick={() => setActiveCategory(category.id)}><span style={{ background: category.color }} />{category.name}</button>)}</div>
          {(query || activeQuest) && <div className="active-filter"><Search size={14} /><span>{query ? `“${query}” için ${filtered.length} sonuç` : activeQuest === 'all' ? 'Quest bağlantılı bütün konular' : `Quest: ${byId(quests, activeQuest)?.title}`}</span><button aria-label="Filtreyi kaldır" onClick={() => { setQuery(''); setActiveQuest(null); }}><X size={15} /></button></div>}
          <div className="topic-list">{(showAll ? filtered : filtered.slice(0, 6)).map(topic => {
            const author = getMember(topic.authorId), category = byId(categories, topic.categoryId), quest = byId(quests, topic.questId);
            return <article key={topic.id} className={`topic-card ${topic.pinned ? 'topic-pinned' : ''}`}>
              <div className="topic-avatar"><Avatar member={author} /><BadgeRow ids={author.badgeIds} /></div>
              <div className="topic-content"><div className="topic-meta"><span className="topic-category" style={{ color: category?.color }}><Icon name={category?.icon} size={12} />{category?.name}</span>{topic.pinned && <span className="pinned-tag"><Pin size={11} />Sabitlendi</span>}{topic.unread && !topic.pinned && <span className="new-topic-dot" title="Yeni konu" />}<span className="topic-time">{relativeTime(topic.createdAt)}</span></div><button className="topic-title" onClick={() => openTopic(topic)}>{topic.title}</button><p className="topic-excerpt">{topic.body.replace(/\*\*|`/g, '')}</p><div className="topic-bottom"><span className="topic-author">{author.name}</span><span className="meta-dot">·</span><span className="author-role" style={{ color: roles[author.role]?.color }}>{author.role}</span>{quest && <button className="quest-tag" onClick={() => { navigate('feed'); setActiveQuest(quest.id); }}><Target size={12} />{quest.title}</button>}{topic.categoryId === 'lounge' && <span className="social-tag"># bir-çay-molası</span>}</div></div>
              <div className="topic-stats"><button className={`save-topic ${saved.includes(topic.id) ? 'is-saved' : ''}`} aria-label={saved.includes(topic.id) ? 'Kaydı kaldır' : 'Konuyu kaydet'} onClick={() => toggleSave(topic.id)}><Bookmark size={16} fill={saved.includes(topic.id) ? 'currentColor' : 'none'} /></button><button className="reply-count" aria-label={`${topic.replies.length} yanıtı oku`} onClick={() => openTopic(topic)}><MessageCircle size={16} /><strong>{topic.replies.length}</strong></button><span className="view-count"><Eye size={13} />{formatCount(topic.views)}</span></div>
            </article>;
          })}</div>
          {filtered.length === 0 && <div className="empty-state"><MessagesSquare size={35} /><h3>{activePage === 'saved' ? 'İyi fikirleri burada biriktir.' : activePage === 'following' ? 'Sohbete yakın kal.' : 'Burada henüz bir konuşma yok.'}</h3><p>{activePage === 'saved' ? 'Konulardaki yer imi simgesine dokunarak ilk konunu kaydet.' : activePage === 'following' ? 'Bir konuyu açıp “Takip et” diyerek gelişmelerden haberdar ol.' : 'Başka bir arama yapabilir veya ilk konuyu sen açabilirsin.'}</p><button className="button button-outline" onClick={() => activeFilterCount ? (navigate('feed'), setQuery('')) : setModal('create')}>{activeFilterCount ? 'Tüm konuları keşfet' : 'İlk konuyu aç'}<ArrowRight size={15} /></button></div>}
          {filtered.length > 6 && !showAll && <button className="load-more" onClick={() => setShowAll(true)}>Daha fazla konu keşfet <ArrowDown size={15} /><span>{filtered.length - 6} konu daha</span></button>}
          <div className="feed-footer"><span className="small-cube">◇</span> Küçük bir katkı. Büyük bir etki. <span>İyi ki buradasın.</span></div>
        </>}
      </div>

      <aside className="right-column">
        <section className="profile-card"><div className="card-eyebrow">SENİN CUBE ALANIN<button className="subtle-icon" aria-label="Rozetleri düzenle" onClick={() => setModal('profile')}><Settings2 size={15} /></button></div><div className="profile-summary"><Avatar member={profile} size="lg" status /><div><h3>{profile.name.split(' ').slice(0, 2).join(' ')}</h3><span className="role-label" style={{ color: roles[profile.role]?.color }}><span />{profile.role}</span><small>@{profile.username}</small></div></div><div className="profile-badges"><BadgeRow ids={profile.badgeIds} large /><button onClick={() => setModal('profile')}>Rozetlerini düzenle <ChevronRight size={12} /></button></div><div className="profile-stats"><div><strong>{topics.filter(t => t.authorId === currentUserId).length}</strong><span>Konu</span></div><div><strong>{topics.reduce((sum,t) => sum + t.replies.filter(r => r.authorId === currentUserId).length,0)}</strong><span>Katkı</span></div><div><strong>{earnedBadges.length}</strong><span>Rozet</span></div></div><p className="next-role">Aşaman ve kazandığın rozetler portal profilinden gelir.</p></section>
        <section className="quest-card"><div className="card-eyebrow"><span><Target size={15} /> QUEST RADARI</span><span className="live-tiny">ÖRNEK</span></div><div className="quest-visual"><span className="quest-orbit" /><Layers size={29} strokeWidth={1.3} /><span className="quest-star">✦</span></div><h3>Birlikte inşa ediyoruz.</h3><p>Bir quest seç, fikrini paylaş.<br />Bir sonraki adımı birlikte atalım.</p><button onClick={() => { navigate('feed'); setActiveQuest(quests[0].id); }}><span className="quest-mini-icon"><Code2 size={17} /></span><span><strong>{quests[0].title}</strong><small>DEVAM EDEN QUEST</small></span><ArrowUpRight size={18} /></button><div className="quest-card-footer"><span className="mini-avatar-stack">{members.slice(0, 3).map(m => <Avatar key={m.id} member={m} size="xs" />)}</span><span><strong>12 Cube</strong> bu quest'i konuşuyor</span></div></section>
        <section className="community-card"><div className="card-eyebrow">ÖRNEK TOPLULUK PROFİLLERİ<Trophy size={15} /></div>{members.filter(m => m.id !== currentUserId).slice(0, 3).map((member, index) => <div className="leader-row" key={member.id}><span className={`leader-rank rank-${index}`}>0{index + 1}</span><Avatar member={member} size="sm" /><div><strong>{member.name}</strong><span>{index === 0 ? 'Birlikte çözmenin ustası' : index === 1 ? 'Paylaşınca çoğalır' : 'Her fikre bir kıvılcım'}</span></div></div>)}<button className="community-link" onClick={() => setModal('community')}>Toplulukla tanış <ArrowUpRight size={14} /></button></section>
        <div className="community-presence"><span className="presence-dot" /><span><strong>Örnek Cube profilleri</strong></span><span className="presence-faces">{members.slice(0, 3).map(m => <Avatar key={m.id} member={m} size="xs" />)}</span></div><div className="right-footer"><button onClick={() => setModal('guide')}>Topluluk rehberi</button><span>·</span><button onClick={() => setModal('about')}>Forum hakkında</button><p>Bir Iceberg X topluluğu. Birlikte, daha ileri. ↗</p></div>
      </aside></div>
    </main>

    {modal === 'create' && <CreateTopic portalRole={viewer.portalRole} categories={categories} quests={quests} defaultCategory={activeCategory} onClose={() => setModal(null)} onCreate={data => { const topic = { ...data, id: `new-${Date.now()}`, authorId: currentUserId, createdAt: now(), replies: [], views: 1, unread: false, pinned: false, tags: [] }; setTopics(items => [topic, ...items]); navigate('feed'); setSort('latest'); setModal(null); notify('Konu paylaşıldı. Sohbet şimdi başlıyor!'); }} />}
    {modal === 'profile' && <ProfileEditor profile={profile} onClose={() => setModal(null)} onSave={next => { setProfile(next); setModal(null); notify('Profilin ve vitrin rozetlerin güncellendi.'); }} />}
    {modal === 'topic' && selectedTopic && <TopicDetail topic={selectedTopic} getMember={getMember} profile={profile} isSaved={saved.includes(selectedTopic.id)} isFollowing={following.includes(selectedTopic.id)} onSave={() => toggleSave(selectedTopic.id)} onFollow={() => toggleFollow(selectedTopic.id)} onClose={() => setModal(null)} onReply={body => { setTopics(list => list.map(t => t.id === selectedTopic.id ? { ...t, replies: [...t.replies, { id: `reply-${Date.now()}`, authorId: currentUserId, body, createdAt: now() }] } : t)); notify('Yanıtın sohbete eklendi.'); }} onEdit={body => setTopics(list => list.map(t => t.id === selectedTopic.id ? { ...t, body, edited: true } : t))} onDelete={() => { setTopics(list => list.filter(t => t.id !== selectedTopic.id)); setModal(null); notify('Konun kaldırıldı.'); }} onReplyEdit={(id, body) => setTopics(list => list.map(t => t.id === selectedTopic.id ? { ...t, replies: t.replies.map(r => r.id === id ? { ...r, body, edited: true } : r) } : t))} onReplyDelete={id => setTopics(list => list.map(t => t.id === selectedTopic.id ? { ...t, replies: t.replies.filter(r => r.id !== id) } : t))} onReport={() => { setModal('report'); }} notify={notify} />}
    {modal === 'report' && <ReportDialog onClose={() => setModal('topic')} onSubmit={() => { setModal('topic'); notify('Demo bildirimi kaydedildi. Gerçek bir rapor gönderilmedi.'); }} />}
    {modal === 'guide' && <Modal title="Birlikte daha iyi bir topluluk." subtitle="Cube Forum'a hoş geldin." onClose={() => setModal(null)}><div className="guide-content"><span className="guide-hero"><HeartHandshake size={32} /></span><p>Burası bildiklerini paylaşmak, takıldığın yerde destek almak ve diğer Cubelarla tanışmak için ortak alanımız.</p>{[{ icon: 'LifeBuoy', title: 'Soru sormaktan çekinme.', text: 'Ne denediğini anlat, bağlam ver. Birlikte çözüm bulmak daha kolay.' }, { icon: 'HeartHandshake', title: 'Saygı ve merakla yaklaş.', text: 'Fikirlere odaklan. Farklı deneyimler hepimizi ileri taşır.' }, { icon: 'Coffee', title: 'Biraz da mola ver.', text: 'Kahve Molası iş dışı sohbetler, öneriler ve tanışmalar için burada.' }].map(item => <div className="guide-row" key={item.title}><Icon name={item.icon} size={21} /><div><h3>{item.title}</h3><p>{item.text}</p></div></div>)}<button className="button button-dark full-width" onClick={() => { setModal(null); navigate('categories'); }}>Alanları keşfet <ArrowRight size={16} /></button></div></Modal>}
    {modal === 'community' && <Modal title="Aynı yolun Cubeları." subtitle="Her çerçeve bir yolculuk, her rozet bir katkı." onClose={() => setModal(null)}><div className="members-list">{members.map(member => <div className="member-card" key={member.id}><Avatar member={getMember(member.id)} size="lg" /><div><h3>{member.name}</h3><p style={{ color: roles[getMember(member.id).role]?.color }}>{getMember(member.id).role}</p><BadgeRow ids={getMember(member.id).badgeIds} /></div></div>)}</div><div className="role-legend">{Object.entries(roles).map(([key, role]) => <span key={key}><i style={{ background: role.color }} />{role.label}</span>)}</div></Modal>}
    {modal === 'about' && <Modal title="Cube Forum · Iceberg X" subtitle="Build. Be seen. Level up." onClose={() => setModal(null)}><div className="guide-content"><Brand /><p>Kalıcı bilgi, görünür katkı ve güzel sohbetler için tasarlanmış bir topluluk alanı.</p><div className="demo-notice"><Compass size={20} /><p>Bu site etkileşimli bir tasarım demosudur. Konular, yanıtlar ve profil tercihleri bu tarayıcıda saklanır. Çevrimiçi sayıları ve topluluk istatistikleri örnektir. Bildirimler ve raporlama örnek akışlardır; sunucuya gönderilmez.</p></div><button className="button button-outline full-width" onClick={() => setModal('guide')}>Topluluk rehberini oku <ArrowRight size={16} /></button></div></Modal>}
    {toast && <div className="toast" role="status"><span><Check size={17} /></span>{toast}<button aria-label="Bildirimi kapat" onClick={() => setToast('')}><X size={16} /></button></div>}
  </div>;
}

function CreateTopic({ portalRole, categories, quests, defaultCategory, onClose, onCreate }) {
  const [title, setTitle] = useState(''); const [body, setBody] = useState('');
  const [categoryId, setCategoryId] = useState(defaultCategory !== 'all' && defaultCategory !== 'announcements' ? defaultCategory : 'help');
  const [questId, setQuestId] = useState('');
  return <Modal title="Bir konuşma başlat." subtitle="Bir soru, bir fikir veya sadece bir merhaba." onClose={onClose}>
    <form className="composer-form" onSubmit={e => { e.preventDefault(); if (canStartTopic(portalRole, categoryId) && title.trim().length >= 8 && body.trim().length >= 15) onCreate({ title: title.trim(), body: body.trim(), categoryId, questId: questId || null }); }}>
      <div className="form-row"><label>Konuşma alanı<select value={categoryId} onChange={e => setCategoryId(e.target.value)}>{categories.filter(c => canStartTopic(portalRole, c.id)).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>Quest etiketi <span>isteğe bağlı</span><select value={questId} onChange={e => setQuestId(e.target.value)}><option value="">Quest seçilmedi</option>{quests.map(q => <option key={q.id} value={q.id}>{q.title}</option>)}</select></label></div>
      <label>Konu başlığı<input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="Neyi konuşmak istersin?" minLength={8} maxLength={140} required /><small>{title.length}/140 · En az 8 karakter</small></label>
      <label htmlFor="topic-body">Mesajın</label><MarkdownEditor id="topic-body" value={body} onChange={value => setBody(value.slice(0,10000))} rows={7} required placeholder="Sorunu, fikrini veya deneyimini paylaş…"/><p className="field-hint">Markdown desteklenir · En az 15, en fazla 10.000 karakter</p><div className="composer-info"><ShieldCheck size={17} />Duyuruları yalnızca Mentor ve Admin paylaşabilir.</div><footer className="modal-footer"><button type="button" className="button button-outline" onClick={onClose}>Vazgeç</button><button className="button button-dark" disabled={title.trim().length < 8 || body.trim().length < 15}>Konuyu paylaş <ArrowUpRight size={17} /></button></footer>
    </form></Modal>;
}

function ProfileEditor({ profile, onClose, onSave }) {
  const { earnedBadges: badges } = useDesign();
  const [selected, setSelected] = useState([...profile.badgeIds]); const [signature, setSignature] = useState(profile.signature || ''); const role = profile.role;
  const preview = { ...profile, badgeIds: selected, role };
  const toggle = id => setSelected(list => list.includes(id) ? list.filter(item => item !== id) : list.length < 3 ? [...list, id] : list);
  const move = (index, delta) => setSelected(list => { const result = [...list]; [result[index], result[index + delta]] = [result[index + delta], result[index]]; return result; });
  return <Modal title="Katkın, senin imzan." subtitle="Kazandığın rozetlerden üçünü vitrinine taşı." onClose={onClose}><form className="profile-editor" onSubmit={e => { e.preventDefault(); onSave({ ...profile, badgeIds: selected, signature, role }); }}><div className="profile-preview"><Avatar member={preview} size="xl" /><div><h3>{profile.name}</h3><p style={{ color: roles[role]?.color }}>{role}</p><BadgeRow ids={selected} large /></div></div><div className="label-with-count"><strong>Vitrin rozetlerin</strong><span>{selected.length} / 3 seçildi</span></div><div className="badge-picker">{badges.length === 0 && <p className="forum-badge-empty">Henüz kazanılmış rozetin yok. İlk rozetini kazandığında burada görünecek.</p>}{badges.map(badge => { const isSelected = selected.includes(badge.id); return <button key={badge.id} type="button" className={`badge-option ${isSelected ? 'selected' : ''}`} disabled={!isSelected && selected.length === 3} onClick={() => toggle(badge.id)}><Badge id={badge.id} large /><strong>{badge.name}</strong><small>{badge.description}</small>{isSelected && <span className="badge-selected-number">{selected.indexOf(badge.id) + 1}</span>}</button>; })}</div><p className="field-hint">Yalnızca portalda kazandığın rozetler gösterilir. En fazla 3 rozet seçebilirsin; tercihlerin bu önizlemede tarayıcında saklanır.</p>{selected.length > 1 && <div className="badge-order">{selected.map((id, index) => <div key={id}><Badge id={id} /><span>{index + 1}. {byId(badges, id)?.name}</span><button type="button" aria-label={`${byId(badges, id)?.name} rozetini sola taşı`} disabled={index === 0} onClick={() => move(index, -1)}><ChevronLeft size={14} /></button><button type="button" aria-label={`${byId(badges, id)?.name} rozetini sağa taşı`} disabled={index === selected.length - 1} onClick={() => move(index, 1)}><ChevronRight size={14} /></button></div>)}</div>}<p className="field-hint">Avatar çerçeven portal aşamana göre belirlenir: {profile.role}.</p><label>Forum imzan<textarea value={signature} onChange={e => setSignature(e.target.value)} maxLength={140} rows={2} placeholder="Her katkının altına küçük bir iz bırak." /><small>{signature.length}/140</small></label><footer className="modal-footer"><button type="button" className="button button-outline" onClick={onClose}>Vazgeç</button><button className="button button-dark">Değişiklikleri kaydet <Check size={16} /></button></footer></form></Modal>;
}

function TopicDetail({ topic, getMember, profile, isSaved, isFollowing, onSave, onFollow, onClose, onReply, onEdit, onDelete, onReplyEdit, onReplyDelete, onReport, notify }) {
  const { viewer } = useDesign(); const currentUserId = viewer.id;
  const [reply, setReply] = useState(''); const [editing, setEditing] = useState(null); const [editText, setEditText] = useState(''); const [page, setPage] = useState(1); const [confirmDelete, setConfirmDelete] = useState(null);
  const category = byId(categories, topic.categoryId), author = getMember(topic.authorId), quest = byId(quests, topic.questId);
  const pages = Math.max(1, Math.ceil(topic.replies.length / 4));
  useEffect(() => { setPage(current => Math.min(current, pages)); }, [pages]);
  const date = value => new Date(value).toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' });
  const share = async () => { try { await navigator.clipboard.writeText(new URL(`?konu=${encodeURIComponent(topic.id)}`, location.href).href); notify('Konu bağlantısı kopyalandı.'); } catch { notify('Bağlantıyı kopyalamak için tarayıcı izni gerekiyor.'); } };
  const editor = (id, original, callback) => editing === id ? <form className="inline-editor" onSubmit={e => { e.preventDefault(); if (editText.trim()) { callback(editText.trim()); setEditing(null); } }}><MarkdownEditor id="edit-post-body" value={editText} onChange={value => setEditText(value.slice(0,10000))} rows={4} required /><div><button type="button" className="button button-outline" onClick={() => setEditing(null)}>Vazgeç</button><button className="button button-dark">Kaydet</button></div></form> : <Markdown text={original} />;
  return <Modal title="Konu & sohbet" onClose={onClose} wide><div className="topic-detail"><div className="detail-category-row"><span className="topic-category" style={{ color: category?.color }}><Icon name={category?.icon} size={14} />{category?.name}</span>{topic.pinned && <span className="pinned-tag"><Pin size={12} />Sabitlendi</span>}{quest && <span className="quest-tag"><Target size={12} />{quest.title}</span>}</div><h1>{topic.title}</h1><div className="detail-toolbar"><span><Eye size={14} />{formatCount(topic.views)} görüntülenme</span><span><MessageCircle size={14} />{topic.replies.length} yanıt</span><button className={isFollowing ? 'following' : ''} onClick={onFollow}><Bell size={15} />{isFollowing ? 'Takip ediliyor' : 'Takip et'}</button><button aria-label={isSaved ? 'Kaydı kaldır' : 'Konuyu kaydet'} onClick={onSave}><Bookmark size={16} fill={isSaved ? 'currentColor' : 'none'} /></button><button aria-label="Bağlantıyı kopyala" onClick={share}><Copy size={15} /></button></div><article className="thread-post"><aside><Avatar member={author} size="lg" /><strong>{author.name}</strong><span style={{ color: roles[author.role]?.color }}>{author.role}</span><BadgeRow ids={author.badgeIds} /></aside><div className="thread-post-content"><div className="post-date"><span>{date(topic.createdAt)}{topic.edited && ' · düzenlendi'}</span><span>#1</span></div>{editor('topic', topic.body, onEdit)}{author.signature && <div className="signature">{author.signature}</div>}<div className="post-actions">{topic.authorId === currentUserId && <><button onClick={() => { setEditing('topic'); setEditText(topic.body); }}>Düzenle</button><button onClick={() => setConfirmDelete('topic')}>Sil</button></>}<button onClick={onReport}><Flag size={12} />Bildir</button><button onClick={() => { setReply(`@${author.username} `); document.getElementById('reply-body')?.focus(); }}><MessageCircle size={13} />Yanıtla</button></div></div></article><div className="replies-heading"><h3>Sohbetin devamı <span>{topic.replies.length}</span></h3><span>Eskiden yeniye <ArrowDown size={13} /></span></div>{topic.replies.slice((page - 1) * 4, page * 4).map((post, index) => { const member = getMember(post.authorId); return <article className="thread-post reply-post" key={post.id}><aside><Avatar member={member} /><strong>{member.name}</strong><span style={{ color: roles[member.role]?.color }}>{member.role}</span><BadgeRow ids={member.badgeIds} /></aside><div className="thread-post-content"><div className="post-date"><span>{date(post.createdAt)}{post.edited && ' · düzenlendi'}</span><span>#{(page - 1) * 4 + index + 2}</span></div>{editor(post.id, post.body, body => onReplyEdit(post.id, body))}{member.signature && <div className="signature">{member.signature}</div>}<div className="post-actions">{post.authorId === currentUserId && <><button onClick={() => { setEditing(post.id); setEditText(post.body); }}>Düzenle</button><button onClick={() => setConfirmDelete(post.id)}>Sil</button></>}<button onClick={onReport}><Flag size={12} />Bildir</button><button onClick={() => { setReply(`@${member.username} `); document.getElementById('reply-body')?.focus(); }}>@ Yanıtla</button></div></div></article>; })}{topic.replies.length === 0 && <p className="no-replies">Henüz yanıt yok. İlk katkı senden gelsin.</p>}{pages > 1 && <div className="pagination"><button aria-label="Önceki yanıtlar" disabled={page === 1} onClick={() => setPage(page - 1)}><ChevronLeft size={17} /></button>{Array.from({ length: pages }, (_, i) => <button key={i} className={page === i + 1 ? 'active' : ''} onClick={() => setPage(i + 1)}>{i + 1}</button>)}<button aria-label="Sonraki yanıtlar" disabled={page === pages} onClick={() => setPage(page + 1)}><ChevronRight size={17} /></button></div>}<form className="reply-composer" onSubmit={e => { e.preventDefault(); if (reply.trim()) { onReply(reply.trim()); setReply(''); setPage(Math.ceil((topic.replies.length + 1) / 4)); } }}><div><Avatar member={profile} size="sm" /><strong>Sen de bir iz bırak.</strong></div><label htmlFor="reply-body">Yanıtın</label><MarkdownEditor id="reply-body" value={reply} onChange={value => setReply(value.slice(0,5000))} placeholder="Fikrini, çözümünü veya bir teşekkürünü paylaş…" rows={3} required /><footer><span><Code2 size={14} /> Markdown desteklenir</span><button className="button button-dark" disabled={!reply.trim()}>Yanıtı paylaş <Send size={15} /></button></footer></form>{confirmDelete && <div className="delete-confirm" role="alert"><p>{confirmDelete === 'topic' ? 'Konunu ve bu demodaki yanıtlarını kaldırmak istiyor musun?' : 'Bu yanıtını kaldırmak istiyor musun?'}</p><button className="button button-outline" onClick={() => setConfirmDelete(null)}>Vazgeç</button><button className="button button-danger" onClick={() => { if (confirmDelete === 'topic') onDelete(); else onReplyDelete(confirmDelete); setConfirmDelete(null); }}>Evet, kaldır</button></div>}</div></Modal>;
}
function ReportDialog({ onClose, onSubmit }) {
  const [reason, setReason] = useState('Saygısız veya incitici içerik');
  return <Modal title="Topluluğu birlikte koruyalım." subtitle="Bu gönderiyi neden bildiriyorsun?" onClose={onClose}><form className="report-form" onSubmit={e => { e.preventDefault(); onSubmit(); }}>{['Saygısız veya incitici içerik', 'Spam veya reklam', 'Yanlış kategori / konu dışı içerik', 'Başka bir sorun'].map(value => <label className="radio-option" key={value}><input type="radio" name="reason" checked={reason === value} onChange={() => setReason(value)} />{value}</label>)}<label>Eklemek istediğin bir şey var mı?<textarea rows={3} maxLength={1000} placeholder="İsteğe bağlı açıklama" /></label><p className="field-hint">Demo akışıdır. Bildirim bu tarayıcı dışında iletilmez.</p><footer className="modal-footer"><button type="button" className="button button-outline" onClick={onClose}>Vazgeç</button><button className="button button-dark">Bildirimi gönder <Flag size={15} /></button></footer></form></Modal>;
}
