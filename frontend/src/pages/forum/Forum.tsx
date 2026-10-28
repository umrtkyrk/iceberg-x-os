import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { Bell, Bookmark, CheckCircle2, ChevronRight, Home, LockKeyhole, MessagesSquare, Pin, Plus, Search } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../utils/api';
import { MarkdownEditor } from '../../components/MarkdownEditor';
import './forum.css';

interface Author { id: string; name: string; role: string }
interface Category { id: string; name: string; description: string; staff_only: boolean; _count: { topics: number }; topics: { id: string; title: string; last_activity_at: string }[] }
interface Post { id: string; body: string; author: Author | null; created_at: string; updated_at: string }
interface Topic extends Post { accepted_reply_id: string | null; title: string; category_id: string; category?: Category; locked: boolean; pinned: boolean; last_activity_at: string; states: { saved: boolean; following: boolean; read_at?: string }[]; _count?: { replies: number } }
interface TopicList { topics: Topic[]; total: number; pageSize: number }
interface Thread { acceptedReply?: Post | null; topic: Topic; replies: Post[]; total: number; pageSize: number }
interface Report { id: string; topic_id: string; reply_id: string | null; reason: string; reporter: Author | null; topic: { title: string; body: string; deleted_at: string | null }; reply?: { body: string; deleted_at: string | null } | null }
interface ReportList { reports: Report[]; total: number; pageSize: number }
interface Editor { kind: 'create' | 'topic' | 'reply'; id?: string; title: string; body: string; category: string }
const date = (value: string) => new Date(value).toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' });
const emptyList: TopicList = { topics: [], total: 0, pageSize: 20 };
const hints: Record<string, string> = {
  announcements: 'Duyurunun kapsamını, tarihini ve Cubelardan beklenen adımları açıkça belirt.',
  introductions: 'Merhaba! Ben…\n\nİlgilendiğim alanlar:\nŞu sıralar öğrendiğim şey:\nBirlikte çalışmak istediğim konular:',
  help: 'Ne yapmak istiyorum?\n\nKarşılaştığım hata:\n\nDenediğim çözümler:\n\nİlgili kod (gizli anahtar veya parola ekleme):',
  showcase: 'Projemin amacı:\n\nBu hafta tamamladıklarım:\n\nTakıldığım noktalar:\n\nGeri bildirim istediğim alan:',
  resources: 'Kaynağın adı ve bağlantısı:\n\nNe anlatıyor?\n\nKimlerin işine yarar?\n\nBenim notlarım:',
  lounge: 'Sohbeti başlat: bir öneri, bir soru veya gününden küçük bir hikâye…',
};
function Markdown({ text }: { text: string }) { return <div className="markdown"><ReactMarkdown skipHtml components={{ img: () => null }}>{text || ''}</ReactMarkdown></div>; }

