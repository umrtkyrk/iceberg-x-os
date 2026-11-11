# Cube Forum — Demo Day (2 minutes 50 seconds)

Presenters: Mesut Umur Tokyürek, Cube #018 (mission lead), and Medine Kaynak, Cube #013 (contributor). This is a timed live-demo script, not a video recording. Perform it only in a local synthetic environment, never in the production portal.

## Before the demo

1. Follow [the local setup guide](forum.md). Enable both flags, check the required tests and open `/forum`.
2. Prepare separate browser profiles already signed in as synthetic Cube A, Cube B and Mentor/Admin. Cube A needs at least three earned badges and an assigned quest/mission. Use `.invalid` demo identities; do not display real contact/NDA/feedback data or passwords.
3. Prepare a short Help topic with one reply for the moderation segment. Keep a spare, populated local snapshot for presentation recovery; do not switch to a live database.
4. Resize one window to phone width in advance. Keep desktop profile settings, Cube B's thread and the staff workspace ready in other profiles.

## Timed presentation

| Time | Action | Suggested narration (Turkish) |
|---|---|---|
| 0:00–0:20 | Show forum home, categories/counts and search. | “Cube Forum, Slack'te kaybolan sorular ve cevaplar için portalın içinde aranabilir bir bilgi hafızası oluşturuyor. Kimlikler ve yetkiler doğrudan portaldan geliyor.” |
| 0:20–0:45 | Cube A opens Forum profile. Show three earned badges, reorder one, change the signature and save. | “Her Cube yalnızca kendi kazandığı üç rozeti, istediği sırada sergileyebiliyor. İmza ve rozetler tüm gönderilerde kalıcı olarak görünüyor; dördüncü veya başkasına ait rozet sunucuda reddediliyor.” |
| 0:45–1:15 | Create a Tech Support topic with Markdown and an accessible quest/mission. | “Konuyu kategoriye açıyorum, Markdown ile bağlam ekliyorum ve kendi görevime bağlıyorum. Bu bağlantılar puan veya ödül üretmiyor.” |
| 1:15–1:45 | Cube B replies and mentions Cube A using the name picker. Cube A clicks the bell notification. | “Takip, konu sahipliği ve mention bildirimleri portalın bildirim sistemine bağlandı. Aynı kişi birden fazla nedenle alıcıysa tek bildirim alıyor. Tıkladığımda doğrudan ilgili yanıta gidiyorum.” |
| 1:45–2:15 | Use the prepared topic: report as Cube; staff opens Moderation, follows target, locks topic and marks reviewed. | “Raporları Mentor ve Admin görüyor. Konular sabitlenebiliyor, kilitlenebiliyor, taşınabiliyor ve içerik soft-delete ile kaldırılabiliyor. Bir Cube başka birinin gönderisini düzenleyemiyor.” |
| 2:15–2:35 | Show the phone-width window and saved/following navigation; show Alumni read-only view if prepared. | “Aynı forum mobilde de kullanılabiliyor. Senior Cube ve Iceberger seviyeleri kimlikte görünür; moderasyon yetkisi sadece hesap rolünden gelir. Alumni'nin paylaşım erişimi salt okunurdur.” |
| 2:35–2:50 | Show test results and return to forum. | “Kalıcı veri, yetki, bildirim ve güvenli yerel kurulum testleri geçti. Forum feature flag arkasında. Çalışmamız yalnızca kendi fork'umuzda; orijinal repoya veya canlı portala gönderim yapmıyoruz.” |

Keep image upload and accepted answers for questions after the timed presentation; they are extras beyond the original mission MVP. If notification timing is slow, use the prepared notification in the synthetic fixture and explain that it is prepared data. Never present a screenshot or scripted result as a new live action.

Suggested copyable topic title: **How should we handle concurrent expired sessions?**

```markdown
Several requests fail together when a session expires.

**What I tried:** refreshing inside each request handler.

How can we refresh once and retry the waiting requests safely?
```

Cube B's reply can start with “One shared refresh promise can queue the waiting requests.” Then select Cube A from the `@` picker; do not paste a fabricated handle. This keeps the live composition short enough for the allotted time.

## Acceptance before marking the mission delivered

- [x] Implementation, handover PR #7 and contributor-credit PR #6 merged into the fork's `forum-mvp`.
- [x] Full builds, 41 tests, feature-off, both PostgreSQL suites and synthetic HTTP permission/image checks passed on merged revision `2d07051` on 11 November 2026.
- [ ] Confirm the local empty-install or existing-database path that applies to the presenter/reviewer.
- [ ] Rehearse the sequence with Cube and staff profiles, including one denied action and a notification to an exact reply.
- [ ] Present the 2–3 minute live demo, or record and share it through the team's chosen Demo Day channel. This document does not mark that action complete.
- [ ] Attach the fork PRs and the final demo evidence to the mission's normal submission. No submission is performed by the setup scripts.