export default function Forum() {
  const { user } = useAuth();
  const staff = user?.role === 'ADMIN' || user?.role === 'MENTOR';
  const [params, setParams] = useSearchParams();
  const topicId = params.get('konu');
  const categoryId = params.get('kategori') || '';
  const view = params.get('gorunum') || 'all';
  const query = params.get('q') || '';
  const sort = params.get('siralama') === 'newest' ? 'newest' : 'active';
  const rawPage = Number(params.get('sayfa'));
  const page = Number.isInteger(rawPage) && rawPage > 0 && rawPage < 100000 ? rawPage : 1;
  const [categories, setCategories] = useState<Category[]>([]);
  const [list, setList] = useState<TopicList>(emptyList);
  const [thread, setThread] = useState<Thread | null>(null);
  const [reports, setReports] = useState<ReportList>({ reports: [], total: 0, pageSize: 20 });
  const [search, setSearch] = useState(query);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [revision, setRevision] = useState(0);
  const [message, setMessage] = useState('');
  const [reply, setReply] = useState('');
  const [editor, setEditor] = useState<Editor | null>(null);
  const [reportTarget, setReportTarget] = useState<{ reply_id?: string } | null>(null);
  const [reason, setReason] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const pageHeading = useRef<HTMLHeadingElement>(null);
  const locationKey = params.toString();

  useEffect(() => { setSearch(query); }, [query]);
  useEffect(() => { setEditor(null); setReportTarget(null); setDeleteTarget(null); setReply(''); setMessage(''); }, [locationKey]);
  useEffect(() => {
    let current = true;
    setLoading(true); setError(''); setThread(null); setList(emptyList); setReports({ reports: [], total: 0, pageSize: 20 });
    const request = new URLSearchParams({ page: String(page), sort });
    if (categoryId) request.set('category', categoryId);
    if (query) request.set('q', query);
    if (['saved', 'following', 'unanswered', 'solved'].includes(view)) request.set('view', view);
    async function load() {
      try {
        const [nextCategories, data] = await Promise.all([
          api.get<Category[]>('/forum/categories'),
          topicId ? api.get<Thread>(`/forum/topics/${encodeURIComponent(topicId)}?page=${page}`)
            : view === 'reports' ? api.get<ReportList>(`/forum/reports?page=${page}`)
              : view !== 'index' || categoryId || query ? api.get<TopicList>(`/forum/topics?${request}`) : Promise.resolve(null),
        ]);
        if (!current) return;
        setCategories(nextCategories);
        if (topicId) setThread(data as Thread);
        else if (view === 'reports') setReports(data as ReportList);
        else setList((data as TopicList | null) || emptyList);
      } catch (err) { if (current) setError(err instanceof Error ? err.message : 'Forum yüklenemedi.'); }
      finally { if (current) { setLoading(false); pageHeading.current?.focus(); } }
    }
    void load();
    return () => { current = false; };
  }, [locationKey, revision, user?.id]);

  const go = (values: Record<string, string> = {}) => { if (!busyRef.current) setParams(values); };
  const openTopic = (id: string) => go({ konu: id });
  const changePage = (next: number) => { const values = Object.fromEntries(params); values.sayfa = String(next); go(values); };
  async function mutate(action: () => Promise<void>) {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError(''); setMessage('');
    try { await action(); setRevision(n => n + 1); }
    catch (err) { setError(err instanceof Error ? err.message : 'İşlem tamamlanamadı. Yazdıkların korunuyor.'); }
    finally { busyRef.current = false; setBusy(false); }
  }
  const currentCategory = categories.find(c => c.id === categoryId);
  const title = thread?.topic.title || (topicId ? 'Konu' : view === 'reports' ? 'Moderasyon bildirimleri' : currentCategory?.name || (view === 'saved' ? 'Kaydettiğim konular' : view === 'following' ? 'Takip ettiğim konular' : view === 'unanswered' ? 'Yanıt bekleyen sorular' : view === 'solved' ? 'Çözülen sorular' : view === 'all' || query ? 'Topluluk akışı' : 'Forumlar'));
  const canCreate = categories.some(c => !c.staff_only || staff);
  const total = topicId ? thread?.total || 0 : view === 'reports' ? reports.total : list.total;
  const pageSize = topicId ? thread?.pageSize || 20 : view === 'reports' ? reports.pageSize : list.pageSize;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const topicPath = thread ? `/forum/topics/${encodeURIComponent(thread.topic.id)}` : '';

  const renderPost = (post: Post, first: boolean, number: number) => <article className={`live-post ${!first && thread?.topic.accepted_reply_id === post.id ? 'accepted-post' : ''}`} key={post.id}>
    <aside><span className="live-initials" aria-hidden="true">{(post.author?.name || 'Cube').split(' ').map(part => part[0]).slice(0, 2).join('')}</span><strong>{post.author?.name || 'Bilinmeyen Cube'}</strong><small>{post.author?.role === 'CUBE' ? 'Cube' : post.author?.role === 'ADMIN' ? 'Admin' : 'Mentor'}</small></aside>
    <div className="live-post-body"><div className="live-post-date"><span>{date(post.created_at)}{post.updated_at !== post.created_at ? ' · düzenlendi' : ''}</span><span>{number ? `#${number}` : 'Çözüm'}</span></div>{!first && thread?.topic.accepted_reply_id === post.id && <p className="accepted-label"><CheckCircle2 size={17}/>Kabul edilen çözüm</p>}<Markdown text={post.body}/><div className="live-post-actions">
      {!first && thread?.topic.category_id === 'help' && thread.topic.author?.id === user?.id && !thread.topic.locked && <button disabled={busy} onClick={() => void mutate(async () => { await api.put(`${topicPath}/answer`, { reply_id: thread.topic.accepted_reply_id === post.id ? null : post.id }); })}>{thread.topic.accepted_reply_id === post.id ? 'Çözüm seçimini kaldır' : 'Çözüm olarak kabul et'}</button>}
      {post.author?.id === user?.id && !thread?.topic.locked && <button disabled={busy} onClick={() => { setEditor({ kind: first ? 'topic' : 'reply', id: post.id, title: thread?.topic.title || '', body: post.body, category: thread?.topic.category_id || '' }); setReportTarget(null); }}>Düzenle</button>}
      {(post.author?.id === user?.id || staff) && <button disabled={busy} onClick={() => setDeleteTarget(first ? topicPath : `${topicPath}/replies/${post.id}`)}>Sil</button>}
      <button disabled={busy} onClick={() => { setReportTarget(first ? {} : { reply_id: post.id }); setReason(''); setEditor(null); }}>Moderatöre bildir</button>
      {!thread?.topic.locked && <button onClick={() => { setReply(text => `${text}${text ? '\n\n' : ''}> ${(post.body || '').slice(0, 800).replace(/\n/g, '\n> ')}\n\n`); document.getElementById('live-reply')?.focus(); }}>Alıntıla</button>}
    </div></div>
  </article>;

  return <div className="cube-forum app-shell classic-forum live-forum hybrid-forum" aria-busy={loading || busy}>
    <header className="classic-masthead"><div><span className="classic-kicker">ICEBERG X / COMMUNITY</span><h1>Birlikte daha iyi cevaplar.</h1><p>Sorular, projeler ve aradaki güzel sohbetler. Cube topluluğunun buluşma yeri.</p></div><MessagesSquare size={48} aria-hidden="true"/></header>
    <form className="live-search" onSubmit={event => { event.preventDefault(); go({ gorunum: 'all', ...(search.trim() ? { q: search.trim() } : {}) }); }}><label htmlFor="forum-search"><Search size={16}/>Forumda ara</label><input id="forum-search" maxLength={100} value={search} onChange={event => setSearch(event.target.value)} placeholder="Konu başlığı veya mesaj içeriği…"/><button className="button button-outline" disabled={busy}>Ara</button></form>
    <div className="hybrid-layout">
      <aside className="hybrid-sidebar"><nav aria-label="Topluluk menüsü">
        {[['all', 'Topluluk akışı', Home], ['unanswered', 'Yanıt bekleyenler', MessagesSquare], ['solved', 'Çözülen sorular', CheckCircle2], ['saved', 'Kaydedilenler', Bookmark], ['following', 'Takip ettiklerim', Bell]].map(([key, label, NavIcon]) => { const Icon = NavIcon as typeof Home; return <button key={String(key)} disabled={busy} className={!topicId && view === key && !categoryId ? 'selected' : ''} onClick={() => go({ gorunum: String(key) })}><Icon size={17}/>{String(label)}</button>; })}
        <h2>TOPLULUKLAR</h2>{categories.map(category => <button key={category.id} disabled={busy} className={categoryId === category.id ? 'selected' : ''} onClick={() => go({ kategori: category.id })}><span className="hybrid-channel-mark">#</span><span>{category.name}</span><small>{category._count?.topics || 0}</small></button>)}
        <button disabled={busy} onClick={() => go({ gorunum: 'index' })}>Tüm forumları keşfet <ChevronRight size={14}/></button>
        {staff && <button disabled={busy} onClick={() => go({ gorunum: 'reports' })}>Moderasyon bildirimleri</button>}
      </nav><p className="hybrid-sidebar-note">İyi bir cevap, bir sonraki Cube’un da yolunu açar.</p></aside>
    <main className="main-content"><nav className="classic-breadcrumb" aria-label="Forum yolu"><Home size={14}/><button disabled={busy} onClick={() => go()}>Topluluk</button>{(currentCategory || thread?.topic.category) && <><ChevronRight size={13}/><button onClick={() => go({ kategori: thread?.topic.category_id || categoryId })}>{thread?.topic.category?.name || currentCategory?.name}</button></>}</nav>
      <div className="page-heading"><h2 ref={pageHeading} tabIndex={-1} className="live-heading">{title}</h2>{!topicId && view !== 'reports' && canCreate && <button disabled={busy || loading} className="button button-dark" onClick={() => { const category = currentCategory && (!currentCategory.staff_only || staff) ? currentCategory.id : categories.find(c => !c.staff_only)?.id || categories[0]?.id || ''; setEditor({ kind: 'create', title: '', body: '', category }); }}><Plus size={16}/>Yeni konu</button>}</div>
      {error && <div className="live-error" role="alert">{error}<button disabled={busy} onClick={() => setRevision(n => n + 1)}>Yeniden yükle</button></div>}
      {message && <p className="live-notice" role="status">{message}</p>}
      {editor && <form className="live-editor" onSubmit={event => { event.preventDefault(); void mutate(async () => {
        if (editor.kind === 'create') { const created = await api.post<{ id: string }>('/forum/topics', { title: editor.title, body: editor.body, category_id: editor.category }); setParams({ konu: created.id }); }
        else await api.patch(editor.kind === 'topic' ? topicPath : `${topicPath}/replies/${editor.id}`, { title: editor.title, body: editor.body });
        setEditor(null); setMessage('Mesajın kaydedildi.');
      }); }}><h3>{editor.kind === 'create' ? 'Yeni bir konu başlat' : 'Mesajını düzenle'}</h3><fieldset disabled={busy || loading}>
        {editor.kind === 'create' && <label>Forum<select value={editor.category} onChange={event => setEditor({ ...editor, category: event.target.value })}>{categories.filter(c => !c.staff_only || staff).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}
        {editor.kind !== 'reply' && <label>Konu başlığı<input required minLength={8} maxLength={160} value={editor.title} onChange={event => setEditor({ ...editor, title: event.target.value })} placeholder="Konuyu açıkça anlatan bir başlık yaz"/></label>}
        <label htmlFor="live-editor">Mesajın</label><MarkdownEditor id="live-editor" required disabled={busy} value={editor.body} onChange={body => setEditor({ ...editor, body: body.slice(0, editor.kind === 'reply' ? 5000 : 10000) })} placeholder={hints[editor.category] || 'Ne paylaşmak istersin?'} rows={8}/>
        <p className="live-hint">{editor.kind === 'reply' ? 'En fazla 5.000' : '15–10.000'} karakter. Markdown desteklenir; görsel yükleme yoktur.</p><div className="live-actions"><button type="button" className="button button-outline" onClick={() => setEditor(null)}>Vazgeç</button><button className="button button-dark" disabled={editor.body.trim().length < (editor.kind === 'reply' ? 1 : 15) || (editor.kind !== 'reply' && editor.title.trim().length < 8)}>{busy ? 'Kaydediliyor…' : 'Kaydet'}</button></div>
      </fieldset></form>}
      {deleteTarget && <div className="live-error" role="alert"><p>Bu mesajı forumdan kaldırmak istiyor musun?</p><button disabled={busy} onClick={() => setDeleteTarget(null)}>Vazgeç</button><button disabled={busy} onClick={() => void mutate(async () => { await api.delete(deleteTarget); if (deleteTarget === topicPath) setParams({ gorunum: 'all' }); setDeleteTarget(null); setMessage('Mesaj kaldırıldı.'); })}>Evet, kaldır</button></div>}
      {reportTarget && <form className="live-editor" onSubmit={event => { event.preventDefault(); void mutate(async () => { await api.post(`${topicPath}/reports`, { ...reportTarget, reason }); setReportTarget(null); setMessage('Bildirimin moderasyon kuyruğuna iletildi.'); }); }}><label>Bildirim nedeni<textarea required minLength={10} maxLength={1000} value={reason} onChange={event => setReason(event.target.value)} placeholder="Sorunu kısaca açıkla."/></label><div className="live-actions"><button type="button" disabled={busy} onClick={() => setReportTarget(null)}>Vazgeç</button><button className="button button-dark" disabled={busy || reason.trim().length < 10}>Bildirimi gönder</button></div></form>}
      {loading ? <p className="live-empty" role="status">Forum yükleniyor…</p> : thread ? <>
        <div className="live-actions live-thread-tools"><span>{thread.total} yanıt</span>{thread.topic.locked && <span><LockKeyhole size={14}/>Kilitli</span>}{thread.topic.pinned && <span><Pin size={14}/>Sabit</span>}
          <button disabled={busy} onClick={() => void mutate(async () => { await api.put(`${topicPath}/state`, { following: !thread.topic.states?.[0]?.following }); })}><Bell size={15}/>{thread.topic.states?.[0]?.following ? 'Takibi bırak' : 'Takip et'}</button>
          <button disabled={busy} onClick={() => void mutate(async () => { await api.put(`${topicPath}/state`, { saved: !thread.topic.states?.[0]?.saved }); })}><Bookmark size={15}/>{thread.topic.states?.[0]?.saved ? 'Kaydı kaldır' : 'Kaydet'}</button>
          {staff && <><button disabled={busy} onClick={() => void mutate(async () => { await api.patch(`${topicPath}/moderation`, { locked: !thread.topic.locked, pinned: thread.topic.pinned }); })}>{thread.topic.locked ? 'Kilidi aç' : 'Konuyu kilitle'}</button><button disabled={busy} onClick={() => void mutate(async () => { await api.patch(`${topicPath}/moderation`, { locked: thread.topic.locked, pinned: !thread.topic.pinned }); })}>{thread.topic.pinned ? 'Sabitlemeyi kaldır' : 'Sabitle'}</button></>}
        </div>{renderPost(thread.topic, true, 1)}{thread.acceptedReply && !thread.replies.some(post => post.id === thread.acceptedReply?.id) && renderPost(thread.acceptedReply, false, 0)}{thread.replies.map((post, index) => renderPost(post, false, (page - 1) * pageSize + index + 2))}
        {!thread.total && <p className="live-empty">Henüz yanıt yok. İlk yanıtı sen yaz.</p>}
        {thread.topic.locked ? <p className="live-notice">Bu konu moderatör tarafından yeni yanıtlara kapatıldı.</p> : <form className="live-editor" onSubmit={event => { event.preventDefault(); void mutate(async () => { await api.post(`${topicPath}/replies`, { body: reply }); setReply(''); setParams({ konu: thread.topic.id, sayfa: String(Math.ceil((thread.total + 1) / pageSize)) }); setMessage('Yanıtın yayımlandı.'); }); }}><label htmlFor="live-reply">Hızlı yanıt</label><MarkdownEditor id="live-reply" required disabled={busy} value={reply} onChange={value => setReply(value.slice(0, 5000))} placeholder="Çözümünü, deneyimini veya sorunu yaz…"/><div className="live-actions"><small>{reply.length}/5000</small><button className="button button-dark" disabled={busy || !reply.trim()}>{busy ? 'Gönderiliyor…' : 'Yanıtı gönder'}</button></div></form>}
      </> : topicId ? null : view === 'reports' ? <section>{reports.reports.map(report => <article className="live-editor" key={report.id}><h3>{report.topic?.title || 'Kaldırılmış konu'}</h3><p><strong>Bildiren:</strong> {report.reporter?.name || 'Bilinmeyen Cube'}</p><p>{report.reason}</p><blockquote><Markdown text={report.reply?.body || report.topic?.body || ''}/></blockquote><div className="live-actions"><button onClick={() => openTopic(report.topic_id)}>Konuyu aç</button><button disabled={busy} onClick={() => void mutate(async () => { await api.patch(`/forum/reports/${report.id}`, {}); setMessage('Bildirim sonuçlandırıldı.'); })}>İncelendi olarak işaretle</button></div></article>)}{!reports.total && <p className="live-empty">İncelenmeyi bekleyen bildirim yok.</p>}</section> : view === 'index' && !categoryId && !query ? <section className="category-directory" aria-label="Forum kategorileri">
        <div className="classic-section-title"><h3>Topluluk forumları</h3><span>Kalıcı bilgi, iyi sohbet.</span></div><div className="live-category-head" aria-hidden="true"><span>Forum / Açıklama</span><span>Konular</span><span>Son hareket</span></div>
        {categories.map(category => <div className="live-category-row" key={category.id}><button className="classic-category-name" onClick={() => go({ kategori: category.id })}><span className="classic-folder"><MessagesSquare size={22}/></span><span><strong>{category.name}</strong><small>{category.description}{category.staff_only && ' Konu açma: Mentor / Admin.'}</small></span></button><div className="classic-count"><strong>{category._count?.topics || 0}</strong><small>konu</small></div><div className="classic-last-post">{category.topics?.[0] ? <><button onClick={() => openTopic(category.topics[0].id)}>{category.topics[0].title}</button><small>{date(category.topics[0].last_activity_at)}</small></> : <small>İlk konu henüz açılmadı.</small>}</div></div>)}
        {!categories.length && !error && <p className="live-empty">Forum kategorileri henüz hazırlanmadı.</p>}
        <div className="classic-welcome"><MessagesSquare size={20}/><p><strong>Hoş geldin, {user?.name || 'Cube'}.</strong>Konuyu doğru alanda aç; başlığı açık yaz, kişilere değil fikirlere odaklan.</p></div>
      </section> : <section>
        <div className="hybrid-feed-tabs"><div><button className={sort === 'active' ? 'selected' : ''} disabled={busy} onClick={() => go({ ...Object.fromEntries(params), siralama: 'active', sayfa: '1' })}>Son hareketler</button><button className={sort === 'newest' ? 'selected' : ''} disabled={busy} onClick={() => go({ ...Object.fromEntries(params), siralama: 'newest', sayfa: '1' })}>En yeni</button></div><span>{list.total} konu</span></div>
        {query && <p className="live-hint">“{query}” için arama sonuçları</p>}
        {list.topics.map(topic => <article className="hybrid-topic" key={topic.id}>
          <div className={`hybrid-answer-count ${topic.accepted_reply_id ? 'is-solved' : ''}`}>{topic.accepted_reply_id ? <CheckCircle2 size={21}/> : <MessagesSquare size={20}/>}<strong>{topic._count?.replies || 0}</strong><span>{topic.accepted_reply_id ? 'çözüldü' : 'yanıt'}</span></div>
          <div className="hybrid-topic-content"><div className="hybrid-topic-meta"><button onClick={() => go({ kategori: topic.category_id })}>c/{topic.category_id}</button><span>· {topic.author?.name || 'Bilinmeyen Cube'}</span>{topic.pinned && <span><Pin size={12}/>Sabit</span>}{topic.locked && <span><LockKeyhole size={12}/>Kilitli</span>}</div>
            <button className="live-topic-title" onClick={() => openTopic(topic.id)}>{topic.title}</button><p className="hybrid-excerpt">{(topic.body || '').replace(/[#*`>]/g, '').slice(0, 240)}</p>
            <div className="hybrid-topic-footer"><button className="hybrid-category-tag" onClick={() => go({ kategori: topic.category_id })}>{categories.find(category => category.id === topic.category_id)?.name || 'Genel'}</button><button onClick={() => openTopic(topic.id)}>Sohbete katıl <ChevronRight size={13}/></button><time dateTime={topic.last_activity_at}>{date(topic.last_activity_at)}</time></div>
          </div>
        </article>)}
        {!list.topics.length && !error && <div className="live-empty"><MessagesSquare size={30}/><h3>{query ? 'Henüz bir eşleşme yok.' : view === 'unanswered' ? 'Yanıt bekleyen soru yok.' : view === 'solved' ? 'Çözümler burada birikecek.' : 'Bu sohbet seninle başlayabilir.'}</h3><p>{query ? 'Başka bir kelimeyle aramayı deneyebilirsin.' : view === 'saved' ? 'Konulardaki kaydet düğmesiyle kendi okuma listeni oluştur.' : view === 'following' ? 'Gelişmelerinden haberdar olmak istediğin konuları takip et.' : 'Bir soru sor, üzerinde çalıştığın projeyi anlat veya öğrendiğin bir şeyi paylaş.'}</p></div>}
      </section>}
      {!loading && (pages > 1 || page > 1) && <nav className="live-pagination" aria-label="Sayfalar"><button disabled={busy || page <= 1} onClick={() => changePage(page - 1)}>Önceki</button><span>Sayfa {page} / {pages}</span><button disabled={busy || page >= pages} onClick={() => changePage(page + 1)}>Sonraki</button></nav>}
      <footer className="classic-footer"><span>Iceberg X · Cube Forum</span><span>Saygılı ol. Kaynağını belirt. Bildiğini paylaş.</span></footer>
    </main>
    <aside className="hybrid-about"><section><span className="hybrid-about-kicker">CUBE TOPLULUĞU</span><h2>Merakla başlar.<br/>Paylaşarak büyür.</h2><p>Burası birlikte öğrenmek, bir sorunu çözmek ve ürettiklerini paylaşmak için.</p><div className="hybrid-community-stat"><strong>{categories.reduce((sum, category) => sum + (category._count?.topics || 0), 0)}</strong><span>açılan konu</span><strong>{categories.length}</strong><span>topluluk alanı</span></div></section>
      <section><h3>İyi bir sorunun üç adımı</h3><ol><li><b>01</b><span>Önce ara.<small>Aynı soruya birlikte cevap vermiş olabiliriz.</small></span></li><li><b>02</b><span>Bağlamı paylaş.<small>Ne bekledin, ne oldu, neler denedin?</small></span></li><li><b>03</b><span>Çözümü işaretle.<small>İşe yarayan yanıtı sonraki Cube da bulsun.</small></span></li></ol></section>
      <section className="hybrid-help-callout"><h3>Bir fikrin mi var?</h3><p>Bitmiş olması gerekmiyor. Proje günlüğünde ilk adımını paylaş.</p><button disabled={busy} onClick={() => go({ kategori: 'showcase' })}>Projeleri keşfet <ChevronRight size={14}/></button></section>
    </aside></div>
  </div>;
}
